import { connect, short, usdc, waitFor, waitReceipt, deployCircle, EXPLORER } from './circle.mjs';
import { validatePayroll, payrollTotals, payrollDeployData, readPayroll, payrollActions, payrollAllowance, RECLAIM_DELAY } from './payroll.mjs';
const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const NAMES = (qs.get('names') || '').split(',').map((x) => x.trim());
let me = null, S = null;
const unit = () => { const u = $('py_unit').selectedOptions[0].textContent; return Number($('py_per').value) === 1 ? u.replace(/s$/, '') : u; };
const say = (id, m, c = '') => { $(id).textContent = m; $(id).className = c; };

// ---- create ----
const rows = [];
function addRow() {
  const d = document.createElement('div');
  d.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:6px 0';
  d.innerHTML = '<input placeholder="Name" style="flex:1 1 100px"><input placeholder="Wallet address (0x...)" style="flex:3 1 220px"><input type="number" min="0" step="0.01" placeholder="USDC per cycle" style="flex:1 1 100px">';
  $('py_rows').appendChild(d); rows.push(d);
}
addRow(); addRow();
$('py_add').addEventListener('click', addRow);
const form = () => ({
  names: rows.map((r) => r.children[0].value.trim()), wallets: rows.map((r) => r.children[1].value.trim()), amounts: rows.map((r) => Number(r.children[2].value)),
  periodSeconds: Math.round(Number($('py_per').value) * Number($('py_unit').value)), cycles: Number($('py_cyc').value),
});
$('py_review').addEventListener('click', () => {
  const f = form(), err = validatePayroll(f);
  $('py_err').textContent = err || ''; $('py_sum').hidden = !!err;
  if (err) return;
  const { total, fee } = payrollTotals(f);
  const who = f.names.map((n, i) => `${n} ${f.amounts[i]} USDC`).join(', ');
  $('py_text').textContent = `Every ${$('py_per').value} ${unit()}, for ${f.cycles} cycles, this payroll pays: ${who}. You put in ${usdc(total)} USDC once (plus a ${usdc(fee)} USDC fee). Pay for each cycle is released at the end of that cycle, only if the public rule says yes. Nobody can change this, including you. Whatever the workers never claim can return to you 90 days after the last cycle.`;
});
$('py_go').addEventListener('click', async () => {
  const f = form(), err = validatePayroll(f);
  if (err) { $('py_err').textContent = err; return; }
  try {
    if (!me) me = await connect();
    say('py_msg', 'Check your wallet and read the popup before you confirm...');
    const h = await deployCircle(me, payrollDeployData(f));
    say('py_msg', 'Sent. Waiting for the network...');
    const r = await waitReceipt(h);
    if (!r || r.status !== '0x1' || !r.contractAddress) { say('py_msg', 'The payroll was not created.', 'bad'); return; }
    const link = location.origin + location.pathname + '?payroll=' + r.contractAddress + '&names=' + encodeURIComponent(f.names.join(',')) + '#payCard';
    say('py_msg', 'Payroll created. Open this link to fund it (step 2) and share it with your team: ' + link, 'ok');
    history.replaceState(null, '', link); NAMES.splice(0, NAMES.length, ...f.names); await load();
  } catch (e) { say('py_msg', e.message || String(e), 'bad'); }
});

