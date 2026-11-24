// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITapeOutProcessorP {
    function eval(uint256 id, bytes calldata inputs) external view returns (bytes memory);
    function netlist(uint256 id) external view returns (bytes memory);
}

interface IERC20P {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BylawPayroll
/// @notice Set once, then locked. The employer names the workers, what each is paid per cycle,
///         how long a cycle is and how many cycles there are, and funds the total once.
///         After that nobody (not even the employer) can change the terms or take money out early.
///         Each worker's pay for each cycle is released only when a public TapeOut circuit says yes.
///         Anyone can trigger a payment; it always goes to the worker. Money still unclaimed 90 days
///         after the last cycle can be returned to the employer, and only then.
/// @dev Experimental and unaudited. The circuit's netlist hash is frozen at creation and re-checked on every payment.
contract BylawPayroll {
    uint256 public constant RECLAIM_DELAY = 90 days;
    uint256 public constant EVAL_GAS = 3_000_000;
    uint256 public constant MAX_WORKERS = 20;
    uint256 public constant MAX_CYCLES = 15; // the rule circuit has 4 bits for the cycle number
    uint256 public constant MAX_FEE_BPS = 100;

    IERC20P public immutable token;
    ITapeOutProcessorP public immutable processor;
    uint256 public immutable circuitId;
    bytes32 public immutable netlistHash;
    address public immutable boss;
    uint256 public immutable period;
    uint256 public immutable cycles;
    address public immutable feeRecipient;
    uint256 public immutable feeBps;

    address[] public workers;
    uint256[] public amounts; // per worker, per cycle
    uint256 public total;     // everything the workers can ever be paid
    uint256 public paidOut;
    uint256 public start;     // set when funded; cycle k is due at start + (k+1) * period
    bool public funded;
    bool public reclaimed;
    mapping(uint256 => mapping(uint256 => bool)) public paid; // cycle => worker => paid

    event Funded(uint256 total, uint256 fee, uint256 start);
    event Paid(uint256 indexed cycle, address indexed worker, uint256 amount);
    event Reclaimed(uint256 amount);

    error NotBoss();
    error AlreadyFunded();
    error NotFunded();
    error BadParams();
    error RuleSaysNo();
    error RuleChanged();
    error TooEarly();

    constructor(
        IERC20P token_,
        ITapeOutProcessorP processor_,
        uint256 circuitId_,
        address[] memory workers_,
        uint256[] memory amounts_,
        uint256 period_,
        uint256 cycles_,
        address feeRecipient_,
        uint256 feeBps_
    ) {
        if (workers_.length == 0 || workers_.length > MAX_WORKERS || workers_.length != amounts_.length) revert BadParams();
        if (cycles_ == 0 || cycles_ > MAX_CYCLES || period_ < 60) revert BadParams();
        if (feeBps_ > MAX_FEE_BPS || (feeBps_ > 0 && feeRecipient_ == address(0))) revert BadParams();
        uint256 sum;
        for (uint256 i = 0; i < workers_.length; i++) {
            if (workers_[i] == address(0) || amounts_[i] == 0) revert BadParams();
            sum += amounts_[i];
        }
        workers = workers_;
        amounts = amounts_;
        total = sum * cycles_;
        token = token_;
        processor = processor_;
        circuitId = circuitId_;
        netlistHash = keccak256(processor_.netlist(circuitId_));
        boss = msg.sender;
        period = period_;
        cycles = cycles_;
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
    }

    function workerCount() public view returns (uint256) {
        return workers.length;
    }

    function fee() public view returns (uint256) {
        return (total * feeBps) / 10_000;
    }

    /// @notice The employer puts in the full amount (plus the small fee) once. This starts the clock.
    function fund() external {
        if (msg.sender != boss) revert NotBoss();
        if (funded) revert AlreadyFunded();
        funded = true;
        start = block.timestamp;
        uint256 f = fee();
        require(token.transferFrom(msg.sender, address(this), total), "transfer failed");
        if (f > 0) require(token.transferFrom(msg.sender, feeRecipient, f), "transfer failed");
        emit Funded(total, f, start);
    }

    function dueAt(uint256 cycle) public view returns (uint256) {
        return start + (cycle + 1) * period;
    }

    /// @notice Anyone may ask for a worker's pay for a cycle. The circuit decides; the money always goes to the worker.
    function pay(uint256 workerIndex, uint256 cycle) external {
        if (workerIndex >= workers.length || cycle >= 16) revert BadParams();
        if (keccak256(processor.netlist(circuitId)) != netlistHash) revert RuleChanged();

        bool due = funded && block.timestamp >= dueAt(cycle);
        uint16 v = uint16(cycle) | (uint16(cycles) << 4) | (due ? uint16(1) << 8 : 0) | (funded ? uint16(1) << 9 : 0)
            | (!paid[cycle][workerIndex] ? uint16(1) << 10 : 0);
        bytes memory input = new bytes(2);
        input[0] = bytes1(uint8(v));
        input[1] = bytes1(uint8(v >> 8));

        (bool ok, bytes memory ret) =
            address(processor).staticcall{gas: EVAL_GAS}(abi.encodeCall(ITapeOutProcessorP.eval, (circuitId, input)));
        if (!ok) revert RuleSaysNo();
        bytes memory out = abi.decode(ret, (bytes));
        if (out.length != 1 || (uint8(out[0]) & 1) == 0) revert RuleSaysNo();

        paid[cycle][workerIndex] = true;
        uint256 a = amounts[workerIndex];
        paidOut += a;
        require(token.transfer(workers[workerIndex], a), "transfer failed");
        emit Paid(cycle, workers[workerIndex], a);
    }

    /// @notice Only the employer, and only 90 days after the last cycle: take back what workers never claimed.
    function reclaim() external {
        if (msg.sender != boss) revert NotBoss();
        if (!funded) revert NotFunded();
        if (reclaimed || block.timestamp < start + cycles * period + RECLAIM_DELAY) revert TooEarly();
        reclaimed = true;
        uint256 left = total - paidOut;
        if (left > 0) require(token.transfer(boss, left), "transfer failed");
        emit Reclaimed(left);
    }
}
