# Bylaw fees

Everything Bylaw charges, in one place. The website stays clean; this page is the full detail.

## Rates

| Product | Fee | Who pays | How it is taken |
|---|---|---|---|
| Savings circle | **1%** of each pot | The pot (members never pay extra) | Taken from the pot when it is paid out, sent to the fee wallet in the same transaction |
| Payroll | **1%** of the payroll total | The employer, once, when funding | The employer approves and funds `total + fee`; the fee goes to the fee wallet at funding |
| Escrow (agreement) | **1%** of the deal amount | The buyer, once, when locking the money | The buyer approves and locks `amount + fee`; the fee goes to the fee wallet when locking |
| Bylaw Wallet | **0.1%** of each payment | The wallet owner | Added **on top** of the payment from the wallet's balance. The recipient always receives the full amount. The fee does not count toward the daily cap or the second-person limit |
| Creating a circle, payroll or wallet | No Bylaw fee | | Only the network gas in OKB |
| Reading, proving rules, the website | Free | | |

## Where the money goes

New circles, payrolls and wallets pay to the Bylaw revenue wallet:

`0x84bd6e322833ceba08fa5130580d5b1f2fb406e9` (X Layer)

Anyone can check what it has received on the X Layer explorer. Contracts created before 2026-11-25 (the demo circle, the test circle `0x8d15…a3f5` and the test payroll) pay the earlier dev wallet `0x11BccB28A40ee64EA0eebC3199b9B00D5359e7de`. The website treats both wallets as official.

## What cannot change

- The fee rate and the fee wallet are written into each contract when it is created. Nobody, including Bylaw, can change them afterwards for an existing circle, payroll or wallet.
- The contracts cap the fee at 1%. A wallet created with a higher rate would be refused by the contract.
- A contract that points fees at any other wallet is flagged with a warning on its page.

## Examples

- A circle of 5 people paying 10 USDC has a 50 USDC pot. The fee is 0.50 USDC and the winner receives 49.50 USDC.
- A payroll paying 4 workers 250 USDC a cycle for 4 cycles totals 4,000 USDC. The employer funds 4,040 USDC, including the 40 USDC fee.
- A Bylaw Wallet sends 100 USDC. The recipient gets 100 USDC and the wallet pays 0.10 USDC to the fee wallet.

## Why these rates

Savings circles and payroll are coordination services, and 1% is in line with comparable payment tools (flat per-payout fees such as 2.50 USD, or monthly plans, are common). Wallet payments carry a much smaller fee because people expect to move their own money cheaply. Fees on future advanced features may be higher and will be listed here before they are switched on.

## Ideas under consideration (not live)

- A share of the fee for people who bring a circle or payroll to Bylaw (referral).
- Partner or integrator fees for apps and communities that embed Bylaw.
- Paid custom rules for teams.
- A public revenue page that reads the fee wallet on-chain.

## Change log

- 2026-11-25: new revenue wallet. Circles 1%, payroll 1%, wallet 0.1% on top.
- 2026-11-24: first deployments. 1% on circles and payroll to the dev wallet. No fee on wallets (they did not exist yet).
