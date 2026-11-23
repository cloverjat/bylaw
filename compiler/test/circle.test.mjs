import test from 'node:test';
import assert from 'node:assert/strict';
import { proveExhaustive } from '../src/netlist.mjs';
import { buildCirclePayoutRule, circleReference } from '../src/circle.mjs';

test('Circle payout rule is proven over all 131,072 inputs', () => {
  const c = buildCirclePayoutRule();
  const proof = proveExhaustive(c, circleReference);
  assert.equal(proof.ok, true);
  assert.equal(proof.checked, 131072);
  console.log(`Circle rule: ${c.nGates} NAND gates, ${c.bytes.length} bytes`);
});
