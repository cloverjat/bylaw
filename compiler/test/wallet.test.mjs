import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCapRule, capReference, buildTrustRule, trustReference, buildConfirmRule, confirmReference, CAP_PINS, TRUST_PINS, CONFIRM_PINS } from '../src/wallet.mjs';
import { proveExhaustive, evaluate, decode } from '../src/netlist.mjs';

const noConstants = (c) => { for (const [a, b] of decode(c.bytes)) assert.ok(a >= 2 && b >= 2); };

test('daily cap rule equals its reference on all 262,144 inputs', () => {
  const c = buildCapRule(); noConstants(c);
  assert.equal(c.nIn, CAP_PINS.nIn);
  const r = proveExhaustive(c, capReference); assert.equal(r.ok, true); assert.equal(r.checked, 2 ** 18);
});
test('confirm rule equals its reference on all 8,192 inputs', () => {
  const c = buildConfirmRule(); noConstants(c);
  const r = proveExhaustive(c, confirmReference); assert.equal(r.ok, true); assert.equal(r.checked, 2 ** 13);
});
test('trusted-or-small rule equals its reference on 4 million random inputs and every edge of the comparisons', () => {
  const c = buildTrustRule(); noConstants(c);
  const bits = new Array(25);
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
  for (let n = 0; n < 4_000_000; n++) {
    let v = rnd() ^ (rnd() << 15);
    for (let i = 0; i < 25; i++) bits[i] = (v >> i) & 1;
    // keep the three-way comparisons interesting: often make the words equal or one apart
    if (n % 3 === 0) { const a = rnd() & 63; for (let i = 0; i < 6; i++) { bits[TRUST_PINS.amount + i] = (a >> i) & 1; bits[TRUST_PINS.trial + i] = ((a + (rnd() % 3) - 1 & 63) >> i) & 1; } }
    assert.deepEqual(evaluate(c, bits), trustReference(bits), JSON.stringify(bits));
  }
  // every pair of 6-bit words for both comparisons, with trusted = 0
  for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) {
    const b = new Array(25).fill(0);
    for (let i = 0; i < 6; i++) { b[TRUST_PINS.amount + i] = (x >> i) & 1; b[TRUST_PINS.trial + i] = (y >> i) & 1; b[TRUST_PINS.age + i] = (x >> i) & 1; b[TRUST_PINS.hours + i] = (y >> i) & 1; }
    assert.deepEqual(evaluate(c, b), trustReference(b));
    b[0] = 1; assert.deepEqual(evaluate(c, b), [1]);
  }
});
test('cap rule: spot checks', () => {
  const c = buildCapRule();
  const w = (n) => Array.from({ length: 6 }, (_, i) => (n >> i) & 1);
  const run = (a, s, cap) => evaluate(c, [...w(a), ...w(s), ...w(cap)])[0];
  assert.equal(run(10, 40, 50), 1); assert.equal(run(11, 40, 50), 0); assert.equal(run(63, 63, 63), 0); assert.equal(run(0, 0, 0), 1);
});
