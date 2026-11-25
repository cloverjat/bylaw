// Constructor arguments for explorer verification, rebuilt from what the contract itself reports on-chain.
const w = (v) => BigInt(v).toString(16).padStart(64, '0');
const a = (x) => x.toLowerCase().replace(/^0x/, '').padStart(64, '0');
export const COMPILER = 'solc 0.8.39, optimizer on, 200 runs, EVM paris, license MIT';
export const circleArgs = (s) => [a(s.token), a(s.processor), w(s.circuitId), w(8 * 32), w(s.contribution), w(s.period), a(s.feeRecipient), w(s.feeBps), w(s.members.length), ...s.members.map(a)].join('');
export const payrollArgs = (s) => {
  const n = s.workers.length, offW = 9 * 32, offA = offW + (1 + n) * 32;
  return [a(s.token), a(s.processor), w(s.circuitId), w(offW), w(offA), w(s.period), w(s.cycles), a(s.feeRecipient), w(s.feeBps), w(n), ...s.workers.map(a), w(n), ...s.amounts.map((x) => w(x))].join('');
};
export const walletArgs = (s) => [a(s.token), a(s.processor), w(s.circuitId), w(s.kind), w(s.unit), w(s.limitA), w(s.limitB), a(s.confirmer), a(s.feeRecipient), w(s.feeBps)].join('');
export function verifyBox(args, file) {
  return `<b>Explorer</b><span>${COMPILER}. Input file: docs/verify/${file}</span><b>Constructor args</b><span style="user-select:all">${args}</span>`;
}
