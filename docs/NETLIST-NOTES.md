# TapeOut netlist notes

Source: third-party reverse engineering (xm1319/tapemkt NETLIST-FORMAT.md) and
the CircuitWill interface notes. Not yet confirmed by a Bylaw tape-out. Re-check
on the first real tape-out before relying on any detail.

- NAND = `0x00 | u24 a | u24 b` (7 bytes). LATCH = `0x01 | u24 d`. REF = `0x02 | addr20 | u64 id | u8 nIn | u8 nOut | nIn x u24`.
- Signal 0 = const 0, signal 1 = const 1, input i = 2+i, gate g = 2+nIn+g. Gates in topological order.
- Outputs are the last nOut signals. Bylaw ends every circuit with double inverters so this holds.
- `eval(uint256 id, bytes inputs)` returns `bytes`. Bit-packed, bit 0 = first pin.
- Tape-out fee about 0.0013 OKB (observed by others on a fork).
- Eval gas is high: about 1.07M for a 447-gate circuit. Keep rule circuits small.

## Bylaw Circle rule (circuit 1)
58 NAND gates, 17 input pins, 1 output. Proven over all 131,072 inputs
(`compiler/test/circle.test.mjs`). Pins: 0-3 recipient index, 4-7 round index,
8-11 paid count, 12-15 member count, 16 window open. Output 1 only when
recipient == round AND paid == members AND window open.

## Known v1 limits of BylawCircle
- Payout order is fixed by the member list given at creation (public, no randomness).
- If a member never pays, the round can be closed after a 7 day grace period and only
  the current round's payers get refunds. Earlier rounds are not clawed back.
- Max 15 members. One ERC-20. Tested only on a mock TapeOut so far, not X Layer.
- Unaudited.
