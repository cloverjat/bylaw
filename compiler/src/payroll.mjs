// Bylaw Payroll release rule.
// Pins (little-endian integer, bit 0 = pin 0):
//   0-3   cycle index        (which pay cycle is being released, 0-based)
//   4-7   cycles in total    (how many cycles the payroll was created with)
//   8     due                (that cycle's time has come, computed from block time by the contract)
//   9     funded             (the payroll was fully funded by the employer)
//   10    unpaid             (this worker has not yet been paid for this cycle)
// Output bit 0 = 1 only if: cycle < cycles AND due AND funded AND unpaid.
// No constant signals are used, so the circuit can be drawn on the TapeOut canvas as is.
import { Builder } from './netlist.mjs';

export const PAYROLL_PINS = { cycle: 0, cycles: 4, due: 8, funded: 9, unpaid: 10, nIn: 11 };

// Strict A < B for unsigned words, LSB first, without constants.
function lt(b, A, B) {
  let r = b.and(b.not(A[0]), B[0]);
  for (let i = 1; i < A.length; i++) {
    const less = b.and(b.not(A[i]), B[i]);
    const same = b.xnor(A[i], B[i]);
    r = b.or(less, b.and(same, r));
  }
  return r;
}

export function buildPayrollRule() {
  const b = new Builder(PAYROLL_PINS.nIn);
  const w = (from) => [0, 1, 2, 3].map((i) => b.input(from + i));
  const inTerm = lt(b, w(PAYROLL_PINS.cycle), w(PAYROLL_PINS.cycles));
  const ok = b.and(b.and(b.and(inTerm, b.input(PAYROLL_PINS.due)), b.input(PAYROLL_PINS.funded)), b.input(PAYROLL_PINS.unpaid));
  return b.build([ok]);
}

const field = (bits, from) => [0, 1, 2, 3].reduce((s, i) => s + bits[from + i] * 2 ** i, 0);
export function payrollReference(bits) {
  const ok = field(bits, 0) < field(bits, 4) && bits[8] === 1 && bits[9] === 1 && bits[10] === 1;
  return [ok ? 1 : 0];
}

export const PAYROLL_SENTENCE = 'Pay a worker for a cycle only if: the cycle is within the agreed number of cycles, AND that cycle\'s time has come, AND the payroll was fully funded, AND this worker has not already been paid for that cycle.';
