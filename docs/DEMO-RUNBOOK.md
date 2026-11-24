# Demo circle runbook (X Layer mainnet)

Everything on-chain is signed by the wallet owner on their phone (OKX Wallet). Nobody else can sign.

## Setup (once)
- Token: USDT0 `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` (6 decimals)
- Rule: TapeOut processor `0x526b96238cc418d909005e2e2d79e327da4bd0f7`, circuit 6
- Dev wallet (deployer + fee recipient): `0x11BccB28A40ee64EA0eebC3199b9B00D5359e7de`
- 3 demo member wallets (A, B, C). Each needs about 0.02 USDT0 and about 0.003 OKB for gas.

## Deploy with Remix (https://remix.ethereum.org)
1. New file `BylawCircle.sol`, paste `contracts/src/BylawCircle.sol`.
2. Compiler 0.8.26, optimizer on (200 runs), EVM version `paris`. Compile.
3. Deploy tab, environment "WalletConnect", scan the QR with OKX Wallet, pick the dev wallet, network X Layer (196).
4. Constructor values: run `node contracts/scripts/args.mjs <A> <B> <C>` and paste the printed values.
5. Approve the deploy on the phone. Save the contract address.

## Run the circle (round period 300 s)
For each member wallet, one at a time (reconnect WalletConnect to that wallet):
1. USDT0 `approve(circleAddress, 30000)`. This allows 0.03 USDT0, enough for three rounds.
2. Circle `contribute()`.

Then, after the round period has passed and all three have paid:
3. Anyone calls `payout(0)` for round 0 (recipient is member index 0, then 1, then 2).
4. Show the dev wallet receiving the 1% fee.
5. Try `payout(1)` in round 0 or `payout(0)` before the period: it reverts. This is the money shot for the video.

## Checks to show on OKLink
- Circuit 6 on processor 0x526b…d0f7 (netlist 406 bytes).
- Circle contract: `netlistHash`, `feeBps`, `feeRecipient`, no owner or admin functions.
