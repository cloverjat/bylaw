# Deployments (X Layer mainnet, chain 196)

## Circle payout rule (TapeOut circuit)
- Processor: My 4004 #29, contract `0x526b96238cc418d909005e2e2d79e327da4bd0f7`
- Circuit ID: 6 (taped out 2026-11-24 by `0x11BccB28A40ee64EA0eebC3199b9B00D5359e7de`)
- 58 NAND, 17 pins -> 1 output, 406 bytes (matches `docs/circuits/bylaw-circle-payout.blif` logic)
- Source of truth: `compiler/src/circle.mjs`; design loaded via the canvas "Open design" format (see NETLIST-NOTES.md)

### On-chain check (eth_call `eval(uint256,bytes)`, id 6)
- recipient=1, round=1, paid=3, members=3, window=1 -> `0x01` (payout allowed)
- same, window=0 -> `0x00` (blocked)

Confirms bit order (pin 0 = LSB, little-endian input bytes) and output convention on mainnet.
