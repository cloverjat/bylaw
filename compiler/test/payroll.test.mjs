import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayrollRule, payrollReference, PAYROLL_PINS } from '../src/payroll.mjs';
import { proveExhaustive, evaluate, decode } from '../src/netlist.mjs';
import { toCanvas } from '../src/canvas.mjs';

test('payroll rule equals its reference on every input', () => {
  const c = buildPayrollRule();
  assert.equal(c.nIn, PAYROLL_PINS.nIn);
  const r = proveExhaustive(c, payrollReference);
  assert.equal(r.ok, true);
  assert.equal(r.checked, 2 ** 11);
});

test('payroll rule: spot checks', () => {
  const c = buildPayrollRule();
  const bits = (cycle, cycles, due, funded, unpaid) => [0, 1, 2, 3].map((i) => (cycle >> i) & 1).concat([0, 1, 2, 3].map((i) => (cycles >> i) & 1), [due, funded, unpaid]);
  assert.deepEqual(evaluate(c, bits(0, 6, 1, 1, 1)), [1]);
  assert.deepEqual(evaluate(c, bits(5, 6, 1, 1, 1)), [1]);
  assert.deepEqual(evaluate(c, bits(6, 6, 1, 1, 1)), [0]); // beyond the term
  assert.deepEqual(evaluate(c, bits(0, 6, 0, 1, 1)), [0]); // not due
  assert.deepEqual(evaluate(c, bits(0, 6, 1, 0, 1)), [0]); // not funded
  assert.deepEqual(evaluate(c, bits(0, 6, 1, 1, 0)), [0]); // already paid
});

test('payroll circuit uses no constants and exports to a canvas', () => {
  const c = buildPayrollRule();
  for (const [a, b] of decode(c.bytes)) assert.ok(a >= 2 && b >= 2);
  const cv = toCanvas(c);
  assert.equal(cv.nodes.filter((n) => n.type === 'input').length, 11);
  assert.equal(cv.nodes.filter((n) => n.type === 'nand').length, decode(c.bytes).length - 2);
  assert.equal(cv.edges.length, 2 * (decode(c.bytes).length - 2) + 1);
});
