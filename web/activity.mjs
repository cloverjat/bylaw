// Recent activity for a circle, payroll or wallet, read straight from the blockchain.
// Public X Layer nodes only allow 100 blocks per log request and rate-limit hard, so we scan the last hour,
// then keep what we found on this device. The full history is always on the block explorer.
import { rpc, short, usdc, EXPLORER } from './circle.mjs';

const T = {
  Contributed: '0x0a682e9d674aa24fba20464cb58a04d046c2786469391825e9b59045302fa6cc',
  PaidOut: '0x4b0b941df94402259992d2c8dccafdbf6d15f88fbad55210af92f29b6f581364',
  Failed: '0xdc7ce3bb1fd964931b1942fc769ea1f699a28491f3c954d422aa98ff46f0d7f9',
  Refunded: '0x80553a1b3b0d9135541580bac861502bc2ee4be32d786899872977caec8c4c01',
  Funded: '0x77360216dafe21aa8d455333608207082f74e837ba9b3ef15d0a73cd22693738',
  Paid: '0x4f2d18324ee95128de091ed2adc501295479000ce4c2cec607aeb1b67e189e2f',
  Reclaimed: '0x8ead5713a73bdd75350d3a725de9c215bb2ebde2d01d107e2e7c34a58d6a1902',
  Sent: '0x510ffb4dcab972ae9d2007a58e13f1b0881776d23cd8f5cc32f8c5be2dbf70d2',
  RecipientSaved: '0x2b28badb390cd3fb086c4847d3cf45fa6195437a1b753b5131e09cdd3e39a54e',
  Proposed: '0x21f7580aa2b5b07069e9a68b5bd444ccf128366ccf5044afe7267a9e9dce7e9e',
  Confirmed: '0x5745b04f0487ed3df77aef07f8203e42e3dda220117bb702fbb3fd48fb148d61',
  Rescued: '0x0deb6907e08e0c8bfdc09caa98a30090e97376ae37fa2acae1e67c2eb96b13a2',
};
const WINDOW = 3600; // blocks (about one hour on X Layer)
const num = (h) => parseInt(h, 16);
const topicAddr = (t) => '0x' + t.slice(26);
const word = (data, i) => BigInt('0x' + data.slice(2 + i * 64, 2 + (i + 1) * 64));
const usd = (v) => usdc(Number(v));

// Turn one log into a sentence. Returns null for events that are not worth showing (the fee line, for example).
export function describeLog(l) {
  const t = l.topics, d = l.data, e = t[0];
  if (e === T.Contributed) return `${short(topicAddr(t[2]))} paid into round ${num(t[1]) + 1}`;
  if (e === T.PaidOut) return `Round ${num(t[1]) + 1} paid out ${usd(word(d, 0))} USDC to ${short(topicAddr(t[2]))}`;
  if (e === T.Failed) return `Round ${num(t[1]) + 1} did not complete`;
  if (e === T.Refunded) return `${usd(word(d, 0))} USDC refunded to ${short(topicAddr(t[2]))}`;
  if (e === T.Funded) return `Payroll funded with ${usd(word(d, 0))} USDC`;
  if (e === T.Paid) return `Cycle ${num(t[1]) + 1}: ${usd(word(d, 0))} USDC paid to ${short(topicAddr(t[2]))}`;
  if (e === T.Reclaimed) return `${usd(word(d, 0))} USDC reclaimed by the owner`;
  if (e === T.Sent) return `Sent ${usd(word(d, 0))} USDC to ${short(topicAddr(t[1]))}`;
  if (e === T.RecipientSaved) return `Saved ${short(topicAddr(t[1]))} as a recipient`;
  if (e === T.Proposed) return `Payment #${num(t[1])} of ${usd(word(d, 0))} USDC to ${short(topicAddr(t[2]))} is waiting for confirmation`;
  if (e === T.Confirmed) return `Payment #${num(t[1])} confirmed`;
  if (e === T.Rescued) return `${usd(word(d, 0))} USDC rescued`;
  return null;
}

const key = (a) => 'bylaw_act_' + a;
function load(a) { try { return JSON.parse(localStorage.getItem(key(a))) || { to: 0, items: [] }; } catch { return { to: 0, items: [] }; } }
function save(a, s) { try { localStorage.setItem(key(a), JSON.stringify({ to: s.to, items: s.items.slice(-60) })); } catch {} }

async function logs(addr, from, to, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { return await rpc('eth_getLogs', [{ address: addr, fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16) }]); }
    catch (e) { if (!/rate|limit|429/i.test(e.message || '')) throw e; await new Promise((r) => setTimeout(r, 500 * (i + 1) * (i + 1))); }
  }
  throw new Error('busy');
}

let scanning = new Set();
async function scan(addr) {
  if (scanning.has(addr)) return; scanning.add(addr);
  try {
    const s = load(addr);
    const head = num(await rpc('eth_blockNumber', []));
    let from = Math.max(s.to ? s.to + 1 : 0, head - WINDOW);
    const nowS = Date.now() / 1000;
    const seen = new Set(s.items.map((x) => x.id));
    for (let a = from; a <= head; a += 100) {
      const b = Math.min(a + 99, head);
      const ls = await logs(addr, a, b);
      for (const l of ls) {
        const text = describeLog(l); if (!text) continue;
        const id = l.transactionHash + ':' + l.logIndex; if (seen.has(id)) continue; seen.add(id);
        s.items.push({ id, text, hash: l.transactionHash, ts: Math.round(nowS - (head - num(l.blockNumber))), bn: num(l.blockNumber) });
      }
      s.to = b; save(addr, s);
      await new Promise((r) => setTimeout(r, 120)); // stay under the node's rate limit
    }
    s.items.sort((x, y) => y.bn - x.bn || y.id.localeCompare(x.id));
    save(addr, s);
  } finally { scanning.delete(addr); }
}

const ago = (ts) => { const m = Math.max(0, Math.round((Date.now() / 1000 - ts) / 60)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };

export function mountActivity(ulId, getAddr) {
  const ul = document.getElementById(ulId); if (!ul) return;
  const render = () => {
    const a = getAddr(); if (!a) return;
    const items = load(a).items.slice().sort((x, y) => y.bn - x.bn || y.id.localeCompare(x.id)).slice(0, 12);
    ul.innerHTML = '';
    if (!items.length) { const li = document.createElement('li'); li.innerHTML = '<span class="note">No activity in the last hour.</span>'; ul.appendChild(li); }
    for (const it of items) {
      const li = document.createElement('li');
      const l = document.createElement('span'); l.textContent = it.text;
      const r = document.createElement('a'); r.href = EXPLORER + '/tx/' + it.hash; r.target = '_blank'; r.rel = 'noopener'; r.className = 'note'; r.textContent = ago(it.ts);
      li.append(l, r); ul.appendChild(li);
    }
  };
  const refresh = async () => { const a = getAddr(); if (!a) return; render(); try { await scan(a); } catch {} render(); };
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  window.addEventListener('bylaw:tx', () => setTimeout(refresh, 2500));
  const more = document.getElementById(ulId + '_more');
  if (more) { const a = getAddr(); if (a) more.href = EXPLORER + '/address/' + a; }
}
