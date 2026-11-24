# Bylaw

**Rules your money can't break.**

Pick a money rule, read it back in plain words, and Bylaw proves the circuit matches it on every possible input. The circuit is then locked on X Layer using TapeOut, so nobody can quietly change it, not even us.

> Status: early build for the OKX Build X "X Layer TapeOut Accelerate" hackathon. **Experimental and unaudited. Savings circle and payroll are live on X Layer mainnet (see docs/DEPLOYMENTS.md).** Do not use with money you can't lose.

## What works today

| Piece | State |
|---|---|
| Netlist builder, simulator, exhaustive prover (`compiler/`) | Working, tested |
| Rule specs and proof certificates (`compiler/src/spec.mjs`, `certificate.mjs`) | Working, tested |
| Four free rule templates: circle payout, daily cap, trusted recipients, confirm big payments | Working, every one proven over all inputs |
| Web demo that proves rules in the browser (`web/`) | Working |
| **Bylaw Circle**, a savings circle where a public circuit decides who gets paid (`contracts/src/BylawCircle.sol`) | Tested end to end on a mock TapeOut. No owner or admin functions |
| Tape-out and deploy on X Layer | Done: circuit #6 (circle) and #7 (payroll) on processor #29, both run end to end (docs/DEPLOYMENTS.md) |
| Website (`web/`): simple view for everyone, developer view for engineers. Create a circle, connect a wallet, pay in, see the rule, run the prover | Working on X Layer mainnet; tested end to end with a circle created from the site |
| **Bylaw Payroll**: the employer funds once, a public circuit releases each worker's pay each cycle, nothing can be edited, unclaimed money returns to the employer only 90 days after the end (`contracts/src/BylawPayroll.sol`, rule = circuit #7) | Live on X Layer; test payroll paid out end to end from the website |
| Directory of public circles by name, vault rules (daily cap, trusted recipients, confirm-big), privacy layer | Planned, not built. The vault rules are written and proven but no contract enforces them yet |

## How it works

1. A rule is written as a small readable spec (`compiler/src/templates.mjs`).
2. The compiler turns it into a NAND circuit in the TapeOut byte format.
3. An independent checker evaluates the circuit on **every** input and compares it with the spec. The result is a certificate.
4. The circuit is taped out on X Layer. The Circle contract stores the circuit's hash and refuses to pay out if the circuit ever changes.

The proof shows the circuit matches the rule. It cannot tell you whether the rule is what you meant, so Bylaw always shows the rule back as a sentence.

## Run it

```
cd compiler && npm test        # 18 tests: compiler, prover, templates
cd contracts && npm i && npm test   # Circle contract, end to end on an in-memory chain
cd web && npm i && npm run build    # writes web/dist/index.html
```

## Layout

| Folder | What it holds |
|---|---|
| `compiler/` | Spec to circuit, prover, certificates, templates |
| `contracts/` | `BylawCircle.sol`, `BylawPayroll.sol`, test mocks |
| `web/` | Single-file demo page |
| `docs/` | Litepaper, demo script, netlist notes |

## Known limits

- Exhaustive proof works up to about 24 input pins, so amounts are small whole units for now.
- The TapeOut netlist format comes from third-party reverse engineering and will be re-checked on the first real tape-out.
- TapeOut itself is unaudited and its factory is upgradeable.

## License

MIT. Not affiliated with OKX or TapeOut.
