import { TEMPLATES, fromTemplate } from '../compiler/src/templates.mjs';
import { certify, describe } from '../compiler/src/certificate.mjs';

const $ = (id) => document.getElementById(id);
const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');

function renderParams(key) {
  const t = TEMPLATES[key];
  $('blurb').textContent = t.blurb;
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
import { DEMO_CIRCLE, readCircle, connect, actions, waitFor, allowanceOf, short, usdc, EXPLORER } from './circle.mjs';
let me = null, state = null, allowance = 0;
const setMode = (dev) => { document.body.classList.toggle('dev', dev); $('m_dev').classList.toggle('on', dev); $('m_simple').classList.toggle('on', !dev); };
$('m_simple').addEventListener('click', () => setMode(false));
$('m_dev').addEventListener('click', () => setMode(true));
$('caddr').value = new URLSearchParams(location.search).get('circle') || DEMO_CIRCLE;
const say = (m, cls = '') => { $('cmsg').textContent = m; $('cmsg').className = cls; };
const who = (m, i) => (me === m ? 'You' : 'Member ' + (i + 1)) + ' (' + short(m) + ')';

function nextStep() {
  const s = state;
  if (s.failed || s.round >= s.count) return null;
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
  return { label: 'Waiting for ' + missing + ' more to pay', act: null, help: idx < 0 ? 'This wallet is not a member of this circle.' : idx >= 0 && s.paid[idx] ? 'You have paid. The pot is released only when everyone has paid and the round time is over.' : '' };
}

async function refresh() {
  const c = $('caddr').value.trim().toLowerCase();
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
  say('');
}
async function act(name) {
  try {
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
