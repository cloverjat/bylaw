// Bylaw Wallet: create, read, deposit, send, save recipients, propose / confirm / execute. Runs in the browser against X Layer.
import { WALLET_BYTECODE } from './wallet-bytecode.mjs';
import { call, send, pad, num, addr, ERRORS } from './circle.mjs';
import { FEE_WALLET, WALLET_FEE_BPS } from './fees.mjs';

// Circuit ids on TapeOut processor My 4004 #29 (X Layer). Taped out and tested on-chain.
export const WALLET_CIRCUITS = { 1: 10, 2: 9, 3: 8 };
export const WALLET_DEFAULTS = {
  token: '0xB6CEceAB302E2E4948951eE7843FC24E92933061',
  processor: '0x526B96238cc418d909005e2E2D79e327da4BD0f7',
  feeRecipient: FEE_WALLET,
  feeBps: WALLET_FEE_BPS,
};
export const KIND_NAME = { 1: 'Daily spending cap', 2: 'Trusted recipients, small first payments', 3: 'Big payments need a second person' };
export const MAX_UNITS = 63;
// The fee is added on top of a payment, from the wallet's own balance. Same rounding as the contract (down).
export const feeOf = (base, bps) => Math.floor((base * bps) / 10000);
export const TRUST_DELAY = 2 * 86400;

const S = {
  token: '0xfc0c546a', processor: '0xce1b1d43', circuitId: '0x030c9d5c', netlistHash: '0x543862ee', owner: '0x8da5cb5b', kind: '0x04baa00b',
  unit: '0x907af6c0', limitA: '0x1f9d4eeb', limitB: '0x701dc3bf', confirmer: '0x6fc3c817', spentNow: '0xa739b50f', addedAt: '0x0c46b81a',
  proposals: '0x013cf08b', proposalCount: '0xda35c664', balance: '0xb69ef8a8', send: '0xd0679d34', saveRecipient: '0x0d512790',
  propose: '0x589de5df', confirm: '0xba0179b5', execute: '0xfe0d94c1', transfer: '0xa9059cbb', feeBps: '0x24a9d853', feeRecipient: '0x46904840',
};
const WALLET_ERRORS = {
  ...ERRORS,
  '0x30cd7471': 'Only the owner of this wallet can do this.',
  '0x8ec154d4': 'Only the person chosen to confirm can do this.',
  '0x019af637': 'Those settings or that address or amount are not valid.',
  '0x8aa0e18c': 'That amount is above 63 steps of this wallet, so it is too large for the rule to check.',
  '0x81a15a08': 'The public rule said NO. The payment is not allowed under this wallet\'s rule right now, so no money was sent.',
  '0x968454df': 'The public rule was changed after this wallet was created, so payments are blocked.',
  '0x35a08a07': 'That action does not exist for this kind of wallet.',
  '0xe471069a': 'The second person has not confirmed this payment yet.',
  '0xbdb90210': 'That payment was already done.',
};
const w = (v) => BigInt(v).toString(16).padStart(64, '0');
const a = (x) => x.toLowerCase().replace(/^0x/, '').padStart(64, '0');

// Amounts are typed in USDC and counted by the wallet in "steps" (unit). The wallet rounds UP, so the rule is never looser than the real amount.
export const toBase = (usdc) => Math.round(Number(usdc) * 1e6);
export const unitsOf = (base, unit) => Math.ceil(base / unit);
export const UNIT_CHOICES = [1, 5, 10, 100];

