// Bylaw Escrow: a two-person agreement paid in installments. Create, accept, lock, approve, hold, decide, release, return.
import { ESCROW_BYTECODE } from './escrow-bytecode.mjs';
import { call, send, pad, num, addr, ERRORS } from './circle.mjs';
import { FEE_WALLET, ESCROW_FEE_BPS } from './fees.mjs';

export const ESCROW_DEFAULTS = {
  token: '0xB6CEceAB302E2E4948951eE7843FC24E92933061',
  processor: '0x526B96238cc418d909005e2E2D79e327da4BD0f7',
  circuitId: 11, // taped out on X Layer (My 4004 #29), circuit #11
  feeRecipient: FEE_WALLET,
  feeBps: ESCROW_FEE_BPS,
};
const ZERO = '0x0000000000000000000000000000000000000000';
const S = {
  buyer: '0x7150d8ae', seller: '0x08551a53', referee: '0x3b1bebd1', installment: '0x9f27f6ed', count: '0x06661abd', interval: '0x947a36fb', grace: '0x1eefddb1',
  termsHash: '0xb311d9fd', fee: '0xddca3f43', accepted: '0x67fe5a0c', funded: '0xf3a504f2', start: '0xbe9a6555',
  approved: '0x7d4061e6', held: '0xdedd8ed8', settled: '0x28345780', refSeller: '0xb11ac015', refBuyer: '0x2abda9a8', sellerRefunds: '0x3b3c2c90',
  accept: '0x2852b71c', fund: '0xb60d4288', approve: '0xb759f954', hold: '0x49c910c0', decide: '0x224f3d1a', offerRefund: '0xe73dcbe8', release: '0x37bdc99b', refund: '0x278ecde1',
  erc20approve: '0x095ea7b3', allowance: '0xdd62ed3e',
};
const ESC_ERRORS = {
  ...ERRORS,
  '0x472e017e': 'Only the buyer can do this.',
  '0x5ec82351': 'Only the seller can do this.',
  '0xffe9b7de': 'Only the referee can do this.',
  '0x09686b32': 'That step comes at a different time. The seller accepts first, then the buyer locks the money.',
  '0x81a15a08': 'The public rule said NO. That payment cannot move that way right now (for example, it is not approved or due yet, or it is on hold).',
  '0x019af637': 'Those settings are not valid.',
};
const w = (v) => BigInt(v).toString(16).padStart(64, '0');
const a = (x) => x.toLowerCase().replace(/^0x/, '').padStart(64, '0');
export const MAX_TERMS = 600;
export const GRACE_DAYS = 3;
export const SCHEDULES = { once: 0, weekly: 7 * 86400, biweekly: 14 * 86400, monthly: 30 * 86400 };

export async function termsFingerprint(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return '0x' + [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
// Installments: "once" uses the deadline as its single due time, other schedules repeat every week / 2 weeks / 30 days.
export function scheduleOf({ schedule, count, deadlineSeconds }) {
  return schedule === 'once' ? { count: 1, interval: deadlineSeconds } : { count, interval: SCHEDULES[schedule] };
}
export function validateEscrow({ seller, buyer, referee, amount, count, interval, terms }) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(seller || '')) return 'Enter the seller\'s wallet address (starts with 0x, 42 characters).';
  if (buyer && seller.toLowerCase() === buyer.toLowerCase()) return 'The seller must be a different wallet from yours.';
  if (referee) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(referee)) return 'The referee\'s wallet address is not valid (starts with 0x, 42 characters).';
    if (referee.toLowerCase() === seller.toLowerCase() || (buyer && referee.toLowerCase() === buyer.toLowerCase())) return 'The referee must be a different wallet from the buyer and the seller.';
  }
  if (!(amount > 0) || Math.round(amount * 1e6) < 1) return 'Enter the amount for each payment.';
  if (!Number.isInteger(count) || count < 1 || count > 24) return 'The number of payments must be between 1 and 24.';
  if (interval < 60) return 'The time between payments must be at least 1 minute.';
  if (!terms || terms.trim().length < 10) return 'Write the terms of the deal in plain words (at least a short sentence).';
  if (terms.length > MAX_TERMS) return `Keep the terms under ${MAX_TERMS} characters.`;
  return null;
}
export function escrowTotals(amount, count) {
  const per = Math.round(amount * 1e6), total = per * count;
  return { per, total, fee: Math.floor((total * ESCROW_DEFAULTS.feeBps) / 10000) };
}
export function escrowDeployData({ seller, referee, amount, count, interval, termsHash }) {
  const D = ESCROW_DEFAULTS;
  if (D.circuitId == null) throw new Error('The escrow rule is not on X Layer yet.');
  return ESCROW_BYTECODE + [a(D.token), a(D.processor), w(D.circuitId), a(seller), a(referee || ZERO), w(Math.round(amount * 1e6)), w(count), w(interval), w(GRACE_DAYS * 86400),
    termsHash.replace(/^0x/, '').padStart(64, '0'), a(D.feeRecipient), w(D.feeBps)].join('');
}
export const escrowArgs = (s) => [a(s.token), a(s.processor), w(s.circuitId), a(s.seller), a(s.referee), w(s.installment), w(s.count), w(s.interval), w(s.grace), s.termsHash.replace(/^0x/, ''), a(s.feeRecipient), w(s.feeBps)].join('');

