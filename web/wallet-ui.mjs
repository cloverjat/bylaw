// Bylaw Wallet screens: create, dashboard, deposit, send, save recipient, propose / confirm / execute.
import { connect, short, usdc, waitFor, waitReceipt, deployCircle, EXPLORER } from './circle.mjs';
import { remember } from './finder.mjs';
import { ruleBadge, showBadge } from './official.mjs';
import { WALLET_CIRCUITS, WALLET_DEFAULTS, feeOf, KIND_NAME, MAX_UNITS, TRUST_DELAY, validateWallet, walletSentence, walletDeployData, readWallet, savedAt, tokenBalance, walletActions, toBase, unitsOf } from './wallet.mjs';
const $ = (id) => document.getElementById(id);
const qs = { get: (k) => new URLSearchParams(location.search).get(k) };
const say = (id, m, c = '') => { $(id).textContent = m; $(id).className = c; };
const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const ADDR = /^0x[0-9a-fA-F]{40}$/;
let me = null, W = null;
const caddr = () => (qs.get('wallet') || '').toLowerCase();

// ---- create ----
const CHOICES = {
  1: { a: 'Daily cap (in steps)', aDef: 50, help: 'The most this wallet can send in one day, in total.' },
  2: { a: 'Most a brand-new recipient can get (in steps)', aDef: 5, help: 'Saved recipients become trusted after 2 days. Until then, and for new ones, this is the limit.' },
  3: { a: 'Payments up to this go straight through (in steps)', aDef: 20, help: 'Anything above this needs the second person.' },
};
const kindNow = () => Number($('wc_kind').value);
function renderKind() {
  const k = kindNow(), c = CHOICES[k];
  $('wc_a_label').firstChild.textContent = c.a;
  $('wc_a').value = c.aDef;
  $('wc_b_row').hidden = k !== 2;
  $('wc_c_row').hidden = k !== 3;
  $('wc_help').textContent = c.help;
  $('wc_sum').hidden = true; $('wc_err').textContent = '';
}
$('wc_kind').innerHTML = Object.entries(KIND_NAME).map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
$('wc_kind').addEventListener('change', renderKind);
renderKind();
const form = () => ({
  kind: kindNow(), unitUsdc: Number($('wc_unit').value), limitA: Number($('wc_a').value), limitB: Number($('wc_b').value), confirmer: $('wc_c').value.trim(),
});
$('wc_review').addEventListener('click', () => {
  const f = form(), err = validateWallet({ ...f, owner: me });
  $('wc_err').textContent = err || ''; $('wc_sum').hidden = !!err;
  $('wc_ack').checked = false; $('wc_go').disabled = true;
  if (err) return;
  $('wc_text').textContent = walletSentence({ ...f, feeBps: WALLET_DEFAULTS.feeBps });
});
$('wc_ack').addEventListener('change', () => { $('wc_go').disabled = !$('wc_ack').checked; });
$('wc_go').addEventListener('click', async () => {
  const f = form();
  try {
    if (!me) me = await connect();
    const err = validateWallet({ ...f, owner: me });
    if (err) { $('wc_err').textContent = err; return; }
    say('wc_msg', 'Check your wallet and read the popup before you confirm...');
    const h = await deployCircle(me, walletDeployData(f));
    say('wc_msg', 'Sent. Waiting for the network...');
    const r = await waitReceipt(h);
    if (!r || r.status !== '0x1' || !r.contractAddress) { say('wc_msg', 'The wallet was not created.', 'bad'); return; }
    const name = $('wc_name').value.trim() || 'Bylaw Wallet';
    const link = location.origin + location.pathname + '?wallet=' + r.contractAddress + '&name=' + encodeURIComponent(name) + '#walCard';
    remember({ kind: 'wallet', addr: r.contractAddress, name, names: '' });
    say('wc_msg', 'Your wallet is created. Open this link to put money in and use it: ' + link, 'ok');
    history.replaceState(null, '', link);
    await load();
  } catch (e) { say('wc_msg', e.message || String(e), 'bad'); }
});

