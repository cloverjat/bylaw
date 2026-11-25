# Future testing (real money)

Real-money tests cost USDC and OKB, so they are queued here and run together later. Mark each one with the date and the result.

## Bylaw Wallet, live on X Layer
- [ ] Create a **Daily spending cap** wallet (step 1 USDC, limit 1) from the website.
- [ ] Deposit 1 USDC. Send 0.6 USDC to another address: it must go through.
- [ ] Send 0.6 USDC again the same day: the page must refuse it ("The public rule said NO"), no popup, no money moved.
- [ ] Check the fee wallet `0x84bd…06e9` received 0.0006 USDC (0.1% of the 0.6 sent).
- [ ] Create a **Trusted recipients** wallet: save a recipient, try a small amount before and after the waiting time, try a big amount to a new address (must be refused).
- [ ] Create a **Big payments need a second person** wallet with a second address: payment above the limit needs Propose, then Confirm from the second wallet, then Send.
- [ ] Try to send an amount the wallet cannot cover together with the fee: must be refused whole.

## Savings circle and payroll
- [ ] Make one small circle and one small payroll after the fee-wallet switch and confirm the 1% reaches `0x84bd…06e9`.
- [ ] Pay out the old test circle `0x8d15e0ec20b56ccac0afe59fab188d0b72d2a3f5` (0.03 USDC waiting).
- [ ] Cold test: a person who has never seen Bylaw creates and uses a circle with no help.

## Checks that cost nothing (already done)
- Wallet rule circuits #8, #9 and #10 answered correctly on all 270 inputs tried against X Layer.
- Contract tests (wallet, circle, payroll) and website encoding tests pass.
