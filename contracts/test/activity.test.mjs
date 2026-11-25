import test from 'node:test'; import assert from 'node:assert/strict';
import { id, AbiCoder, zeroPadValue } from 'ethers';
globalThis.window = globalThis.window || { addEventListener() {}, dispatchEvent() {}, location: { search: '' } };
globalThis.CustomEvent = globalThis.CustomEvent || class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
const { describeLog } = await import('../../web/activity.mjs');
const topic = (s) => id(s);
const addrT = (a) => zeroPadValue(a, 32);
const enc = (...v) => AbiCoder.defaultAbiCoder().encode(v.map(() => 'uint256'), v);
const A = '0x1111111111111111111111111111111111111111', B = '0x2222222222222222222222222222222222222222';
const n32 = (n) => '0x' + n.toString(16).padStart(64, '0');
test('circle events read as plain sentences (rounds shown from 1)', () => {
  assert.equal(describeLog({ topics: [topic('Contributed(uint8,address)'), n32(0), addrT(A)], data: '0x' }), '0x1111…1111 paid into round 1');
  assert.equal(describeLog({ topics: [topic('PaidOut(uint8,address,uint256)'), n32(1), addrT(B)], data: enc(29700000n) }), 'Round 2 paid out 29.7 USDC to 0x2222…2222');
  assert.equal(describeLog({ topics: [topic('FeePaid(uint8,address,uint256)'), n32(1), addrT(B)], data: enc(300000n) }), null);
});
test('payroll and wallet events', () => {
  assert.equal(describeLog({ topics: [topic('Paid(uint256,address,uint256)'), n32(2), addrT(A)], data: enc(5000000n) }), 'Cycle 3: 5 USDC paid to 0x1111…1111');
  assert.equal(describeLog({ topics: [topic('Sent(address,uint256)'), addrT(B)], data: enc(3000000n) }), 'Sent 3 USDC to 0x2222…2222');
  assert.equal(describeLog({ topics: [topic('Proposed(uint256,address,uint256)'), n32(7), addrT(B)], data: enc(40000000n) }), 'Payment #7 of 40 USDC to 0x2222…2222 is waiting for confirmation');
  assert.equal(describeLog({ topics: ['0x' + '00'.repeat(32)], data: '0x' }), null);
});
