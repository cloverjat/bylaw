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

## Demo circle run (X Layer mainnet, 2026-11-24)

Circle `0x0a9721d77a9e378e0d968a862a9dd85488392628`, built with solc 0.8.39 (the code's metadata hash matches a fresh build of this repo).

- Members A, B, C each approved and contributed 0.01 USDC (circle held 0.03 USDC).
- A payout to the wrong member (index 1 in round 0) reverts with `RuleSaysNo` (`0x81a15a08`): the circuit refuses it.
- `payout(0)` by the dev wallet: tx `0xc1b1fa02c570ca4c705ee33622d2049d94ba4c8f0f521432003083e74bfeabf1`. Member A received 0.0297 USDC, fee recipient received 0.0003 USDC (1%). Circle balance 0, round 1.
- The circuit pays only when ALL of these hold: the recipient is the member whose turn it is, every member has paid this round, and the round's time is over. (Round 0's payout worked because its time had already passed. Everyone paid but time not over, or someone missing, gives `RuleSaysNo`.)

## Circle created from the website (X Layer mainnet, 2026-11-24)

Circle `0x8d15e0ec20b56ccac0afe59fab188d0b72d2a3f5`, created with the "Create a circle" screen of https://bylaw-build.netlify.app from the dev wallet. Same code as the demo circle (identical metadata hash), 3 members (Clover `0x11Bc…e7de`, Tobi `0xaf37…f5dc`, Briggs `0x9a07…067a`), 0.01 USDC per round, 1800 s rounds, 1% fee, circuit #6.

- All three members approved and paid through the website's own button (3 of 3 paid in round 0).
- A payout attempt with everyone paid but the round time not over reverts with `RuleSaysNo` (`0x81a15a08`).
- The website shows names from the share link (`?circle=…&names=…`); names are not stored on-chain.


## Payroll (Nov 24 2026)

- Rule circuit: TapeOut processor My 4004 #29 (`0x526b96238cc418d909005e2e2d79e327da4bd0f7`), **circuit #7**, 50 NAND gates, 350 bytes, 11 inputs, 1 output. Allow a payment only if: cycle < number of cycles AND the cycle is due AND the payroll is funded AND the worker is not yet paid for that cycle. Source: `compiler/src/payroll.mjs`, drawing: `docs/circuits/bylaw-payroll-rule.canvas.json`.
- Checked on the live chain: the five spot cases behave as specified, and 1,590 of the 2,048 input combinations were compared with the reference with zero mismatches (the public RPC then rate-limited the rest).
- Test payroll created from the website: `0x2ff6430fb315136f5d2711542f71834345cf86d7` (2 workers, 0.004 USDC each per cycle, 2-minute cycles, 2 cycles). Funded by the employer wallet, then all four payments released from the website. A third cycle is refused by the circuit.

## Revenue wallet and fee rates (from 2026-11-25)

Fees are fixed inside each contract when it is created, so the table below only applies to contracts made after the switch.

| Product | Fee | Paid to |
|---|---|---|
| Savings circle | 1% of each pot | `0x84bd6e322833ceba08fa5130580d5b1f2fb406e9` |
| Payroll | 1% of the payroll total | same wallet |
| Bylaw Wallet | 0.1% added on top of each payment (recipient always gets the full amount); hard cap 1% in the contract | same wallet |

Contracts made before the switch (the demo circle, the test circle `0x8d15…a3f5`, the test payroll) keep paying fees to the old dev wallet `0x11BccB28A40ee64EA0eebC3199b9B00D5359e7de`. The website treats both wallets as official.

Wallet rule circuits on TapeOut My 4004 #29: #8 confirm big payments, #9 trusted or small, #10 daily cap. Behaviour checked on-chain with 270 inputs against the reference rules (0 wrong).

## Escrow / Agreement (added 2026-11-25, not yet on mainnet)
- Contract: `contracts/src/BylawEscrow.sol` (buyer, seller, amount, deadline, SHA-256 fingerprint of the written terms). The seller accepts on-chain (their signature), the buyer locks the money, a public rule releases it to the seller only after the buyer approves, and returns it to the buyer after the deadline without approval or if the seller agrees to a refund.
- Rule circuit: `compiler/src/escrow.mjs`, 19 NAND gates, 133 bytes, 6 inputs, 2 outputs. Netlist: `docs/circuits/bylaw-escrow-rule.netlist.hex`, drawing: `docs/circuits/bylaw-escrow-rule.canvas.json`. Proven against its reference table for all 64 inputs.
- Status: needs the circuit taped out on the TapeOut processor (`0x526b…d0f7`), then `ESCROW_DEFAULTS.circuitId` in `web/escrow.mjs` set to the new circuit number.

## Escrow v2 (installments) — pending tape-out

Rule: 29 NAND gates, 9 inputs, 2 outputs, proven for all 512 inputs (docs/circuits/bylaw-escrow-rule.canvas.json).
Contract: BylawEscrow (installments up to 24, once/weekly/biweekly/monthly, buyer approve, 3-day auto-release, hold + optional referee, seller can return a payment). Fee 1% locked once with the funds.
The create button stays off until the circuit number is set in web/escrow.mjs (ESCROW_DEFAULTS.circuitId).

Escrow rule taped out on X Layer: processor My 4004 #29 (0x526b96238cc418d909005e2e2d79e327da4bd0f7), **circuit #11**.