export async function readEscrow(c) {
  const g = (sel, k) => call(c, sel + (k === undefined ? '' : pad(k.toString(16))));
  const [buyer, seller, referee, installment, count, interval, grace, termsHash, fee, accepted, funded, start, token, processor, circuitId, feeRecipient, feeBps] = await Promise.all([
    g(S.buyer), g(S.seller), g(S.referee), g(S.installment), g(S.count), g(S.interval), g(S.grace), g(S.termsHash), g(S.fee), g(S.accepted), g(S.funded), g(S.start),
    call(c, '0xfc0c546a'), call(c, '0xce1b1d43'), call(c, '0x030c9d5c'), call(c, '0x46904840'), call(c, '0x24a9d853'),
  ]);
  const n = num(count), items = [];
  await Promise.all([...Array(n).keys()].map(async (k) => {
    const [ap, he, se, rs, rb, sr] = await Promise.all([g(S.approved, k), g(S.held, k), g(S.settled, k), g(S.refSeller, k), g(S.refBuyer, k), g(S.sellerRefunds, k)]);
    items[k] = { approved: num(ap) === 1, held: num(he) === 1, settled: num(se) === 1, refSeller: num(rs) === 1, refBuyer: num(rb) === 1, sellerRefunds: num(sr) === 1 };
  }));
  return { buyer: addr(buyer), seller: addr(seller), referee: addr(referee) === ZERO ? null : addr(referee), refereeRaw: addr(referee), installment: num(installment), count: n, interval: num(interval), grace: num(grace), termsHash,
    fee: num(fee), accepted: num(accepted) === 1, funded: num(funded) === 1, start: num(start), items, token: addr(token), processor: addr(processor), circuitId: num(circuitId), feeRecipient: addr(feeRecipient), feeBps: num(feeBps) };
}
export const escrowAllowance = (s, owner, c) => call(s.token, S.allowance + pad(owner) + pad(c)).then(num);

const sendE = (from, to, data) => send(from, to, data, ESC_ERRORS);
const withK = (sel, k) => sel + pad(k.toString(16));
export const escrowActions = {
  accept: (from, c) => sendE(from, c, S.accept),
  allow: (from, c, s) => sendE(from, s.token, S.erc20approve + pad(c) + pad((s.installment * s.count + s.fee).toString(16))),
  fund: (from, c) => sendE(from, c, S.fund),
  approve: (from, c, k) => sendE(from, c, withK(S.approve, k)),
  hold: (from, c, k) => sendE(from, c, withK(S.hold, k)),
  decideSeller: (from, c, k) => sendE(from, c, withK(S.decide, k) + pad('1')),
  decideBuyer: (from, c, k) => sendE(from, c, withK(S.decide, k) + pad('0')),
  offerRefund: (from, c, k) => sendE(from, c, withK(S.offerRefund, k)),
  release: (from, c, k) => sendE(from, c, withK(S.release, k)),
  refund: (from, c, k) => sendE(from, c, withK(S.refund, k)),
};
