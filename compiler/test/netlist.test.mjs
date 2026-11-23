import test from 'node:test';
import assert from 'node:assert/strict';
import { Builder, evaluate, pack, proveExhaustive } from '../src/netlist.mjs';

const word = (bits, from, n) => bits.slice(from, from + n).reduce((s, b, i) => s + b * 2 ** i, 0);

test('basic gates match truth tables', () => {
  const b = new Builder(2);
  const [x, y] = [b.input(0), b.input(1)];
  const c = b.build([b.and(x, y), b.or(x, y), b.xor(x, y), b.xnor(x, y)]);
  const ref = ([p, q]) => [p & q, p | q, p ^ q, 1 ^ (p ^ q)];
  assert.deepEqual(proveExhaustive(c, ref), { ok: true, checked: 4 });
});

test('half adder example: eval 0x03 gives 0x02 (sum 0, carry 1)', () => {
  const b = new Builder(2);
  const [x, y] = [b.input(0), b.input(1)];
  const c = b.build([b.xor(x, y), b.and(x, y)]);
  assert.equal(pack(evaluate(c, [1, 1]))[0], 0x02);
});

test('8-bit "spent + amount <= cap"-style comparator is proven over all 65,536 inputs', () => {
  const b = new Builder(16);
  const A = Array.from({ length: 8 }, (_, i) => b.input(i));
  const B = Array.from({ length: 8 }, (_, i) => b.input(8 + i));
  const c = b.build([b.lte(A, B)]);
  const ref = (bits) => [word(bits, 0, 8) <= word(bits, 8, 8) ? 1 : 0];
  const proof = proveExhaustive(c, ref);
  assert.equal(proof.ok, true);
  assert.equal(proof.checked, 65536);
  console.log(`8-bit lte: ${c.nGates} NAND gates, ${c.bytes.length} bytes`);
});

test('a wrong circuit is caught with a counterexample', () => {
  const b = new Builder(2);
  const c = b.build([b.or(b.input(0), b.input(1))]);
  const proof = proveExhaustive(c, ([p, q]) => [p & q]);
  assert.equal(proof.ok, false);
  assert.ok(proof.counterexample);
});

test('outputs are the last nOut gates and gates only reference earlier signals', () => {
  const b = new Builder(3);
  const c = b.build([b.input(0), b.and(b.input(1), b.input(2))]);
  assert.equal(c.nOut, 2);
  assert.throws(() => new Builder(1).nand(5, 5), /future signal/);
});
