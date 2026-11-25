// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITapeOutProcessor {
    function eval(uint256 id, bytes calldata inputs) external view returns (bytes memory);
    function netlist(uint256 id) external view returns (bytes memory);
}

interface IERC20Like {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BylawCircle
/// @notice A savings circle (a rotating savings group). Every member pays a fixed amount each round.
///         When the round period has ended and everyone has paid, the pot goes to the
///         member whose turn it is. Who may be paid, and when, is decided only by a
///         public TapeOut circuit. There is no owner, admin, pause or upgrade path.
/// @dev Experimental and unaudited. The circuit is frozen: its netlist hash is stored at
///      creation and re-checked on every payout, so a TapeOut upgrade cannot change the rule.
contract BylawCircle {
    uint256 public constant GRACE = 7 days;
    uint256 public constant STUCK_AFTER = 30 days; // everyone paid but the payout still cannot happen
    uint256 public constant EVAL_GAS = 3_000_000;
    uint8 public constant MAX_MEMBERS = 15;
    uint256 public constant MAX_FEE_BPS = 100; // fee can never exceed 1%

    IERC20Like public immutable token;
    ITapeOutProcessor public immutable processor;
    uint256 public immutable circuitId;
    bytes32 public immutable netlistHash;
    uint256 public immutable contribution;
    uint256 public immutable period;
    uint256 public immutable start;
    address public immutable feeRecipient;
    uint256 public immutable feeBps; // fixed at creation, cannot be changed

    address[] public members;
    uint8 public round;
    uint8 public paidCount;
    bool public failed;
    mapping(uint8 => mapping(address => bool)) public paid;
    mapping(address => bool) public isMember;

    event Contributed(uint8 indexed round, address indexed member);
    event PaidOut(uint8 indexed round, address indexed recipient, uint256 amount);
    event FeePaid(uint8 indexed round, address indexed feeRecipient, uint256 amount);
    event Failed(uint8 indexed round);
    event Refunded(uint8 indexed round, address indexed member, uint256 amount);

    error NotMember();
    error AlreadyPaid();
    error CircleFinished();
    error CircleFailedState();
    error RuleSaysNo();
    error RuleChanged();
    error BadParams();
    error TooEarly();

    constructor(
        IERC20Like token_,
        ITapeOutProcessor processor_,
        uint256 circuitId_,
        address[] memory members_,
        uint256 contribution_,
        uint256 period_,
        address feeRecipient_,
        uint256 feeBps_
    ) {
        if (members_.length < 2 || members_.length > MAX_MEMBERS) revert BadParams();
        if (contribution_ == 0 || period_ < 60) revert BadParams();
        if (feeBps_ > MAX_FEE_BPS || (feeBps_ > 0 && feeRecipient_ == address(0))) revert BadParams();
        for (uint256 i = 0; i < members_.length; i++) {
            address m = members_[i];
            if (m == address(0) || isMember[m]) revert BadParams();
            isMember[m] = true;
            members.push(m);
        }
        token = token_;
        processor = processor_;
        circuitId = circuitId_;
        netlistHash = keccak256(processor_.netlist(circuitId_));
        contribution = contribution_;
        period = period_;
        start = block.timestamp;
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
    }

    function memberCount() public view returns (uint8) {
        return uint8(members.length);
    }

    /// @notice When the current round's period ends.
    function roundEnd() public view returns (uint256) {
        return start + (uint256(round) + 1) * period;
    }

    /// @notice Pay this round's contribution (needs a prior token approval).
    function contribute() external {
        if (failed) revert CircleFailedState();
        if (round >= memberCount()) revert CircleFinished();
        if (!isMember[msg.sender]) revert NotMember();
        if (paid[round][msg.sender]) revert AlreadyPaid();
        paid[round][msg.sender] = true;
        paidCount++;
        require(token.transferFrom(msg.sender, address(this), contribution), "transfer failed");
        emit Contributed(round, msg.sender);
    }

    /// @notice Anyone may propose a recipient. The circuit decides; the contract does not.
    function payout(uint8 recipientIndex) external {
        if (failed) revert CircleFailedState();
        uint8 n = memberCount();
        if (round >= n) revert CircleFinished();
        if (recipientIndex >= n) revert BadParams();
        if (keccak256(processor.netlist(circuitId)) != netlistHash) revert RuleChanged();

        bool windowOpen = block.timestamp >= roundEnd();
        uint24 v = uint24(recipientIndex) | (uint24(round) << 4) | (uint24(paidCount) << 8) | (uint24(n) << 12)
            | (windowOpen ? uint24(1) << 16 : 0);
        bytes memory input = new bytes(3);
        input[0] = bytes1(uint8(v));
        input[1] = bytes1(uint8(v >> 8));
        input[2] = bytes1(uint8(v >> 16));

        (bool ok, bytes memory ret) =
            address(processor).staticcall{gas: EVAL_GAS}(abi.encodeCall(ITapeOutProcessor.eval, (circuitId, input)));
        if (!ok) revert RuleSaysNo();
        bytes memory out = abi.decode(ret, (bytes));
        if (out.length != 1 || (uint8(out[0]) & 1) == 0) revert RuleSaysNo();

        uint8 r = round;
        address to = members[recipientIndex];
        round = r + 1;
        paidCount = 0;
        uint256 pot = contribution * n;
        uint256 fee = (pot * feeBps) / 10_000;
        if (fee > 0) {
            require(token.transfer(feeRecipient, fee), "transfer failed");
            emit FeePaid(r, feeRecipient, fee);
        }
        require(token.transfer(to, pot - fee), "transfer failed");
        emit PaidOut(r, to, pot - fee);
    }

    /// @notice If someone has not paid a week after the round ended, or the payout has been stuck for 30 days
    ///         (for example the public rule changed), anyone can close the circle.
    ///         Members who paid into the stuck round can then take their contribution back.
    function declareFailed() external {
        if (failed) revert CircleFailedState();
        if (round >= memberCount()) revert CircleFinished();
        bool someoneMissing = paidCount < memberCount() && block.timestamp >= roundEnd() + GRACE;
        bool payoutStuck = block.timestamp >= roundEnd() + STUCK_AFTER; // e.g. the rule was changed or broke
        if (!someoneMissing && !payoutStuck) revert TooEarly();
        failed = true;
        emit Failed(round);
    }

    function claimRefund() external {
        if (!failed) revert TooEarly();
        if (!paid[round][msg.sender]) revert NotMember();
        paid[round][msg.sender] = false;
        require(token.transfer(msg.sender, contribution), "transfer failed");
        emit Refunded(round, msg.sender, contribution);
    }
}
