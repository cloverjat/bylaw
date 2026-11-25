// Where Bylaw's fees go. Fees are fixed inside each contract when it is created, so changing this only affects NEW circles, payrolls and wallets.
export const FEE_WALLET = '0x84bd6e322833ceba08fa5130580d5b1f2fb406e9'; // Bylaw revenue wallet (from 2026-11-25)
export const OLD_FEE_WALLET = '0x11bccb28a40ee64ea0eebc3199b9b00d5359e7de'; // dev wallet: still the recipient of the circles and payrolls made before the switch
export const CIRCLE_FEE_BPS = 100; // 1% of each pot
export const PAYROLL_FEE_BPS = 100; // 1% of the payroll total
export const WALLET_FEE_BPS = 10; // 0.1% added on top of each wallet payment
export const ESCROW_FEE_BPS = 100; // 1% of the deal amount, added on top when the buyer locks the money
