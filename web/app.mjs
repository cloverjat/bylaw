import { TEMPLATES, fromTemplate } from '../compiler/src/templates.mjs';
import { certify, describe } from '../compiler/src/certificate.mjs';

const $ = (id) => document.getElementById(id);
const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');

const INFO = {
  circle: { what: 'Friends each pay the same amount every round. The whole pot goes to one member per round, in turn, straight to their wallet.', ex: '5 friends pay 10 USDC a month. In month 1, friend 1 gets 50 USDC. In month 2, friend 2 gets it, and so on.', who: 'Savings groups, friends, family, communities (ajo, esusu, chama).', status: 'live', note: 'Live on X Layer. Try it above.' },
  dailyCap: { what: 'A wallet cannot spend more than a set amount per day. A payment that would go over the cap is refused.', ex: 'A team wallet with a 50 USDC daily cap. If someone steals the key, they can only take 50 a day.', who: 'Teams and businesses that share a wallet.', status: 'soon', note: 'The rule is proven. The wallet contract that enforces it is coming.' },
  trustedOrSmall: { what: 'Paying a saved, trusted address is always fine. A brand-new address can only get small amounts, and only after a waiting time.', ex: 'Pay your supplier freely. A new address can get at most 5 USDC, and only after 24 hours.', who: 'Anyone worried about typing the wrong address or being scammed.', status: 'soon', note: 'The rule is proven. The wallet contract that enforces it is coming.' },
  confirmAbove: { what: 'Small payments go through. Anything above your limit needs a second confirmation first.', ex: 'Staff can pay up to 20 USDC. Above that, the owner must also confirm.', who: 'Businesses that want a second pair of eyes on big payments.', status: 'soon', note: 'The rule is proven. The wallet contract that enforces it is coming.' },
};
function renderParams(key) {
  const t = TEMPLATES[key];
  const i = INFO[key];
  $('blurb').innerHTML = `<b>What it does:</b> ${i.what}<br><b>Example:</b> ${i.ex}<br><b>Who it's for:</b> ${i.who}<br><span class="pill ${i.status === 'live' ? 'g' : 'y'}">${i.status === 'live' ? 'Live' : 'Coming soon'}</span> ${i.note}`;
  $('params').innerHTML = t.params.map((p) => `<label>${p.label}<input type="number" id="p_${p.name}" min="${p.min}" max="${p.max}" value="${p.def}"></label>`).join('');
  t.params.forEach((p) => $('p_' + p.name).addEventListener('input', run));
}

function run() {
  const key = $('tpl').value;
  const values = {};
  TEMPLATES[key].params.forEach((p) => (values[p.name] = Number($('p_' + p.name).value)));
  let spec;
  try { spec = fromTemplate(key, values); } catch (e) { $('error').textContent = e.message; $('out').hidden = true; return; }
  $('error').textContent = '';
  $('out').hidden = false;
  $('sentence').textContent = describe(spec);
  $('status').textContent = 'Proving over every possible input...';
  setTimeout(() => {
    const t0 = performance.now();
    const { certificate, circuit } = certify(spec);
    $('status').textContent = certificate.proved
      ? `Verified: this rule was checked against all ${certificate.inputsChecked.toLocaleString()} possible cases and never breaks (${Math.round(performance.now() - t0)} ms).`
      : 'PROOF FAILED. Do not use this circuit.';
    $('status').className = certificate.proved ? 'ok' : 'bad';
    $('cert').textContent = JSON.stringify(certificate, null, 2);
    $('netlist').textContent = '0x' + hex(circuit.bytes);
    $('gates').textContent = `${certificate.gates} NAND gates, ${circuit.bytes.length} bytes`;
  }, 20);
}

$('tpl').innerHTML = Object.entries(TEMPLATES).map(([k, t]) => `<option value="${k}">${t.title}</option>`).join('');
$('tpl').addEventListener('change', () => { renderParams($('tpl').value); run(); });
renderParams($('tpl').value);
run();

// ---- Live circle dashboard ----
import { DEMO_CIRCLE, wallet, readCircle, connect, actions, waitFor, allowanceOf, short, usdc, EXPLORER, deployCircle, waitReceipt } from './circle.mjs';
import { validate, deployData } from './create.mjs';
import { remember, renderFinder } from './finder.mjs';
let me = null, state = null, allowance = 0;
const setMode = (dev) => { document.body.classList.toggle('dev', dev); $('m_dev').classList.toggle('on', dev); $('m_simple').classList.toggle('on', !dev); };
$('m_simple').addEventListener('click', () => setMode(false));
$('m_dev').addEventListener('click', () => setMode(true));
if (!wallet()) { $('nowallet').hidden = false; $('okxopen').href = 'https://www.okx.com/download?deeplink=' + encodeURIComponent('okx://wallet/dapp/url?dappUrl=' + encodeURIComponent(location.href)); }
$('caddr').value = new URLSearchParams(location.search).get('circle') || '';
if ($('caddr').value) { $('circleCard').hidden = false; $('circleHead').hidden = false; }
const say = (m, cls = '') => { $('cmsg').textContent = m; $('cmsg').className = cls; };
const NAMES = (new URLSearchParams(location.search).get('names') || '').split(',').map((x) => x.trim());
const who = (m, i) => { const nm = NAMES[i] || 'Member ' + (i + 1); return (me === m ? 'You, ' + nm : nm) + ' (' + short(m) + ')'; };

