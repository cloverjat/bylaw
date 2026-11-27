// Live Bylaw Circle dashboard: reads X Layer directly, sends transactions from the user's own wallet.
import { chooseWallet } from './wallets.mjs';
const RPCS = ['https://rpc.xlayer.tech', 'https://xlayerrpc.okx.com'];
const CHAIN_HEX = '0xc4';
const EXPLORER = 'https://www.okx.com/web3/explorer/xlayer';
export const DEMO_CIRCLE = '0x8d15e0ec20b56ccac0afe59fab188d0b72d2a3f5';
const SEL = {
  token: '0xfc0c546a', processor: '0xce1b1d43', circuitId: '0x030c9d5c', netlistHash: '0x543862ee',
  contribution: '0x50520b1f', period: '0xef78d4fd', feeBps: '0x24a9d853', feeRecipient: '0x46904840',
  memberCount: '0x11aee380', round: '0x146ca531', paidCount: '0x248b8725', roundEnd: '0xc02e580e',
  failed: '0xba414fa6', members: '0x5daf08ca', paid: '0xa2ebc085', balanceOf: '0x70a08231',
  allowance: '0xdd62ed3e', declareFailed: '0xf4a6d373', claimRefund: '0xb5545a3c', approve: '0x095ea7b3', contribute: '0xd7bb99ba', payout: '0x153f2b4b',
};
const ERRORS = {
  '0x291fc442': 'The connected wallet is not one of the circle members. In your wallet app, switch to a member account (the short addresses listed above), then connect again.',
  '0xd70a0e30': 'This wallet already paid for this round.',
  '0x5ea6e641': 'The circle is finished: every member has been paid.',
  '0x74566680': 'The circle was closed because someone did not pay in time.',
  '0x81a15a08': 'The public circuit said NO. Either this is not the right person for this round, or the round is not ready yet (someone has not paid and the waiting time is not over).',
  '0x968454df': 'The circuit changed since this circle was created, so payouts are blocked.',
  '0x085de625': 'Too early for this action.',
};

const pad = (h) => h.replace(/^0x/, '').toLowerCase().padStart(64, '0');
const num = (h) => parseInt(h.replace(/^0x/, '') || '0', 16);
const addr = (h) => '0x' + h.replace(/^0x/, '').slice(-40);
const short = (a) => a.slice(0, 6) + '…' + a.slice(-4);
const usdc = (n) => (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 6 });

async function rpc(method, params) {
  let last;
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      const j = await r.json();
      if (j.error) { const e = new Error(j.error.message); e.data = j.error.data; e.fromChain = true; throw e; }
      return j.result;
    } catch (e) { if (e.fromChain) throw e; last = e; } // network or rate-limit problem: try the next server
  }
  throw last;
}
const call = (to, data) => rpc('eth_call', [{ to, data }, 'latest']);

export async function readCircle(c) {
  const g = (s, extra = '') => call(c, SEL[s] + extra);
  const [token, processor, circuitId, netlistHash, contribution, period, feeBps, feeRecipient, n, round, paidCount, roundEnd, failed] = await Promise.all([
    g('token'), g('processor'), g('circuitId'), g('netlistHash'), g('contribution'), g('period'), g('feeBps'), g('feeRecipient'),
    g('memberCount'), g('round'), g('paidCount'), g('roundEnd'), g('failed'),
  ]);
  const count = num(n);
  const tokenAddr = addr(token);
  const members = await Promise.all(Array.from({ length: count }, (_, i) => g('members', pad(i.toString(16))).then(addr)));
  const rd = num(round);
  const paid = rd < count ? await Promise.all(members.map((m) => g('paid', pad(rd.toString(16)) + pad(m)).then((v) => num(v) === 1))) : members.map(() => false);
  const balance = num(await call(tokenAddr, SEL.balanceOf + pad(c)));
  const block = await rpc('eth_getBlockByNumber', ['latest', false]);
  return {
    token: tokenAddr, processor: addr(processor), circuitId: num(circuitId), netlistHash, contribution: num(contribution),
    period: num(period), feeBps: num(feeBps), feeRecipient: addr(feeRecipient), count, round: rd, paidCount: num(paidCount),
    roundEnd: num(roundEnd), failed: num(failed) === 1, members, paid, balance, now: num(block.timestamp),
  };
}

let active = null;
let cachedAcct = null;
export function wallet() { return active || window.okxwallet || window.ethereum; }

export async function connect() {
  if (active && cachedAcct) return cachedAcct;
  const w = await chooseWallet();
  if (!w) throw new Error('No wallet connected. Pick a wallet, or open this page inside your wallet app.');
  active = w;
  const [account] = await w.request({ method: 'eth_requestAccounts' });
  if (w.on) { try { w.on('accountsChanged', (a) => { cachedAcct = a && a[0] ? a[0].toLowerCase() : null; if (!cachedAcct) active = null; window.dispatchEvent(new CustomEvent('bylaw:account', { detail: cachedAcct })); }); } catch {} }
  const chain = await w.request({ method: 'eth_chainId' });
  if (chain !== CHAIN_HEX) {
    try { await w.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] }); }
    catch (e) {
      await w.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN_HEX, chainName: 'X Layer', nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 }, rpcUrls: [RPCS[0]], blockExplorerUrls: [EXPLORER] }] });
    }
  }
  cachedAcct = account.toLowerCase();
  window.dispatchEvent(new CustomEvent('bylaw:account', { detail: cachedAcct }));
  return cachedAcct;
}

async function send(from, to, data, errs = ERRORS) {
  // Simulate first so the person sees a plain-English reason instead of a confusing wallet error.
  try { await rpc('eth_call', [{ from, to, data }, 'latest']); }
  catch (e) { throw new Error(errs[e.data] || 'The network says this would fail: ' + e.message); }
  return wallet().request({ method: 'eth_sendTransaction', params: [{ from, to, data, value: '0x0' }] });
}

export const actions = {
  approve: (from, c, s) => send(from, s.token, SEL.approve + pad(c) + pad((s.contribution * s.count).toString(16))),
  contribute: (from, c) => send(from, c, SEL.contribute),
  declareFailed: (from, c) => send(from, c, SEL.declareFailed),
  claimRefund: (from, c) => send(from, c, SEL.claimRefund),
  payout: (from, c, s) => send(from, c, SEL.payout + pad(s.round.toString(16))),
};

export async function allowanceOf(s, c, owner) { return num(await call(s.token, SEL.allowance + pad(owner) + pad(c))); }
export async function waitFor(hash) {
  for (let i = 0; i < 60; i++) { const r = await rpc('eth_getTransactionReceipt', [hash]); if (r) { try { window.dispatchEvent(new Event('bylaw:tx')); } catch {} return r.status === '0x1'; } await new Promise((r) => setTimeout(r, 2000)); }
  return null;
}
export { short, usdc, EXPLORER, rpc, call, send, pad, num, addr, ERRORS };

// Deploy a new circle from the creator's own wallet (no `to` address = contract creation).
export async function deployCircle(from, data) {
  let gas;
  try { gas = await rpc('eth_estimateGas', [{ from, data }]); }
  catch (e) { throw new Error('The network says this circle cannot be created: ' + e.message); }
  const g = '0x' + Math.ceil(num(gas) * 1.2).toString(16);
  return wallet().request({ method: 'eth_sendTransaction', params: [{ from, data, gas: g, value: '0x0' }] });
}
export async function waitReceipt(hash) {
  for (let i = 0; i < 90; i++) { const r = await rpc('eth_getTransactionReceipt', [hash]); if (r) return r; await new Promise((r) => setTimeout(r, 2000)); }
  return null;
}
