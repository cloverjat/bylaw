import test from 'node:test';
import assert from 'node:assert/strict';
import { toBlif, evalBlif } from '../src/blif.mjs';
import { evaluate } from '../src/netlist.mjs';
import { buildCirclePayoutRule } from '../src/circle.mjs';
import { fromTemplate } from '../src/templates.mjs';
import { certify } from '../src/certificate.mjs';

function sameEverywhere(circuit) {
  const blif = toBlif(circuit);
  const n = circuit.nIn;
  const bits = new Array(n).fill(0);
  for (let v = 0; v < 2 ** Math.min(n, 17); v++) {
    for (let i = 0; i < n; i++) bits[i] = Math.floor(v / 2 ** i) % 2;
    assert.deepEqual(evalBlif(blif, bits), evaluate(circuit, bits));
  }
}

test('BLIF export of the Circle rule matches the circuit on every input', () => sameEverywhere(buildCirclePayoutRule()));
test('BLIF export of every template matches (constants included)', () => {
  for (const k of ['dailyCap', 'trustedOrSmall', 'confirmAbove']) sameEverywhere(certify(fromTemplate(k)).circuit);
});
test('BLIF has the expected shape', () => {
  const b = toBlif(buildCirclePayoutRule(), 'bylaw_circle_payout');
  assert.match(b, /^\.model bylaw_circle_payout\n\.inputs i0 .* i16\n\.outputs o0\n/);
  assert.ok(b.trim().endsWith('.end'));
});