const GRACE = 7 * 86400;
function nextStep() {
  const s = state;
  if (s.failed) {
    const i = me ? s.members.indexOf(me) : -1;
    if (i >= 0 && s.paid[i]) return { label: 'Take my money back: ' + usdc(s.contribution) + ' USDC', act: 'claimRefund', help: 'This circle was closed because someone did not pay. Everyone who paid this round gets their payment back.' };
    return null;
  }
  if (s.round >= s.count) return null;
  const idx = me ? s.members.indexOf(me) : -1;
  const everyonePaid = s.paid.every(Boolean);
  const windowOver = s.now >= s.roundEnd;
  if (!me) return { label: 'Connect your wallet to start', act: 'connect', help: 'You need the OKX Wallet with a little USDC and OKB on X Layer.' };
  if (idx >= 0 && !s.paid[idx]) {
    if (allowance < s.contribution) return { label: 'Step 1: allow this circle to take your payment', act: 'approve', help: 'A permission slip. No money moves yet. Your wallet will ask you to confirm.' };
    return { label: 'Pay your share: ' + usdc(s.contribution) + ' USDC', act: 'contribute', help: 'Your wallet shows the exact amount before you confirm.' };
  }
  const left = Math.max(0, Math.ceil((s.roundEnd - s.now) / 60));
  if (everyonePaid && windowOver) return { label: 'Send the pot to ' + who(s.members[s.round], s.round), act: 'payout', help: 'Anyone can press this. The public rule checks it first and refuses a wrong person.' };
  if (everyonePaid) return { label: 'Everyone has paid. The pot unlocks in about ' + left + ' min', act: null, help: 'The rule only releases the pot when everyone has paid and the round time is over.' };
  const missing = s.paid.filter((p) => !p).length;
  if (s.now >= s.roundEnd + GRACE) return { label: 'Someone never paid: close this circle and refund everyone', act: 'declareFailed', help: 'The 7-day grace period is over. Anyone can close the circle, and then everyone who paid can take their money back.' };
  return { label: 'Waiting for ' + missing + ' more to pay', act: null, help: idx < 0 ? 'This wallet is not a member of this circle.' : idx >= 0 && s.paid[idx] ? 'You have paid. The pot is released only when everyone has paid and the round time is over. If someone has not paid 7 days after the round ends, the circle can be closed and everyone refunded.' : '' };
}

async function refresh() {
  const c = $('caddr').value.trim().toLowerCase();
  if (!c) return;
  say('Loading from X Layer...');
  try { state = await readCircle(c); allowance = me ? await allowanceOf(state, c, me) : 0; } catch (e) { say('Could not read this address as a Bylaw circle.', 'bad'); return; }
  const s = state;
  $('cview').hidden = false;
  const done = s.round >= s.count;
  $('chead').textContent = s.failed ? 'This circle was closed.' : done ? 'Finished: every member has been paid.'
    : `Round ${s.round + 1} of ${s.count}: ${who(s.members[s.round], s.round)} gets ${usdc(s.contribution * s.count)} USDC.`;
  const paidN = s.paid.filter(Boolean).length;
  $('cbar').style.width = (done ? 100 : (paidN / s.count) * 100) + '%';
  $('cprog').textContent = done ? '' : `${paidN} of ${s.count} have paid in this round`;
  $('clist').innerHTML = s.members.map((m, i) => {
    const p = done || i < s.round ? '<span class="pill g">got their turn</span>' : i === s.round ? '<span class="pill y">gets this round</span>' : '';
    const q = done ? '' : s.paid[i] ? '<span class="pill g">paid</span>' : '<span class="pill">not paid yet</span>';
    return `<li><span>${who(m, i)}</span><span>${p} ${q}</span></li>`;
  }).join('');
  const left = s.roundEnd - s.now;
  $('cfacts').innerHTML = `Each member pays ${usdc(s.contribution)} USDC a round. A ${s.feeBps / 100}% circle fee is taken from each pot automatically. Held in the circle now: ${usdc(s.balance)} USDC. ` +
    (done || s.failed ? '' : left > 0 ? `This round's time ends in about ${Math.ceil(left / 60)} min.` : 'This round\'s time is over.') +
    ` <a href="${EXPLORER}/address/${c}" target="_blank" rel="noopener">View on the blockchain explorer</a>`;
  $('ckv').innerHTML = `<b>Circle</b><span>${c}</span><b>Token</b><span>${s.token}</span><b>Circuit</b><span>#${s.circuitId} on ${s.processor}</span><b>Netlist hash</b><span>${s.netlistHash}</span><b>Fee</b><span>${s.feeBps} bps to ${s.feeRecipient}</span><b>Round</b><span>${s.round} (paidCount ${s.paidCount})</span>`;
  const n = nextStep();
  $('cta').disabled = !n || !n.act;
  $('cta').textContent = n ? n.label : done ? 'All done' : 'Closed';
  $('cta').dataset.act = n && n.act || '';
  $('chelp').textContent = n ? n.help : '';
  for (const b of ['approve', 'contribute', 'payout']) $('b_' + b).disabled = !me || done || s.failed;
  $('cta').dataset.act = n && n.act || '';
  say('');
}
async function act(name) {
  try {
    if (name === 'connect' && !wallet()) { const u = 'https://www.okx.com/download?deeplink=' + encodeURIComponent('okx://wallet/dapp/url?dappUrl=' + encodeURIComponent(location.href)); $('cmsg').innerHTML = 'This browser has no wallet. <a href="' + u + '">Tap here to open this page inside the OKX app</a>, then press Connect again. You can still look at any circle without connecting.'; $('cmsg').className = 'err'; return; }
    if (name === 'connect') { me = await connect(); $('me').textContent = ' Connected: ' + short(me); await refresh(); return; }
    const c = $('caddr').value.trim().toLowerCase();
    say('Check your wallet and read the popup before you confirm...');
    const h = await actions[name](me, c, state);
    say('Sent. Waiting for confirmation...');
    const ok = await waitFor(h);
    await refresh();
    say(ok ? 'Done. Transaction ' + h.slice(0, 10) + '... confirmed.' : 'The transaction did not confirm.', ok ? 'ok' : 'bad');
  } catch (e) { say(e.message || String(e), 'bad'); }
}
$('load').addEventListener('click', refresh);
$('conn').addEventListener('click', () => act('connect'));
$('cta').addEventListener('click', () => act($('cta').dataset.act));
for (const b of ['approve', 'contribute', 'payout']) $('b_' + b).addEventListener('click', () => act(b));
refresh();
import './payroll-ui.mjs';

