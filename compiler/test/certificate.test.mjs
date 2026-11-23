import test from 'node:test';
import assert from 'node:assert/strict';
import { certify, describe } from '../src/certificate.mjs';
import { proveExhaustive } from '../src/netlist.mjs';
import { interpretSpec } from '../src/spec.mjs';

const circleSpec = {
  name: 'Circle payout',
  fields: [
    { name: 'recipient', bits: 4 }, { name: 'round', bits: 4 },
    { name: 'paid', bits: 4 }, { name: 'members', bits: 4 }, { name: 'window', bits: 1 },
  ],
  rule: { op: 'and', args: [
    { op: 'cmp', cmp: 'eq', left: { field: 'recipient' }, right: { field: 'round' } },
    { op: 'cmp', cmp: 'eq', left: { field: 'paid' }, right: { field: 'members' } },
    { op: 'flag', field: 'window' },
  ] },
};

const vaultSpec = {
  name: 'Vault daily cap and payee check (small widths)',
  fields: [{ name: 'amount', bits: 6 }, { name: 'spent', bits: 6 }, { name: 'cap', bits: 6 }, { name: 'trusted', bits: 1 }],
  rule: { op: 'and', args: [
    { op: 'cmp', cmp: 'lte', left: { field: 'amount' }, right: { field: 'cap' } },
    { op: 'cmp', cmp: 'lte', left: { field: 'spent' }, right: { field: 'cap' } },
    { op: 'or', args: [{ op: 'flag', field: 'trusted' }, { op: 'cmp', cmp: 'lt', left: { field: 'amount' }, right: { const: 10 } }] },
  ] },
};

test('Circle spec compiles and is certified over all 131,072 inputs', () => {
  const { certificate } = certify(circleSpec);
  assert.equal(certificate.proved, true);
  assert.equal(certificate.inputsChecked, 131072);
  console.log('circle certificate:', certificate.gates, 'gates');
  console.log(describe(circleSpec));
});

test('Vault-style spec with constants and OR is certified', () => {
  const { certificate } = certify(vaultSpec);
  assert.equal(certificate.proved, true);
  assert.equal(certificate.inputsChecked, 2 ** 19);
});

test('every comparison operator matches its meaning', () => {
  for (const cmp of ['eq', 'neq', 'lt', 'lte', 'gt', 'gte']) {
    const spec = { name: cmp, fields: [{ name: 'a', bits: 4 }, { name: 'b', bits: 4 }], rule: { op: 'cmp', cmp, left: { field: 'a' }, right: { field: 'b' } } };
    assert.equal(certify(spec).certificate.proved, true, cmp);
  }
});

test('a tampered circuit is caught: flipping one gate fails the proof with a counterexample', () => {
  const { circuit } = certify(circleSpec);
  const bad = { ...circuit, bytes: Uint8Array.from(circuit.bytes) };
  bad.bytes[6] ^= 1; // change one input of the first gate
  const proof = proveExhaustive(bad, (bits) => interpretSpec(circleSpec, bits));
  assert.equal(proof.ok, false);
  assert.ok(proof.counterexample);
});

test('bad specs are rejected', () => {
  assert.throws(() => certify({ name: 'x', fields: [{ name: 'a', bits: 4 }], rule: { op: 'flag', field: 'a' } }), /1-bit/);
  assert.throws(() => certify({ name: 'x', fields: [{ name: 'a', bits: 4 }], rule: { op: 'cmp', cmp: 'eq', left: { field: 'z' }, right: { const: 1 } } }), /unknown field/);
});
