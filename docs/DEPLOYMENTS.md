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

## Demo BylawCircle (X Layer mainnet, chain 196)
- Contract: `0x0a9721d77a9e378e0d968a862a9dd85488392628` (deployed 2026-11-24, block 76763893, gas 1,346,898)
- Deployer: `0x11BccB28A40ee64EA0eebC3199b9B00D5359e7de` (dev wallet, also the fee recipient)
- Token: native USDC `0xB6CEceAB302E2E4948951eE7843FC24E92933061`; processor `0x526b…d0f7`, circuit 6
- Contribution 0.01 USDC, period 300 s, fee 1% (100 bps), 3 members:
  `0xD60d48db2141dAA6B6DB72dB39EB8f4f449aa3cE`, `0xaf37E03E90Eb379AA70BeF9Fd529C02D483Ff5dc`, `0x9a079fC2B572f4e596B298e3f67285475DbE067a`
- All constructor values read back from the chain and match.