// ---- dashboard ----
const now = () => Math.floor(Date.now() / 1000);
const dueAt = (k) => S.start + (k + 1) * S.period;
function nextPay() {
  if (!S.funded) return null;
  for (let k = 0; k < S.cycles; k++) if (now() >= dueAt(k)) for (let i = 0; i < S.count; i++) if (!S.paid[k][i]) return { k, i };
  return null;
}
async function load() {
  const c = qs.get('payroll');
  if (!c) return;
  $('payCard').hidden = false;
  try { S = await readPayroll(c.toLowerCase()); } catch (e) { say('pv_msg', 'Could not read this payroll: ' + e.message, 'bad'); return; }
  const done = S.paid.flat().filter(Boolean).length, all = S.cycles * S.count;
  $('pv_bar').style.width = (all ? (done / all) * 100 : 0) + '%';
  $('pv_prog').textContent = S.funded ? `${done} of ${all} payments made` : 'Waiting for the employer to fund it';
  $('pv_list').innerHTML = S.workers.map((wk, i) => {
    const chips = S.paid.map((row, k) => (row[i] ? '✅' : S.funded && now() >= dueAt(k) ? '⏳ due' : '·')).join(' ');
    return `<li><span><b>${NAMES[i] || 'Worker ' + (i + 1)}</b> (${short(wk)})<br><small>${usdc(S.amounts[i])} USDC per cycle</small></span><span>${chips}</span></li>`;
  }).join('');
  const mine = me && me === S.boss;
  let cta = { label: me ? 'Nothing to do right now' : 'Connect your wallet', act: me ? '' : 'connect', help: '' };
  const np = nextPay();
  if (!S.funded) {
    if (mine) {
      const al = await payrollAllowance(S, me, qs.get('payroll').toLowerCase());
      cta = al >= S.total + S.fee ? { label: 'Fund the payroll: ' + usdc(S.total + S.fee) + ' USDC', act: 'fund', help: 'Step 2 of 2. This locks the money in the payroll and starts the clock.' } : { label: 'Step 1: allow ' + usdc(S.total + S.fee) + ' USDC', act: 'approve', help: 'Your wallet asks to let the payroll take exactly this amount. Then you fund it.' };
    } else cta.help = 'The employer ' + short(S.boss) + ' has not funded this payroll yet.';
  } else if (np) cta = { label: `Release pay: ${NAMES[np.i] || 'Worker ' + (np.i + 1)}, cycle ${np.k + 1} (${usdc(S.amounts[np.i])} USDC)`, act: 'pay', help: 'Anyone can press this. The money always goes to the worker, and only if the public rule says yes.' };
  else if (S.funded && mine && now() >= S.start + S.cycles * S.period + RECLAIM_DELAY && !S.reclaimed && S.total > S.paidOut) cta = { label: 'Take back unclaimed money: ' + usdc(S.total - S.paidOut) + ' USDC', act: 'reclaim', help: 'More than 90 days after the last cycle.' };
  else if (S.funded && me) cta.help = done === all ? 'Every cycle has been paid. This payroll is finished.' : 'The next cycle ends ' + new Date(dueAt(S.paid.findIndex((r) => r.some((x) => !x))) * 1000).toLocaleString() + '.';
  $('pv_cta').textContent = cta.label; $('pv_cta').dataset.act = cta.act; $('pv_cta').disabled = !cta.act; $('pv_help').textContent = cta.help;
  $('pv_facts').innerHTML = `Employer ${short(S.boss)} · total ${usdc(S.total)} USDC · ${S.cycles} cycles of ${Math.round(S.period / 3600 * 100) / 100} hours · <a href="${EXPLORER}/address/${qs.get('payroll')}">view on explorer</a>`;
}
$('pv_cta').addEventListener('click', async () => {
  const act = $('pv_cta').dataset.act, c = qs.get('payroll').toLowerCase();
  try {
    if (act === 'connect') { me = await connect(); await load(); return; }
    say('pv_msg', 'Check your wallet and read the popup before you confirm...');
    let h;
    if (act === 'pay') { const np = nextPay(); h = await payrollActions.pay(me, c, np.i, np.k); }
    else h = await payrollActions[act](me, c, S);
    say('pv_msg', 'Sent. Waiting for confirmation...');
    const ok = await waitFor(h);
    await load();
    say('pv_msg', ok ? 'Done. Confirmed.' : 'The transaction did not confirm.', ok ? 'ok' : 'bad');
  } catch (e) { say('pv_msg', e.message || String(e), 'bad'); }
});
load();
