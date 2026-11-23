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
