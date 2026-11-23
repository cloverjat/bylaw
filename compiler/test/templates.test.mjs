import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, fromTemplate } from '../src/templates.mjs';
import { certify, describe } from '../src/certificate.mjs';
import { sha256 } from '../src/sha256.mjs';
import { evaluate } from '../src/netlist.mjs';
import { createHash } from 'node:crypto';

test('pure-JS sha256 matches Node crypto', () => {
  for (const s of ['', 'abc', 'x'.repeat(200)]) {
    assert.equal(sha256(new TextEncoder().encode(s)), createHash('sha256').update(s).digest('hex'));
  }
});

for (const key of Object.keys(TEMPLATES)) {
  test(`template "${key}" compiles and is proven on every input`, () => {
    const spec = fromTemplate(key);
    const { certificate } = certify(spec);
    console.log(`${key}: ${certificate.gates} gates, ${certificate.inputsChecked} inputs. ${describe(spec)}`);
    assert.equal(certificate.proved, true);
  });
}

test('daily cap actually blocks over the cap and allows at the cap', () => {
  const { circuit } = certify(fromTemplate('dailyCap', { cap: 50 }));
  const run = (amount, spent) => {
    const bits = [];
    for (let i = 0; i < 6; i++) bits.push((amount >> i) & 1);
    for (let i = 0; i < 6; i++) bits.push((spent >> i) & 1);
    return evaluate(circuit, bits)[0];
  };
  assert.equal(run(10, 40), 1); // exactly at the cap
  assert.equal(run(11, 40), 0); // one over
  assert.equal(run(50, 0), 1);
  assert.equal(run(51, 0), 0);
  assert.equal(run(63, 63), 0); // 126 must not wrap around
});

test('template numbers are range-checked', () => {
  assert.throws(() => fromTemplate('dailyCap', { cap: 64 }), /whole number/);
  assert.throws(() => fromTemplate('dailyCap', { cap: 1.5 }), /whole number/);
});