// ---- dashboard ----
const stepUsdc = () => W.unit / 1e6;
async function recipientNote() {
  const el = $('wl_to_note');
  el.textContent = '';
  if (!W || W.kind !== 2) return;
  const to = $('wl_to').value.trim();
  if (!ADDR.test(to)) return;
  const ts = await savedAt(caddr(), to.toLowerCase());
  const now = Math.floor(Date.now() / 1000);
  if (!ts) el.textContent = 'New recipient: not saved yet. Only up to ' + W.limitA * stepUsdc() + ' USDC is allowed, and only after you save them and wait ' + W.limitB + ' hour(s).';
  else if (now >= ts + TRUST_DELAY) el.textContent = 'Trusted recipient: any amount is allowed.';
  else el.textContent = 'Saved, but not trusted yet. Up to ' + W.limitA * stepUsdc() + ' USDC is allowed after ' + W.limitB + ' hour(s) from when you saved them. Trusted ' + new Date((ts + TRUST_DELAY) * 1000).toLocaleString() + '.';
}
async function load() {
  const c = caddr();
  if (!c) return;
  $('walCard').hidden = false; $('walHead').hidden = false;
  const nm = qs.get('name'); if (nm) $('wl_title').textContent = nm;
  try { W = await readWallet(c); } catch (e) { say('wl_msg', 'Could not read this as a Bylaw wallet: ' + e.message, 'bad'); return; }
  remember({ kind: 'wallet', addr: c, name: nm || 'Bylaw Wallet', names: '' });
  const st = stepUsdc(), cap = W.limitA * st;
  $('wl_bal').textContent = usdc(W.balance) + ' USDC';
  $('wl_kind').textContent = KIND_NAME[W.kind] || 'Unknown rule';
  $('wl_rule').textContent = walletSentence({ kind: W.kind, unitUsdc: st, limitA: W.limitA, limitB: W.limitB, confirmer: W.confirmer, feeBps: W.feeBps });
  const mine = !!me && me === W.owner;
  let line = 'Owner ' + short(W.owner) + (mine ? ' (you)' : '');
  if (W.kind === 1) line += ` · spent today ${usdc(W.spent)} of ${cap} USDC (the day resets at midnight UTC)`;
  if (W.kind === 3) line += ` · second person ${short(W.confirmer)}`;
  $('wl_facts').innerHTML = esc(line) + ` · <a href="${EXPLORER}/address/${c}" target="_blank" rel="noopener">view on explorer</a>`;
  showBadge($('wl_badge'), ruleBadge(W, WALLET_CIRCUITS[W.kind], 'wallet'));
  $('wl_kv').innerHTML = `<b>Wallet</b><span>${c}</span><b>Token</b><span>${W.token}</span><b>Circuit</b><span>#${W.circuitId} on ${W.processor}</span><b>Netlist hash</b><span>${W.netlistHash}</span><b>Kind</b><span>${W.kind} (step ${st} USDC, limit A ${W.limitA}, limit B ${W.limitB})</span>`;
  $('wl_conn').hidden = !!me;
  $('wl_dep').hidden = !me;
  $('wl_own').hidden = !mine;
  $('wl_notowner').hidden = !me || mine;
  $('wl_save').hidden = W.kind !== 2;
  $('wl_propnote').hidden = W.kind !== 3;
  $('wl_props_box').hidden = W.kind !== 3;
  if (W.kind === 3) {
    const isConfirmer = !!me && me === W.confirmer;
    const open = W.proposals.filter((p) => !p.executed);
    $('wl_props').innerHTML = open.length ? open.map((p) => {
      const state = p.confirmed ? '<span class="pill g">confirmed</span>' : '<span class="pill y">waiting for the second person</span>';
      const btn = !p.confirmed && isConfirmer ? `<button class="ghost" data-act="confirm" data-id="${p.id}">Confirm</button>` : p.confirmed && mine ? `<button class="ghost" data-act="execute" data-id="${p.id}">Send now</button>` : '';
      return `<li><span>${usdc(p.amount)} USDC to ${short(p.to)}</span><span>${state} ${btn}</span></li>`;
    }).join('') : '<li><span class="note">No payments are waiting.</span></li>';
  }
  if (me) $('wl_mybal').textContent = 'Your wallet holds ' + usdc(await tokenBalance(W, me)) + ' USDC.';
  recipientNote();
}
async function run(action, ...args) {
  try {
    if (!me) { me = await connect(); await load(); return; }
    say('wl_msg', 'Check your wallet and read the popup before you confirm...');
    const h = await walletActions[action](me, caddr(), W, ...args);
    say('wl_msg', 'Sent. Waiting for confirmation...');
    const ok = await waitFor(h);
    await load();
    say('wl_msg', ok ? 'Done. Confirmed.' : 'The transaction did not confirm.', ok ? 'ok' : 'bad');
  } catch (e) { say('wl_msg', e.message || String(e), 'bad'); }
}
const amountOf = (id) => {
  const v = $(id).value.trim();
  const base = toBase(v);
  if (!(Number(v) > 0) || base < 1) throw new Error('Enter an amount above zero.');
  return base;
};
$('wl_connect').addEventListener('click', async () => { try { me = await connect(); await load(); } catch (e) { say('wl_msg', e.message || String(e), 'bad'); } });
$('wl_dep_go').addEventListener('click', () => { try { run('deposit', amountOf('wl_dep_amt')); } catch (e) { say('wl_msg', e.message, 'bad'); } });
$('wl_save_go').addEventListener('click', () => {
  const to = $('wl_to').value.trim();
  if (!ADDR.test(to)) { say('wl_msg', 'Enter the recipient wallet address first (starts with 0x, 42 characters).', 'bad'); return; }
  run('saveRecipient', to.toLowerCase());
});
$('wl_to').addEventListener('input', () => { recipientNote(); });
$('wl_send_go').addEventListener('click', () => {
  try {
    const to = $('wl_to').value.trim();
    if (!ADDR.test(to)) throw new Error('Enter the recipient wallet address (starts with 0x, 42 characters).');
    const base = amountOf('wl_amt');
    const fee = feeOf(base, W.feeBps);
    if (base + fee > W.balance) throw new Error('Not enough in this wallet. It needs ' + usdc(base + fee) + ' USDC for this payment (' + usdc(base) + ' to the recipient plus ' + usdc(fee) + ' fee), and holds ' + usdc(W.balance) + '.');
    const units = unitsOf(base, W.unit);
    if (units > MAX_UNITS) throw new Error('That amount is too large for this wallet\'s rule to check. The largest is ' + MAX_UNITS * stepUsdc() + ' USDC per payment.');
    if (W.kind === 3 && units > W.limitA) {
      say('wl_msg', 'This is above your limit of ' + W.limitA * stepUsdc() + ' USDC, so it becomes a request. ' + short(W.confirmer) + ' must confirm it, then you send it.');
      run('propose', to.toLowerCase(), base);
      return;
    }
    run('send', to.toLowerCase(), base);
  } catch (e) { say('wl_msg', e.message, 'bad'); }
});
$('wl_props').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (b) run(b.dataset.act, Number(b.dataset.id));
});
load();
setInterval(() => { if (!document.hidden) load(); }, 15000);
