// Bylaw Escrow rule: two outputs from six pins (little-endian, bit 0 = pin 0).
//   0 funded         the buyer has locked the money
//   1 accepted       the seller has accepted the agreed terms
//   2 approved       the buyer has approved the work / delivery
//   3 expired        the deadline passed (computed from block time by the contract)
//   4 sellerRefunds  the seller agreed to give the money back
//   5 settled        the money already moved once
// Output bit 0 (RELEASE to seller) = funded AND accepted AND approved AND NOT settled.
// Output bit 1 (REFUND to buyer)  = funded AND NOT settled AND ((expired AND NOT approved) OR sellerRefunds).
import { Builder } from './netlist.mjs';

export const ESCROW_PINS = { funded: 0, accepted: 1, approved: 2, expired: 3, sellerRefunds: 4, settled: 5, nIn: 6 };

export function buildEscrowRule() {
  const b = new Builder(ESCROW_PINS.nIn);
  const i = (k) => b.input(ESCROW_PINS[k]);
  const open = b.and(i('funded'), b.not(i('settled')));
  const release = b.and(b.and(open, i('accepted')), i('approved'));
  const refund = b.and(open, b.or(b.and(i('expired'), b.not(i('approved'))), i('sellerRefunds')));
  return b.build([release, refund]);
}

export function escrowReference(bits) {
  const [funded, accepted, approved, expired, sellerRefunds, settled] = bits;
  const open = funded && !settled;
  return [open && accepted && approved ? 1 : 0, open && ((expired && !approved) || sellerRefunds) ? 1 : 0];
}

export const ESCROW_SENTENCE = 'The money goes to the seller only if: the buyer locked it, AND the seller accepted the terms, AND the buyer approved the delivery, AND it was not already paid out. The money goes back to the buyer only if: it was locked and not yet paid out, AND either the deadline passed without the buyer approving, OR the seller agreed to refund.';
