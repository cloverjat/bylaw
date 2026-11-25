# Bylaw: rules your money can't break

## The problem
Money mistakes on-chain are final. Address-poisoning and phishing scams cost victims about $62M in two months of 2026 (ScamSniffer). Rotating savings groups (ROSCAs, found in every region of the world) run on trust in one organizer. AI agents are about to spend on people's behalf, and nobody has a simple, checkable way to limit them.

## The idea
A money rule should be as readable as a sentence, provably correct, and impossible to change quietly. TapeOut circuits on X Layer are public, run for free to check, and cannot call other contracts, which makes them a good home for rules.

## What Bylaw does
1. You pick a rule and fill in numbers. The rule is shown back in plain words.
2. Bylaw builds a NAND circuit and proves it equals the rule on every possible input. You get a certificate.
3. The circuit is taped out on X Layer. Contracts that use it store its hash and refuse to act if it changes.

## Two ways to use it
- **Bylaw Circle:** a savings circle. Members pay a fixed amount each round. A public circuit decides who may be paid and when. The organizer has no admin power over the pot. If someone never pays, the round can be closed after a grace period and payers are refunded.
- **Bylaw Vault:** a wallet that only moves money a rule allows: daily caps, trusted recipients, confirmations for big payments. For people and for AI agents.

## Why a circuit and not normal code
The rule is data anyone can read and re-run for free. It is proven on all inputs, reusable by any contract, and cannot be upgraded behind your back. Normal contract code can do none of these cheaply.

## What is honest about v1
Experimental and unaudited. Amounts are small whole units because exhaustive proof only scales to about 24 input pins. TapeOut is itself unaudited and owner-upgradeable, so Bylaw checks the circuit hash on every use. Order of payouts is fixed by the member list.

## Fees

Circles and payroll charge 1%, and Bylaw Wallet payments carry a 0.1% fee on top. The rates are written into each contract when it is created and cannot be changed afterwards. Full details, the fee wallet and examples are in [FEES.md](FEES.md).

## Roadmap
Tape out on X Layer, deploy a live three-person Circle, ship the Vault, add an AI helper for the English-to-rule step (the proof checks its output, so it is never trusted), then private deposits with stealth addresses.
