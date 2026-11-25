// Bylaw Escrow: a two-person agreement. Create, accept, lock the money, approve, release or refund.
import { ESCROW_BYTECODE } from './escrow-bytecode.mjs';
import { call, send, pad, num, addr, ERRORS } from './circle.mjs';
import { FEE_WALLET, ESCROW_FEE_BPS } from './fees.mjs';

export const ESCROW_DEFAULTS = {
  token: '0xB6CEceAB302E2E4948951eE7843FC24E92933061',
  processor: '0x526B96238cc418d909005e2E2D79e327da4BD0f7',
  circuitId: null, // set to the TapeOut circuit number once docs/circuits/bylaw-escrow-rule.* is taped out on X Layer
  feeRecipient: FEE_WALLET,
  feeBps: ESCROW_FEE_BPS,
};
const S = {
  buyer: '0x7150d8ae', seller: '0x08551a53', amount: '0xaa8c217c', duration: '0x0fb5a6b4', termsHash: '0xb311d9fd', fee: '0xddca3f43',
  accepted: '0x67fe5a0c', funded: '0xf3a504f2', approved: '0x19d40b08', sellerRefunds: '0xce8ad941', settled: '0x8f775839', deadline: '0x29dcb0cf',
  accept: '0x2852b71c', fund: '0xb60d4288', approve: '0x12424e3f', offerRefund: '0x9327c643', release: '0x86d1a69f', refund: '0x590e1ae3',
  erc20approve: '0x095ea7b3', allowance: '0xdd62ed3e',
};
const ESC_ERRORS = {
  ...ERRORS,
  '0x472e017e': 'Only the buyer can do this.',
  '0x5ec82351': 'Only the seller can do this.',
  '0x09686b32': 'That step comes at a different time. The seller accepts first, then the buyer locks the money.',
  '0x81a15a08': 'The public rule said NO. The money cannot move that way right now (for example, the buyer has not approved yet, or the deadline has not passed).',
  '0x019af637': 'Those settings are not valid.',
};
const w = (v) => BigInt(v).toString(16).padStart(64, '0');
const a = (x) => x.toLowerCase().replace(/^0x/, '').padStart(64, '0');
export const MAX_TERMS = 600;

export async function termsFingerprint(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return '0x' + [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export function validateEscrow({ seller, buyer, amount, periodSeconds, terms }) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(seller || '')) return 'Enter the seller\'s wallet address (starts with 0x, 42 characters).';
  if (buyer && seller.toLowerCase() === buyer.toLowerCase()) return 'The seller must be a different wallet from yours.';
  if (!(amount > 0) || Math.round(amount * 1e6) < 1) return 'Enter the amount for the deal.';
  if (periodSeconds < 60) return 'The deadline must be at least 1 minute.';
  if (!terms || terms.trim().length < 10) return 'Write the terms of the deal in plain words (at least a short sentence).';
  if (terms.length > MAX_TERMS) return `Keep the terms under ${MAX_TERMS} characters.`;
  return null;
}
export function escrowFee(amount) {
  const raw = Math.round(amount * 1e6);
  return { amount: raw, fee: Math.floor((raw * ESCROW_DEFAULTS.feeBps) / 10000) };
}
export function escrowDeployData({ seller, amount, periodSeconds, termsHash }) {
  const D = ESCROW_DEFAULTS;
  if (D.circuitId == null) throw new Error('The escrow rule is not on X Layer yet.');
  return ESCROW_BYTECODE + [a(D.token), a(D.processor), w(D.circuitId), a(seller), w(Math.round(amount * 1e6)), w(periodSeconds), termsHash.replace(/^0x/, '').padStart(64, '0'), a(D.feeRecipient), w(D.feeBps)].join('');
}
export async function readEscrow(c) {
  const g = (sel) => call(c, sel);
  const [buyer, seller, amount, duration, termsHash, fee, accepted, funded, approved, sellerRefunds, settled, deadline, token, processor, circuitId, feeRecipient, feeBps] = await Promise.all([
    g(S.buyer), g(S.seller), g(S.amount), g(S.duration), g(S.termsHash), g(S.fee), g(S.accepted), g(S.funded), g(S.approved), g(S.sellerRefunds), g(S.settled), g(S.deadline),
    call(c, '0xfc0c546a'), call(c, '0xce1b1d43'), call(c, '0x030c9d5c'), call(c, '0x46904840'), call(c, '0x24a9d853'),
  ]);
  return { buyer: addr(buyer), seller: addr(seller), amount: num(amount), duration: num(duration), termsHash, fee: num(fee), accepted: num(accepted) === 1, funded: num(funded) === 1,
    approved: num(approved) === 1, sellerRefunds: num(sellerRefunds) === 1, settled: num(settled) === 1, deadline: num(deadline), token: addr(token), processor: addr(processor), circuitId: num(circuitId), feeRecipient: addr(feeRecipient), feeBps: num(feeBps) };
}
export const escrowAllowance = (s, owner, c) => call(s.token, S.allowance + pad(owner) + pad(c)).then(num);

const sendE = (from, to, data) => send(from, to, data, ESC_ERRORS);
export const escrowActions = {
  accept: (from, c) => sendE(from, c, S.accept),
  allow: (from, c, s) => sendE(from, s.token, S.erc20approve + pad(c) + pad((s.amount + s.fee).toString(16))),
  fund: (from, c) => sendE(from, c, S.fund),
  approve: (from, c) => sendE(from, c, S.approve),
  offerRefund: (from, c) => sendE(from, c, S.offerRefund),
  release: (from, c) => sendE(from, c, S.release),
  refund: (from, c) => sendE(from, c, S.refund),
};
