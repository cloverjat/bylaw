// "Create a circle": builds the deploy transaction in the browser, the creator's own wallet signs it.
import { CIRCLE_BYTECODE } from './bytecode.mjs';
export const DEFAULTS = {
  token: '0xB6CEceAB302E2E4948951eE7843FC24E92933061', // native USDC on X Layer
  processor: '0x526B96238cc418d909005e2E2D79e327da4BD0f7', // TapeOut My 4004 #29
  circuitId: 6,
  feeRecipient: '0x11BccB28A40ee64EA0eebC3199b9B00D5359e7de',
  feeBps: 100,
};
const w = (v) => BigInt(v).toString(16).padStart(64, '0');
const a = (x) => x.toLowerCase().replace(/^0x/, '').padStart(64, '0');

export function validate({ names, wallets, usdc, periodSeconds }) {
  if (wallets.length < 2 || wallets.length > 15) return 'A circle needs between 2 and 15 members.';
  const seen = new Set();
  for (let i = 0; i < wallets.length; i++) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallets[i])) return `Member ${i + 1}: that is not a valid wallet address (it starts with 0x and has 42 characters).`;
    const l = wallets[i].toLowerCase();
    if (seen.has(l)) return `Member ${i + 1}: this wallet is already in the list.`;
    seen.add(l);
    if (!names[i].trim()) return `Member ${i + 1}: please give a name.`;
  }
  if (!(usdc > 0)) return 'Enter how much each person pays per round.';
  if (Math.round(usdc * 1e6) < 1) return 'The amount is too small.';
  if (periodSeconds < 60) return 'A round must last at least 1 minute.';
  return null;
}

export function deployData({ wallets, usdc, periodSeconds }) {
  const D = DEFAULTS;
  const n = wallets.length;
  const head = [a(D.token), a(D.processor), w(D.circuitId), w(8 * 32), w(Math.round(usdc * 1e6)), w(periodSeconds), a(D.feeRecipient), w(D.feeBps)].join('');
  const tail = w(n) + wallets.map(a).join('');
  return CIRCLE_BYTECODE + head + tail;
}
