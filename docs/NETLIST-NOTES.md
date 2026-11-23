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
