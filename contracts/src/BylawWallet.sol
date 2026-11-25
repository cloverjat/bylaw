// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITapeOutProcessorW {
    function eval(uint256 id, bytes calldata inputs) external view returns (bytes memory);
    function netlist(uint256 id) external view returns (bytes memory);
}

interface IERC20W {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
}

/// @title BylawWallet
/// @notice A wallet that holds a token (for example USDC) and only sends it when a public TapeOut circuit says yes.
///         Three rules, chosen at creation and never changeable:
///         1 = daily cap, 2 = trusted recipients or small first payments, 3 = big payments need a second person.
///         The owner can send, but only through the rule, so a stolen key can only do what the rule allows.
///         There is no admin, pause or upgrade path.
/// @dev Experimental and unaudited. The circuit's hash is stored at creation and re-checked on every payment.
contract BylawWallet {
    uint256 public constant EVAL_GAS = 3_000_000;
    uint256 public constant TRUST_DELAY = 2 days; // a saved recipient becomes "trusted" this long after it was saved
    uint256 public constant MAX_UNITS = 63;
    uint256 public constant MAX_FEE_BPS = 100; // the fee can never be set above 1%

    IERC20W public immutable token;
    ITapeOutProcessorW public immutable processor;
    uint256 public immutable circuitId;
    bytes32 public immutable netlistHash;
    address public immutable owner;
    uint8 public immutable kind;      // 1 cap, 2 trusted-or-small, 3 confirm-above
    uint256 public immutable unit;    // token base units per "unit" (1 USDC = 1_000_000)
    uint256 public immutable limitA;  // kind 1: daily cap, 2: max to a new recipient, 3: confirmation limit (in units)
    uint256 public immutable limitB;  // kind 2: waiting hours for a new recipient
    address public immutable confirmer; // kind 3: the second person
    address public immutable feeRecipient; // Bylaw's fee wallet, fixed at creation
    uint256 public immutable feeBps;       // fee added on top of each payment, fixed at creation (10 = 0.1%)

    // kind 1
    uint256 public lastDay;
    uint256 public spentToday; // token base units, for lastDay
    // kind 2
    mapping(address => uint256) public addedAt;
    // kind 3
    struct Proposal { address to; uint256 amount; bool confirmed; bool executed; }
    Proposal[] public proposals;

    event Sent(address indexed to, uint256 amount);
    event FeePaid(address indexed feeRecipient, uint256 amount);
    event RecipientSaved(address indexed to, uint256 savedAt);
    event Proposed(uint256 indexed id, address indexed to, uint256 amount);
    event Confirmed(uint256 indexed id);
    event Rescued(uint256 amount);

    error NotOwner();
    error NotConfirmer();
    error BadParams();
    error TooBig();
    error RuleSaysNo();
    error RuleChanged();
    error WrongKind();
    error NotConfirmed();
    error AlreadyDone();
    error RuleIntact();

    constructor(
        IERC20W token_, ITapeOutProcessorW processor_, uint256 circuitId_,
        uint8 kind_, uint256 unit_, uint256 limitA_, uint256 limitB_, address confirmer_,
        address feeRecipient_, uint256 feeBps_
    ) {
        if (kind_ < 1 || kind_ > 3 || unit_ == 0 || limitA_ > MAX_UNITS || limitB_ > MAX_UNITS) revert BadParams();
        if (feeBps_ > MAX_FEE_BPS || (feeBps_ > 0 && feeRecipient_ == address(0))) revert BadParams();
        if (kind_ == 3 && (confirmer_ == address(0) || confirmer_ == msg.sender)) revert BadParams();
        token = token_;
        processor = processor_;
        circuitId = circuitId_;
        netlistHash = keccak256(processor_.netlist(circuitId_));
        owner = msg.sender;
        kind = kind_;
        unit = unit_;
        limitA = limitA_;
        limitB = limitB_;
        confirmer = kind_ == 3 ? confirmer_ : address(0);
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
    }

    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }

    function balance() external view returns (uint256) { return token.balanceOf(address(this)); }

    function _units(uint256 amount) internal view returns (uint256 u) {
        u = (amount + unit - 1) / unit; // round up, so the rule is never looser than the real amount
        if (u > MAX_UNITS) revert TooBig();
    }

    /// @dev Ask the public circuit. Input pins match compiler/src/wallet.mjs.
    function _ask(uint256 bitsValue, uint256 nBits) internal view {
        if (keccak256(processor.netlist(circuitId)) != netlistHash) revert RuleChanged();
        bytes memory input = new bytes((nBits + 7) / 8);
        for (uint256 i = 0; i < input.length; i++) input[i] = bytes1(uint8(bitsValue >> (8 * i)));
        (bool ok, bytes memory ret) =
            address(processor).staticcall{gas: EVAL_GAS}(abi.encodeCall(ITapeOutProcessorW.eval, (circuitId, input)));
        if (!ok) revert RuleSaysNo();
        bytes memory out = abi.decode(ret, (bytes));
        if (out.length != 1 || (uint8(out[0]) & 1) == 0) revert RuleSaysNo();
    }

    /// @dev The recipient always gets the full amount. The fee is paid on top, from the wallet's balance, to the fee wallet.
    function _pay(address to, uint256 amount) internal {
        require(token.transfer(to, amount), "transfer failed");
        emit Sent(to, amount);
        uint256 fee = (amount * feeBps) / 10_000;
        if (fee > 0) {
            require(token.transfer(feeRecipient, fee), "transfer failed");
            emit FeePaid(feeRecipient, fee);
        }
    }

    /// @notice Spent so far in the current day (kind 1).
    function spentNow() public view returns (uint256) {
        return block.timestamp / 1 days == lastDay ? spentToday : 0;
    }

    /// @notice Send. The rule decides; the owner cannot skip it. For kind 3, payments above the limit go through propose/confirm/execute.
    function send(address to, uint256 amount) external onlyOwner {
        if (to == address(0) || amount == 0) revert BadParams();
        uint256 a = _units(amount);
        if (kind == 1) {
            uint256 spent = spentNow();
            uint256 s = (spent + unit - 1) / unit;
            if (s > MAX_UNITS) revert TooBig();
            _ask(a | (s << 6) | (limitA << 12), 18);
            lastDay = block.timestamp / 1 days;
            spentToday = spent + amount;
        } else if (kind == 2) {
            uint256 ts = addedAt[to];
            bool trusted = ts != 0 && block.timestamp >= ts + TRUST_DELAY;
            uint256 age = ts == 0 ? 0 : (block.timestamp - ts) / 1 hours;
            if (age > MAX_UNITS) age = MAX_UNITS;
            _ask((trusted ? 1 : 0) | (a << 1) | (age << 7) | (limitA << 13) | (limitB << 19), 25);
        } else {
            _ask(a | (limitA << 7), 13); // confirmed = 0
        }
        _pay(to, amount);
    }

    /// @notice Kind 2: save a recipient. It counts as trusted after TRUST_DELAY, and its waiting time starts now.
    function saveRecipient(address to) external onlyOwner {
        if (kind != 2) revert WrongKind();
        if (to == address(0)) revert BadParams();
        if (addedAt[to] == 0) { addedAt[to] = block.timestamp; emit RecipientSaved(to, block.timestamp); }
    }

    /// @notice Kind 3: propose a payment that needs the second person.
    function propose(address to, uint256 amount) external onlyOwner returns (uint256 id) {
        if (kind != 3) revert WrongKind();
        if (to == address(0) || amount == 0) revert BadParams();
        _units(amount);
        proposals.push(Proposal(to, amount, false, false));
        id = proposals.length - 1;
        emit Proposed(id, to, amount);
    }

    function proposalCount() external view returns (uint256) { return proposals.length; }

    function confirm(uint256 id) external {
        if (kind != 3) revert WrongKind();
        if (msg.sender != confirmer) revert NotConfirmer();
        Proposal storage p = proposals[id];
        if (p.executed) revert AlreadyDone();
        p.confirmed = true;
        emit Confirmed(id);
    }

    function execute(uint256 id) external onlyOwner {
        if (kind != 3) revert WrongKind();
        Proposal storage p = proposals[id];
        if (p.executed) revert AlreadyDone();
        if (!p.confirmed) revert NotConfirmed();
        _ask(_units(p.amount) | (uint256(1) << 6) | (limitA << 7), 13); // confirmed = 1
        p.executed = true;
        _pay(p.to, p.amount);
    }

    /// @notice The only way around the rule: if the public circuit itself was changed (so it can no longer protect anyone),
    ///         the owner can move everything out so it is not stuck forever.
    function rescueIfRuleChanged() external onlyOwner {
        if (keccak256(processor.netlist(circuitId)) == netlistHash) revert RuleIntact();
        uint256 bal = token.balanceOf(address(this));
        require(token.transfer(owner, bal), "transfer failed");
        emit Rescued(bal);
    }
}
