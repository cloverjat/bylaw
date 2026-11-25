// Bylaw Wallet rules. Three generic circuits, no constants (so they draw on the TapeOut canvas as they are).
// The wallet contract passes its own settings (cap, limit, waiting time) in as input pins, so one circuit
// serves every wallet. Amounts are whole "units" (the wallet's unit, for example 1 USDC), 6 bits each (0-63).
// All words are little-endian, bit 0 first.
import { Builder } from './netlist.mjs';

const word = (b, from, n = 6) => Array.from({ length: n }, (_, i) => b.input(from + i));

// A <= B for unsigned words, LSB first, no constants.
function le(b, A, B) {
  let r = b.or(b.not(A[0]), B[0]);
  for (let i = 1; i < A.length; i++) {
    const lt = b.and(b.not(A[i]), B[i]);
    const eq = b.xnor(A[i], B[i]);
    r = b.or(lt, b.and(eq, r));
  }
  return r;
}
// Adds two words, no constants: returns width+1 signals.
function add(b, A, B) {
  const out = [];
  let carry;
  for (let i = 0; i < A.length; i++) {
    const x = b.xor(A[i], B[i]);
    if (i === 0) { out.push(x); carry = b.and(A[0], B[0]); continue; }
    out.push(b.xor(x, carry));
    carry = b.or(b.and(A[i], B[i]), b.and(x, carry));
  }
  out.push(carry);
  return out;
}

// 1. Daily cap: allowed only if amount + spentToday <= cap.
export const CAP_PINS = { amount: 0, spent: 6, cap: 12, nIn: 18 };
export function buildCapRule() {
  const b = new Builder(CAP_PINS.nIn);
  const S = add(b, word(b, CAP_PINS.amount), word(b, CAP_PINS.spent));
  const ok = b.and(b.not(S[6]), le(b, S.slice(0, 6), word(b, CAP_PINS.cap)));
  return b.build([ok]);
}
const val = (bits, from, n = 6) => Array.from({ length: n }, (_, i) => bits[from + i] * 2 ** i).reduce((a, c) => a + c, 0);
export const capReference = (bits) => [val(bits, CAP_PINS.amount) + val(bits, CAP_PINS.spent) <= val(bits, CAP_PINS.cap) ? 1 : 0];
export const CAP_SENTENCE = 'Allow a payment only if it, added to what was already spent today, stays within the daily cap.';

// 2. Trusted or small: allowed if the recipient is trusted, OR the amount is within the small limit AND the recipient has waited long enough.
export const TRUST_PINS = { trusted: 0, amount: 1, age: 7, trial: 13, hours: 19, nIn: 25 };
export function buildTrustRule() {
  const b = new Builder(TRUST_PINS.nIn);
  const small = le(b, word(b, TRUST_PINS.amount), word(b, TRUST_PINS.trial));
  const waited = le(b, word(b, TRUST_PINS.hours), word(b, TRUST_PINS.age));
  const ok = b.or(b.input(TRUST_PINS.trusted), b.and(small, waited));
  return b.build([ok]);
}
export const trustReference = (bits) => [bits[TRUST_PINS.trusted] === 1 || (val(bits, TRUST_PINS.amount) <= val(bits, TRUST_PINS.trial) && val(bits, TRUST_PINS.age) >= val(bits, TRUST_PINS.hours)) ? 1 : 0];
export const TRUST_SENTENCE = 'Allow a payment if the recipient is trusted, or if the amount is small and the new recipient has waited long enough.';

// 3. Confirm big payments: allowed if the amount is within the limit, OR a second person confirmed it.
export const CONFIRM_PINS = { amount: 0, confirmed: 6, limit: 7, nIn: 13 };
export function buildConfirmRule() {
  const b = new Builder(CONFIRM_PINS.nIn);
  const small = le(b, word(b, CONFIRM_PINS.amount), word(b, CONFIRM_PINS.limit));
  const ok = b.or(small, b.input(CONFIRM_PINS.confirmed));
  return b.build([ok]);
}
export const confirmReference = (bits) => [val(bits, CONFIRM_PINS.amount) <= val(bits, CONFIRM_PINS.limit) || bits[CONFIRM_PINS.confirmed] === 1 ? 1 : 0];
export const CONFIRM_SENTENCE = 'Allow a payment if it is within the limit, or if a second person confirmed it.';
