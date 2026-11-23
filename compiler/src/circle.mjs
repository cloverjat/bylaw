// Bylaw Circle payout rule.
// Pins (little-endian integer, bit 0 = pin 0):
//   0-3   recipient index   (who is being paid)
//   4-7   round index       (whose turn it is)
//   8-11  paid count        (members who paid into this round)
//   12-15 member count
//   16    window open       (round period has ended, computed from block time by the vault)
// Output bit 0 = 1 only if: recipient == round AND paid == members AND window open.
import { Builder } from './netlist.mjs';

export const CIRCLE_PINS = { recipient: 0, round: 4, paid: 8, members: 12, window: 16, nIn: 17 };

function eq4(b, X, Y) {
  let r = b.xnor(X[0], Y[0]);
  for (let i = 1; i < 4; i++) r = b.and(r, b.xnor(X[i], Y[i]));
  return r;
}

export function buildCirclePayoutRule() {
  const b = new Builder(CIRCLE_PINS.nIn);
  const w = (from) => [0, 1, 2, 3].map((i) => b.input(from + i));
  const turn = eq4(b, w(CIRCLE_PINS.recipient), w(CIRCLE_PINS.round));
  const allPaid = eq4(b, w(CIRCLE_PINS.paid), w(CIRCLE_PINS.members));
  const open = b.input(CIRCLE_PINS.window);
  return b.build([b.and(b.and(turn, allPaid), open)]);
}

const field = (bits, from) => [0, 1, 2, 3].reduce((s, i) => s + bits[from + i] * 2 ** i, 0);
export function circleReference(bits) {
  const ok = field(bits, 0) === field(bits, 4) && field(bits, 8) === field(bits, 12) && bits[16] === 1;
  return [ok ? 1 : 0];
}
