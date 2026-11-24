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
      ? `Proven: the circuit matches the rule on all ${certificate.inputsChecked.toLocaleString()} possible inputs (${Math.round(performance.now() - t0)} ms).`
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
let me = null, state = null;
$('caddr').value = new URLSearchParams(location.search).get('circle') || DEMO_CIRCLE;
const say = (m, cls = '') => { $('cmsg').textContent = m; $('cmsg').className = cls; };

async function refresh() {
  const c = $('caddr').value.trim().toLowerCase();
  say('Loading from X Layer...');
  try { state = await readCircle(c); } catch (e) { say('Could not read this address as a Bylaw circle.', 'bad'); return; }
  const s = state;
  $('cview').hidden = false;
  const done = s.round >= s.count;
  $('chead').textContent = s.failed ? 'This circle was closed.' : done ? 'Finished: every member has been paid.'
    : `Round ${s.round + 1} of ${s.count}: ${short(s.members[s.round])} gets the pot (${usdc(s.contribution * s.count)} USDC).`;
  $('clist').innerHTML = s.members.map((m, i) => {
    const tags = [i === s.round && !done ? 'wins this round' : i < s.round ? 'already paid out' : '', !done && s.paid[i] ? 'paid in' : !done ? 'not paid yet' : '', me === m ? 'you' : ''].filter(Boolean).join(', ');
    return `<li><b>${short(m)}</b> (${tags})</li>`;
  }).join('');
  const left = s.roundEnd - s.now;
  $('cfacts').innerHTML = `Each member pays ${usdc(s.contribution)} USDC per round. The circle fee is ${s.feeBps / 100}% of each pot, sent automatically to ${short(s.feeRecipient)}. Held now: ${usdc(s.balance)} USDC. ` +
    (done || s.failed ? '' : left > 0 ? `If someone is missing, the waiting time ends in about ${Math.ceil(left / 60)} min.` : 'The waiting time is over.') +
    ` <a href="${EXPLORER}/address/${$('caddr').value.trim()}" target="_blank" rel="noopener">View on explorer</a>`;
  for (const b of ['approve', 'contribute', 'payout']) $('b_' + b).disabled = !me || done || s.failed;
  say('');
}
async function act(name) {
  try {
    const c = $('caddr').value.trim().toLowerCase();
    say('Check your wallet and read the popup before you confirm...');
    const h = await actions[name](me, c, state);
    say('Sent. Waiting for confirmation...');
    const ok = await waitFor(h);
    await refresh();
    say(ok ? 'Done. ' + 'Transaction ' + h.slice(0, 10) + '… confirmed.' : 'The transaction did not confirm.', ok ? 'ok' : 'bad');
  } catch (e) { say(e.message || String(e), 'bad'); }
}
$('load').addEventListener('click', refresh);
$('conn').addEventListener('click', async () => {
  try { me = await connect(); $('me').textContent = 'Connected: ' + short(me); await refresh(); } catch (e) { say(e.message, 'bad'); }
});
for (const b of ['approve', 'contribute', 'payout']) $('b_' + b).addEventListener('click', () => act(b));
refresh();