// ---- Create a circle ----
const rows = [];
function addRow(n = '', wl = '') {
  const d = document.createElement('div');
  d.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:6px 0';
  d.innerHTML = '<input placeholder="Name" style="flex:1 1 110px"><input placeholder="Wallet address (0x...)" style="flex:3 1 240px">';
  d.children[0].value = n; d.children[1].value = wl;
  $('cn_rows').appendChild(d); rows.push(d);
}
addRow(); addRow(); addRow();
$('cn_add').addEventListener('click', () => addRow());
function readForm() {
  return { names: rows.map((r) => r.children[0].value.trim()), wallets: rows.map((r) => r.children[1].value.trim()), usdc: Number($('cn_amt').value), periodSeconds: Math.round(Number($('cn_per').value) * Number($('cn_unit').value)) };
}
const unitName = () => { const u = $('cn_unit').selectedOptions[0].textContent; return Number($('cn_per').value) === 1 ? u.replace(/s$/, '') : u; };
$('cn_review').addEventListener('click', () => {
  const f = readForm();
  const err = validate(f);
  $('cn_err').textContent = err || '';
  $('cn_sum').hidden = !!err;
  if (err) return;
  const pot = Math.round(f.usdc * 1e6 * f.names.length) / 1e6;
  $('cn_text').textContent = `${f.names.join(', ')} each pay ${f.usdc} USDC every ${$('cn_per').value} ${unitName()}. Each round the whole pot (${pot} USDC, minus a 1% fee) goes to one member, in this order: ${f.names.join(', ')}. The pot is released only when everyone has paid and the round time is over.`;
});
$('cn_go').addEventListener('click', async () => {
  const f = readForm();
  const err = validate(f);
  if (err) { $('cn_err').textContent = err; return; }
  const out = (m, c = '') => { $('cn_msg').textContent = m; $('cn_msg').className = c; };
  try {
    if (!me) { me = await connect(); $('me').textContent = ' Connected: ' + short(me); }
    out('Check your wallet and read the popup before you confirm...');
    const h = await deployCircle(me, deployData(f));
    out('Sent. Waiting for the network...');
    const r = await waitReceipt(h);
    if (!r || r.status !== '0x1' || !r.contractAddress) { out('The circle was not created.', 'bad'); return; }
    const link = location.origin + location.pathname + '?circle=' + r.contractAddress + '&names=' + encodeURIComponent(f.names.join(',')) + '&name=' + encodeURIComponent($('cn_name').value.trim());
    out('Your circle is live! Share this link with your members: ' + link, 'ok');
    $('caddr').value = r.contractAddress;
    $('circleCard').hidden = false; $('circleHead').hidden = false;
    remember({ kind: 'circle', addr: r.contractAddress, name: $('cn_name').value.trim() || 'Savings circle', names: f.names.join(',') });
    NAMES.splice(0, NAMES.length, ...f.names);
    await refresh();
  } catch (e) { out(e.message || String(e), 'bad'); }
});

renderFinder($('fd_list'), $('fd_empty'), $('fd_in'), $('fd_go'), $('fd_err'));
{ const p = new URLSearchParams(location.search); if (p.get('circle')) remember({ kind: 'circle', addr: p.get('circle'), name: p.get('name') || 'Savings circle', names: p.get('names') || '' }); }
