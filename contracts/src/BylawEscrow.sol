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
/// @notice A two-person agreement (buy something, hire someone, sign a deal). The buyer and seller are fixed at creation,
///         together with the amount, the deadline and the hash of the written terms. The seller accepts the terms
///         on-chain (their signature), the buyer locks the money, and from then on a public TapeOut circuit decides:
///         the money goes to the seller only after the buyer approves, and goes back to the buyer if the deadline
///         passes without approval or if the seller agrees to refund. Nobody else can move it, not even us.
/// @dev Experimental and unaudited. The circuit's netlist hash is frozen at creation and re-checked on every settlement.
contract BylawEscrow {
    uint256 public constant EVAL_GAS = 3_000_000;
    uint256 public constant MAX_FEE_BPS = 100;

    IERC20E public immutable token;
    ITapeOutProcessorE public immutable processor;
    uint256 public immutable circuitId;
    bytes32 public immutable netlistHash;
    address public immutable buyer;
    address public immutable seller;
    uint256 public immutable amount;
    uint256 public immutable duration; // seconds after funding until the buyer can be refunded
    bytes32 public immutable termsHash; // SHA-256 fingerprint of the written terms both sides read
    address public immutable feeRecipient;
    uint256 public immutable feeBps;

    bool public accepted;      // seller accepted the terms
    bool public funded;
    bool public approved;      // buyer approved the delivery
    bool public sellerRefunds; // seller agreed to give the money back
    bool public settled;
    uint256 public deadline;   // set when funded

    event Accepted(address indexed seller, bytes32 termsHash);
    event Locked(uint256 amount, uint256 fee, uint256 deadline);
    event Approved();
    event RefundOffered();
    event PaidToSeller(address indexed seller, uint256 amount);
    event ReturnedToBuyer(address indexed buyer, uint256 amount);

    error NotBuyer();
    error NotSeller();
    error BadParams();
    error WrongOrder();
    error RuleSaysNo();
    error RuleChanged();

    constructor(
        IERC20E token_,
        ITapeOutProcessorE processor_,
        uint256 circuitId_,
        address seller_,
        uint256 amount_,
        uint256 duration_,
        bytes32 termsHash_,
        address feeRecipient_,
        uint256 feeBps_
    ) {
        if (seller_ == address(0) || seller_ == msg.sender || amount_ == 0 || duration_ < 60) revert BadParams();
        if (feeBps_ > MAX_FEE_BPS || (feeBps_ > 0 && feeRecipient_ == address(0))) revert BadParams();
        token = token_;
        processor = processor_;
        circuitId = circuitId_;
        netlistHash = keccak256(processor_.netlist(circuitId_));
        buyer = msg.sender;
        seller = seller_;
        amount = amount_;
        duration = duration_;
        termsHash = termsHash_;
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
    }

    function fee() public view returns (uint256) {
        return (amount * feeBps) / 10_000;
    }

    /// @notice The seller signs: they accept exactly these terms (the hash fixed at creation).
    function accept() external {
        if (msg.sender != seller) revert NotSeller();
        if (accepted) revert WrongOrder();
        accepted = true;
        emit Accepted(seller, termsHash);
    }

    /// @notice The buyer locks the money (plus the small fee). Only after the seller accepted.
    function fund() external {
        if (msg.sender != buyer) revert NotBuyer();
        if (!accepted || funded) revert WrongOrder();
        funded = true;
        deadline = block.timestamp + duration;
        uint256 f = fee();
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");
        if (f > 0) require(token.transferFrom(msg.sender, feeRecipient, f), "transfer failed");
        emit Locked(amount, f, deadline);
    }

    /// @notice The buyer says the work or goods arrived as agreed. This lets the money go to the seller.
    function approve() external {
        if (msg.sender != buyer) revert NotBuyer();
        if (!funded || settled) revert WrongOrder();
        approved = true;
        emit Approved();
    }

    /// @notice The seller agrees to give the money back to the buyer.
    function offerRefund() external {
        if (msg.sender != seller) revert NotSeller();
        if (!funded || settled) revert WrongOrder();
        sellerRefunds = true;
        emit RefundOffered();
    }

    function _eval() internal view returns (uint8) {
        if (keccak256(processor.netlist(circuitId)) != netlistHash) revert RuleChanged();
        uint8 v = (funded ? 1 : 0) | (accepted ? 2 : 0) | (approved ? 4 : 0) | (funded && block.timestamp >= deadline ? 8 : 0)
            | (sellerRefunds ? 16 : 0) | (settled ? 32 : 0);
        bytes memory input = new bytes(1);
        input[0] = bytes1(v);
        (bool ok, bytes memory ret) =
            address(processor).staticcall{gas: EVAL_GAS}(abi.encodeCall(ITapeOutProcessorE.eval, (circuitId, input)));
        if (!ok) revert RuleSaysNo();
        bytes memory out = abi.decode(ret, (bytes));
        if (out.length != 1) revert RuleSaysNo();
        return uint8(out[0]);
    }

    /// @notice Anyone may ask for the money to go to the seller. The circuit decides; it always goes to the seller.
    function release() external {
        if ((_eval() & 1) == 0) revert RuleSaysNo();
        settled = true;
        require(token.transfer(seller, amount), "transfer failed");
        emit PaidToSeller(seller, amount);
    }

    /// @notice Anyone may ask for the money to go back to the buyer. The circuit decides; it always goes to the buyer.
    function refund() external {
        if ((_eval() & 2) == 0) revert RuleSaysNo();
        settled = true;
        require(token.transfer(buyer, amount), "transfer failed");
        emit ReturnedToBuyer(buyer, amount);
    }
}
