# Bylaw

**Rules your money can't break.**

Write a money rule in plain English. Bylaw turns it into a circuit, checks it against every possible input, and locks it on X Layer using TapeOut. Nobody can change a locked rule, not even us.

- **Bylaw Vault:** a vault that only moves money its rule allows. For wallets and AI agents.
- **Bylaw Circle:** a savings circle where a public rule decides payout order and timing, so the organizer can't take the pot.
- **Bylaw Veil:** (stretch) private deposits and payouts using stealth addresses.

> Status: early build for the OKX Build X "X Layer TapeOut Accelerate" hackathon. Experimental and unaudited. Do not use with funds you can't lose.

## Layout

| Folder | What it holds |
|---|---|
| `contracts/` | Solidity contracts and tests (Foundry) |
| `compiler/` | Plain-English rule to circuit, plus the exhaustive prover |
| `web/` | Chat front door |
| `mcp/` | AI assistant connector |
| `docs/` | Design notes and the litepaper |

## License

MIT
