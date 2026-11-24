// Bylaw Payroll: create, fund, pay, read. Everything runs in the browser against X Layer.
import { PAYROLL_BYTECODE } from './payroll-bytecode.mjs';
import { call, send, pad, num, addr, ERRORS } from './circle.mjs';

export const PAY_DEFAULTS = {
  token: '0xB6CEceAB302E2E4948951eE7843FC24E92933061',
  processor: '0x526B96238cc418d909005e2E2D79e327da4BD0f7',
  circuitId: 7,
  feeRecipient: '0x11BccB28A40ee64EA0eebC3199b9B00D5359e7de',
  feeBps: 100,
};
const S = {
  workerCount: '0xf7a94f4b', workers: '0xf1a22dc2', amounts: '0x45f0a44f', total: '0x2ddbd13a', paidOut: '0x5c76ca2d', start: '0xbe9a6555',
  funded: '0xf3a504f2', reclaimed: '0x678aaa63', period: '0xef78d4fd', cycles: '0x6dbe5554', boss: '0xc772af39', fee: '0xddca3f43',
  paid: '0x8d42394d', fund: '0xb60d4288', pay: '0xef48eee6', reclaim: '0x80e9071b', approve: '0x095ea7b3', allowance: '0xdd62ed3e',
};
const PAY_ERRORS = {
  ...ERRORS,
  '0xa36c272c': 'Only the employer can do this.',
  '0x5adf6387': 'This payroll was already funded.',
  '0xd5ef09ba': 'This payroll has not been funded yet.',
  '0x81a15a08': 'The public payroll rule said NO. Either that cycle is not over yet, this worker was already paid for it, or the payroll is not funded.',
  '0x085de625': 'Too early. Unclaimed money can only go back to the employer 90 days after the last cycle.',
};
const w = (v) => BigInt(v).toString(16).padStart(64, '0');
const a = (x) => x.toLowerCase().replace(/^0x/, '').padStart(64, '0');
export const RECLAIM_DELAY = 90 * 86400;

export function validatePayroll({ names, wallets, amounts, periodSeconds, cycles }) {
  if (wallets.length < 1 || wallets.length > 20) return 'Add between 1 and 20 workers.';
  const seen = new Set();
  for (let i = 0; i < wallets.length; i++) {
    if (!names[i]) return `Worker ${i + 1}: please give a name.`;
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallets[i])) return `Worker ${i + 1}: that is not a valid wallet address (starts with 0x, 42 characters).`;
    const l = wallets[i].toLowerCase();
    if (seen.has(l)) return `Worker ${i + 1}: this wallet is already in the list.`;
    seen.add(l);
    if (!(amounts[i] > 0) || Math.round(amounts[i] * 1e6) < 1) return `Worker ${i + 1}: enter how much they are paid each cycle.`;
  }
  if (!Number.isInteger(cycles) || cycles < 1 || cycles > 15) return 'The number of cycles must be between 1 and 15.';
  if (periodSeconds < 60) return 'A cycle must last at least 1 minute.';
  return null;
}
export function payrollTotals({ amounts, cycles }) {
  const per = amounts.reduce((s, x) => s + Math.round(x * 1e6), 0);
  const total = per * cycles;
  const fee = Math.floor((total * PAY_DEFAULTS.feeBps) / 10000);
  return { total, fee };
}
export function payrollDeployData({ wallets, amounts, periodSeconds, cycles }) {
  const D = PAY_DEFAULTS, n = wallets.length;
  const offW = 9 * 32, offA = offW + (1 + n) * 32;
  const head = [a(D.token), a(D.processor), w(D.circuitId), w(offW), w(offA), w(periodSeconds), w(cycles), a(D.feeRecipient), w(D.feeBps)].join('');
  return PAYROLL_BYTECODE + head + w(n) + wallets.map(a).join('') + w(n) + amounts.map((x) => w(Math.round(x * 1e6))).join('');
}

export async function readPayroll(c) {
  const g = async (sel, ...args) => call(c, sel + args.map((x) => pad(x.toString(16))).join(''));
  const [n, total, paidOut, start, funded, reclaimed, period, cycles, boss, fee, token] = await Promise.all([
    g(S.workerCount), g(S.total), g(S.paidOut), g(S.start), g(S.funded), g(S.reclaimed), g(S.period), g(S.cycles), g(S.boss), g(S.fee), call(c, '0xfc0c546a'),
  ]);
  const count = num(n), cyc = num(cycles);
  const workers = [], amounts = [];
  await Promise.all([...Array(count).keys()].map(async (i) => {
    workers[i] = addr(await g(S.workers, i)); amounts[i] = num(await g(S.amounts, i));
  }));
  const paid = [];
  await Promise.all([...Array(cyc).keys()].flatMap((k) => [...Array(count).keys()].map(async (i) => {
    (paid[k] ||= [])[i] = num(await g(S.paid, k, i)) === 1;
  })));
  return { count, cycles: cyc, workers, amounts, paid, total: num(total), paidOut: num(paidOut), start: num(start), funded: num(funded) === 1,
    reclaimed: num(reclaimed) === 1, period: num(period), boss: addr(boss), fee: num(fee), token: addr(token) };
}
export const payrollAllowance = (s, owner, c) => call(s.token, S.allowance + pad(owner) + pad(c)).then(num);

const sendP = (from, to, data) => send(from, to, data, PAY_ERRORS);
export const payrollActions = {
  approve: (from, c, s) => sendP(from, s.token, S.approve + pad(c) + pad((s.total + s.fee).toString(16))),
  fund: (from, c) => sendP(from, c, S.fund),
  pay: (from, c, worker, cycle) => sendP(from, c, S.pay + pad(worker.toString(16)) + pad(cycle.toString(16))),
  reclaim: (from, c) => sendP(from, c, S.reclaim),
};
