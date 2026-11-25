// Bylaw Escrow rule (installments): two outputs from nine pins for ONE installment (little-endian, bit 0 = pin 0).
//   0 funded         the buyer locked all the money
//   1 accepted       the seller accepted the terms
//   2 graceOver      this installment's due time plus its response window has passed (computed from block time)
//   3 approved       the buyer approved this installment
//   4 held           the buyer put this installment on hold (a referee must decide)
//   5 settled        this installment was already paid out or returned
//   6 refSeller      the referee decided: pay the seller
//   7 refBuyer       the referee decided: return to the buyer
//   8 sellerRefunds  the seller agreed to return this installment
// Output bit 0 (PAY the seller)    = funded AND accepted AND NOT settled AND (approved OR (graceOver AND NOT held) OR (held AND refSeller)).
// Output bit 1 (RETURN the buyer)  = funded AND NOT settled AND ((held AND refBuyer) OR sellerRefunds).
// No constant signals are used, so the circuit can be drawn on the TapeOut canvas as is.
import { Builder } from './netlist.mjs';

export const ESCROW_PINS = { funded: 0, accepted: 1, graceOver: 2, approved: 3, held: 4, settled: 5, refSeller: 6, refBuyer: 7, sellerRefunds: 8, nIn: 9 };

export function buildEscrowRule() {
  const b = new Builder(ESCROW_PINS.nIn);
  const i = (k) => b.input(ESCROW_PINS[k]);
  const open = b.and(i('funded'), b.not(i('settled')));
  const auto = b.and(i('graceOver'), b.not(i('held')));
  const refereed = b.and(i('held'), i('refSeller'));
  const payCond = b.or(b.or(i('approved'), auto), refereed);
  const pay = b.and(b.and(open, i('accepted')), payCond);
  const back = b.and(open, b.or(b.and(i('held'), i('refBuyer')), i('sellerRefunds')));
  return b.build([pay, back]);
}

export function escrowReference(bits) {
  const [funded, accepted, graceOver, approved, held, settled, refSeller, refBuyer, sellerRefunds] = bits;
  const open = funded && !settled;
  const pay = open && accepted && (approved || (graceOver && !held) || (held && refSeller));
  const back = open && ((held && refBuyer) || sellerRefunds);
  return [pay ? 1 : 0, back ? 1 : 0];
}

export const ESCROW_SENTENCE = 'An installment goes to the seller only if: the buyer locked the money, AND the seller accepted the terms, AND it was not already paid, AND either the buyer approved it, OR its due time and response window passed without a hold, OR it was held and the referee decided for the seller. It goes back to the buyer only if it was held and the referee decided for the buyer, OR the seller agreed to return it.';
