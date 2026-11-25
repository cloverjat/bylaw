// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITapeOutProcessorE {
    function eval(uint256 id, bytes calldata inputs) external view returns (bytes memory);
    function netlist(uint256 id) external view returns (bytes memory);
}

interface IERC20E {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BylawEscrow
/// @notice A two-person agreement paid in installments (once, weekly, monthly...). The buyer and seller are fixed at creation,
///         with the installment amount and count, the interval, the response window, an optional referee and a SHA-256
///         fingerprint of the written terms. The seller accepts on-chain (their signature) and the buyer locks the full
///         amount once. Each installment is then paid by a public TapeOut circuit: when the buyer approves it, or
///         automatically once its due time and response window pass without a hold. If a referee was named, the buyer can
///         hold an installment before the window ends and the referee decides. The seller can always return an installment.
///         Nobody else can move the money, not even us.
/// @dev Experimental and unaudited. The circuit's netlist hash is frozen at creation and re-checked on every settlement.
contract BylawEscrow {
    uint256 public constant EVAL_GAS = 3_000_000;
    uint256 public constant MAX_FEE_BPS = 100;
    uint256 public constant MAX_INSTALLMENTS = 24;

    IERC20E public immutable token;
    ITapeOutProcessorE public immutable processor;
    uint256 public immutable circuitId;
    bytes32 public immutable netlistHash;
    address public immutable buyer;
    address public immutable seller;
    address public immutable referee;   // zero address = no referee, holds are not allowed
    uint256 public immutable installment; // amount per installment
    uint256 public immutable count;
    uint256 public immutable interval;  // seconds between installments (installment k is due at start + (k+1) * interval)
    uint256 public immutable grace;     // response window after the due time, seconds
    bytes32 public immutable termsHash; // SHA-256 fingerprint of the written terms both sides read
    address public immutable feeRecipient;
    uint256 public immutable feeBps;

    bool public accepted;
    bool public funded;
    uint256 public start;
    mapping(uint256 => bool) public approved;
    mapping(uint256 => bool) public held;
    mapping(uint256 => bool) public settled;
    mapping(uint256 => bool) public refSeller;
    mapping(uint256 => bool) public refBuyer;
    mapping(uint256 => bool) public sellerRefunds;

    event Accepted(address indexed seller, bytes32 termsHash);
    event Locked(uint256 amount, uint256 fee, uint256 start);
    event Approved(uint256 indexed k);
    event Held(uint256 indexed k);
    event Decided(uint256 indexed k, bool toSeller);
    event RefundOffered(uint256 indexed k);
    event PaidToSeller(uint256 indexed k, address indexed seller, uint256 amount);
    event ReturnedToBuyer(uint256 indexed k, address indexed buyer, uint256 amount);

    error NotBuyer();
    error NotSeller();
    error NotReferee();
    error BadParams();
    error WrongOrder();
    error RuleSaysNo();
    error RuleChanged();

    constructor(
        IERC20E token_,
        ITapeOutProcessorE processor_,
        uint256 circuitId_,
        address seller_,
        address referee_,
        uint256 installment_,
        uint256 count_,
        uint256 interval_,
        uint256 grace_,
        bytes32 termsHash_,
        address feeRecipient_,
        uint256 feeBps_
    ) {
        if (seller_ == address(0) || seller_ == msg.sender || installment_ == 0) revert BadParams();
        if (count_ == 0 || count_ > MAX_INSTALLMENTS || interval_ < 60) revert BadParams();
        if (referee_ == msg.sender || referee_ == seller_) revert BadParams();
        if (feeBps_ > MAX_FEE_BPS || (feeBps_ > 0 && feeRecipient_ == address(0))) revert BadParams();
        token = token_;
        processor = processor_;
        circuitId = circuitId_;
        netlistHash = keccak256(processor_.netlist(circuitId_));
        buyer = msg.sender;
        seller = seller_;
        referee = referee_;
        installment = installment_;
        count = count_;
        interval = interval_;
        grace = grace_;
        termsHash = termsHash_;
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
    }

    function total() public view returns (uint256) {
        return installment * count;
    }

    function fee() public view returns (uint256) {
        return (total() * feeBps) / 10_000;
    }

    function dueAt(uint256 k) public view returns (uint256) {
        return start + (k + 1) * interval;
    }

    function windowEnd(uint256 k) public view returns (uint256) {
        return dueAt(k) + grace;
    }

    /// @notice The seller signs: they accept exactly these terms (the fingerprint fixed at creation).
    function accept() external {
        if (msg.sender != seller) revert NotSeller();
        if (accepted) revert WrongOrder();
        accepted = true;
        emit Accepted(seller, termsHash);
    }

    /// @notice The buyer locks the full amount (plus the small fee) once, after the seller accepted. This starts the clock.
    function fund() external {
        if (msg.sender != buyer) revert NotBuyer();
        if (!accepted || funded) revert WrongOrder();
        funded = true;
        start = block.timestamp;
        uint256 f = fee();
        require(token.transferFrom(msg.sender, address(this), total()), "transfer failed");
        if (f > 0) require(token.transferFrom(msg.sender, feeRecipient, f), "transfer failed");
        emit Locked(total(), f, start);
    }

    function _open(uint256 k) internal view {
        if (k >= count || !funded || settled[k]) revert WrongOrder();
    }

    /// @notice The buyer says this installment's work arrived as agreed. It can then be paid to the seller right away.
    function approve(uint256 k) external {
        if (msg.sender != buyer) revert NotBuyer();
        _open(k);
        if (held[k]) revert WrongOrder();
        approved[k] = true;
        emit Approved(k);
    }

    /// @notice The buyer disputes an installment before its response window ends. Needs a referee.
    function hold(uint256 k) external {
        if (msg.sender != buyer) revert NotBuyer();
        _open(k);
        if (referee == address(0) || approved[k] || held[k] || block.timestamp >= windowEnd(k)) revert WrongOrder();
        held[k] = true;
        emit Held(k);
    }

    /// @notice The referee decides a held installment.
    function decide(uint256 k, bool toSeller) external {
        if (msg.sender != referee) revert NotReferee();
        _open(k);
        if (!held[k] || refSeller[k] || refBuyer[k]) revert WrongOrder();
        if (toSeller) refSeller[k] = true; else refBuyer[k] = true;
        emit Decided(k, toSeller);
    }

    /// @notice The seller agrees to give an installment back to the buyer.
    function offerRefund(uint256 k) external {
        if (msg.sender != seller) revert NotSeller();
        _open(k);
        sellerRefunds[k] = true;
        emit RefundOffered(k);
    }

    function _eval(uint256 k) internal view returns (uint8) {
        if (keccak256(processor.netlist(circuitId)) != netlistHash) revert RuleChanged();
        uint16 v = (funded ? 1 : 0) | (accepted ? 2 : 0) | (funded && block.timestamp >= windowEnd(k) ? 4 : 0) | (approved[k] ? 8 : 0)
            | (held[k] ? 16 : 0) | (settled[k] ? 32 : 0) | (refSeller[k] ? 64 : 0) | (refBuyer[k] ? 128 : 0) | (sellerRefunds[k] ? 256 : 0);
        bytes memory input = new bytes(2);
        input[0] = bytes1(uint8(v));
        input[1] = bytes1(uint8(v >> 8));
        (bool ok, bytes memory ret) =
            address(processor).staticcall{gas: EVAL_GAS}(abi.encodeCall(ITapeOutProcessorE.eval, (circuitId, input)));
        if (!ok) revert RuleSaysNo();
        bytes memory out = abi.decode(ret, (bytes));
        if (out.length != 1) revert RuleSaysNo();
        return uint8(out[0]);
    }

    /// @notice Anyone may ask for an installment to be paid to the seller. The circuit decides; it always goes to the seller.
    function release(uint256 k) external {
        if (k >= count) revert WrongOrder();
        if ((_eval(k) & 1) == 0) revert RuleSaysNo();
        settled[k] = true;
        require(token.transfer(seller, installment), "transfer failed");
        emit PaidToSeller(k, seller, installment);
    }

    /// @notice Anyone may ask for an installment to go back to the buyer. The circuit decides; it always goes to the buyer.
    function refund(uint256 k) external {
        if (k >= count) revert WrongOrder();
        if ((_eval(k) & 2) == 0) revert RuleSaysNo();
        settled[k] = true;
        require(token.transfer(buyer, installment), "transfer failed");
        emit ReturnedToBuyer(k, buyer, installment);
    }
}