export function validateWallet({ kind, unitUsdc, limitA, limitB, confirmer, owner }) {
  if (![1, 2, 3].includes(kind)) return 'Pick a rule.';
  if (!UNIT_CHOICES.includes(unitUsdc)) return 'Pick a step size.';
  if (!Number.isInteger(limitA) || limitA < 1 || limitA > MAX_UNITS) return `The limit must be a whole number from 1 to ${MAX_UNITS}.`;
  if (kind === 2 && (!Number.isInteger(limitB) || limitB < 0 || limitB > MAX_UNITS)) return `The waiting time must be a whole number of hours from 0 to ${MAX_UNITS}.`;
  if (kind === 3) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(confirmer || '')) return 'Enter the wallet address of the person who must confirm big payments (starts with 0x, 42 characters).';
    if (owner && confirmer.toLowerCase() === owner.toLowerCase()) return 'The second person must be a different wallet from yours.';
  }
  return null;
}
export function walletSentence({ kind, unitUsdc, limitA, limitB, confirmer, feeBps }) {
  const cap = limitA * unitUsdc;
  if (kind === 1) return `This wallet can send at most ${cap} USDC a day, in total. Any payment that would go over is refused, even if the owner's key is stolen. Amounts are counted in steps of ${unitUsdc} USDC and rounded up.`;
  if (kind === 2) return `A saved recipient becomes trusted after 2 days and can be paid any amount. A brand-new recipient can get at most ${cap} USDC, and only after ${limitB} hour${limitB === 1 ? '' : 's'} have passed since you saved them. Amounts are counted in steps of ${unitUsdc} USDC and rounded up.`;
  return `Payments up to ${cap} USDC go straight through. Anything above that needs ${confirmer ? confirmer.slice(0, 6) + '…' + confirmer.slice(-4) : 'a second person'} to confirm it first. Amounts are counted in steps of ${unitUsdc} USDC and rounded up.`;
}
export function walletDeployData({ kind, unitUsdc, limitA, limitB, confirmer }) {
  const D = WALLET_DEFAULTS;
  const head = [a(D.token), a(D.processor), w(WALLET_CIRCUITS[kind]), w(kind), w(unitUsdc * 1e6), w(limitA), w(kind === 2 ? limitB : 0), a(kind === 3 ? confirmer : '0x0'), a(D.feeRecipient), w(D.feeBps)].join('');
  return WALLET_BYTECODE + head;
}

export async function readWallet(c) {
  const g = (sel, ...args) => call(c, sel + args.map((x) => pad(x)).join(''));
  const [token, processor, circuitId, owner, kind, unit, limitA, limitB, confirmer, spent, balance, count, netlistHash, feeBps, feeRecipient] = await Promise.all([
    g(S.token), g(S.processor), g(S.circuitId), g(S.owner), g(S.kind), g(S.unit), g(S.limitA), g(S.limitB), g(S.confirmer), g(S.spentNow), g(S.balance), g(S.proposalCount), g(S.netlistHash), g(S.feeBps), g(S.feeRecipient),
  ]);
  const n = num(count);
  const proposals = await Promise.all([...Array(n).keys()].map(async (i) => {
    const r = (await g(S.proposals, i.toString(16))).slice(2);
    return { id: i, to: addr(r.slice(0, 64)), amount: parseInt(r.slice(64, 128), 16), confirmed: parseInt(r.slice(128, 192), 16) === 1, executed: parseInt(r.slice(192, 256), 16) === 1 };
  }));
  return {
    token: addr(token), processor: addr(processor), circuitId: num(circuitId), owner: addr(owner), kind: num(kind), unit: num(unit), limitA: num(limitA), limitB: num(limitB),
    confirmer: addr(confirmer), spent: num(spent), balance: num(balance), proposals, netlistHash, feeBps: num(feeBps), feeRecipient: addr(feeRecipient),
  };
}
export const savedAt = (c, to) => call(c, S.addedAt + pad(to)).then(num);
export const tokenBalance = (s, who) => call(s.token, '0x70a08231' + pad(who)).then(num);

const sendW = (from, to, data) => send(from, to, data, WALLET_ERRORS);
export const walletActions = {
  deposit: (from, c, s, base) => sendW(from, s.token, S.transfer + pad(c) + w(base)),
  send: (from, c, s, to, base) => sendW(from, c, S.send + pad(to) + w(base)),
  saveRecipient: (from, c, s, to) => sendW(from, c, S.saveRecipient + pad(to)),
  propose: (from, c, s, to, base) => sendW(from, c, S.propose + pad(to) + w(base)),
  confirm: (from, c, s, id) => sendW(from, c, S.confirm + w(id)),
  execute: (from, c, s, id) => sendW(from, c, S.execute + w(id)),
};
