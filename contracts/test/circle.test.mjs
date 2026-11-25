import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ganache from 'ganache';
import { ethers } from 'ethers';
import { buildCirclePayoutRule } from '../../compiler/src/circle.mjs';
import { Builder } from '../../compiler/src/netlist.mjs';

const art = (n) => JSON.parse(fs.readFileSync(new URL(`../out/${n}.json`, import.meta.url)));
const hex = (u8) => '0x' + Buffer.from(u8).toString('hex');

async function setup(feeBps = 0n) {
  const server = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 6 }, chain: { hardfork: 'shanghai' } });
  const provider = new ethers.BrowserProvider(server);
  const s = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => provider.getSigner(i)));
  const deploy = async (name, signer, ...args) => {
    const a = art(name);
    const c = await new ethers.ContractFactory(a.abi, a.bytecode, signer).deploy(...args);
    await c.waitForDeployment();
    return c;
  };
  const token = await deploy('MockToken', s[0]);
  const tape = await deploy('MockTapeOut', s[0]);
  const rule = buildCirclePayoutRule();
  await (await tape.register(1, hex(rule.bytes), rule.nIn, rule.nOut)).wait();
  const members = [s[1], s[2], s[3]];
  const addrs = await Promise.all(members.map((m) => m.getAddress()));
  const period = 3600n;
  const circle = await deploy('BylawCircle', s[0], await token.getAddress(), await tape.getAddress(), 1, addrs, 100n, period, await s[4].getAddress(), feeBps);
  for (const m of members) {
    await (await token.mint(await m.getAddress(), 1000n)).wait();
    await (await token.connect(m).approve(await circle.getAddress(), 1000n)).wait();
  }
  const warp = async (sec) => { await provider.send('evm_increaseTime', [sec]); await provider.send('evm_mine', []); };
  return { provider, s, token, tape, circle, members, warp, period };
}

test('full circle: pays each member in order, only when everyone paid and the period ended', async () => {
  const { token, circle, members, s, warp, period } = await setup();
  const bal = async (m) => token.balanceOf(await m.getAddress());
  for (let r = 0; r < 3; r++) {
    for (const m of members) await (await circle.connect(m).contribute()).wait();
    // too early
    await assert.rejects(circle.connect(s[5]).payout(r));
    await warp(Number(period) + 1);
    // wrong person
    await assert.rejects(circle.connect(s[5]).payout((r + 1) % 3));
    await (await circle.connect(s[5]).payout(r)).wait();
    assert.equal(await bal(members[r]), 1000n - 100n * BigInt(r + 1) + 300n);
  }
  // everyone paid in 3 times and received once: net zero
  for (const m of members) assert.equal(await bal(m), 1000n);
  await assert.rejects(circle.connect(members[0]).contribute());
});

test('payout is refused if one member has not paid, even after the period', async () => {
  const { circle, members, s, warp, period } = await setup();
  await (await circle.connect(members[0]).contribute()).wait();
  await (await circle.connect(members[1]).contribute()).wait();
  await warp(Number(period) + 1);
  await assert.rejects(circle.connect(s[5]).payout(0));
});

test('stuck round can be closed after the grace period and payers get their money back', async () => {
  const { token, circle, members, s, warp, period } = await setup();
  await (await circle.connect(members[0]).contribute()).wait();
  await warp(Number(period) + 1);
  await assert.rejects(circle.declareFailed.staticCall());
  await warp(7 * 24 * 3600 + 120);
  await (await circle.declareFailed()).wait();
  await (await circle.connect(members[0]).claimRefund()).wait();
  assert.equal(await token.balanceOf(await members[0].getAddress()), 1000n);
  await assert.rejects(circle.connect(s[5]).payout(0));
});

test('rule is frozen: swapping the circuit in the processor blocks payouts', async () => {
  const { tape, circle, members, s, warp, period } = await setup();
  for (const m of members) await (await circle.connect(m).contribute()).wait();
  await warp(Number(period) + 1);
  const evil = new Builder(17);
  const out = evil.build([evil.not(evil.input(16))]);
  await (await tape.register(1, hex(out.bytes), 17, 1)).wait();
  await assert.rejects(circle.connect(s[5]).payout(2), /RuleChanged|revert/);
});

test('circle fee: taken from each payout, goes to the fixed recipient, cannot exceed 1%', async () => {
  const { token, circle, members, s, warp, period } = await setup(100n); // 1%
  assert.equal(await circle.feeBps(), 100n);
  const feeAddr = await s[4].getAddress();
  for (let r = 0; r < 3; r++) {
    for (const m of members) await (await circle.connect(m).contribute()).wait();
    await warp(Number(period) + 1);
    await (await circle.connect(s[5]).payout(r)).wait();
  }
  // pot 300 per round, fee 3 per round, 9 total; each member nets -3 over the circle
  assert.equal(await token.balanceOf(feeAddr), 9n);
  for (const m of members) assert.equal(await token.balanceOf(await m.getAddress()), 1000n - 3n);
  // over-cap fee is refused at creation
  const a = art('BylawCircle');
  const addrs = await Promise.all(members.map((m) => m.getAddress()));
  await assert.rejects(
    new ethers.ContractFactory(a.abi, a.bytecode, s[0]).deploy(await token.getAddress(), await circle.processor(), 1, addrs, 100n, 3600n, feeAddr, 101n),
  );
});

test('no owner or admin functions exist', async () => {
  const names = art('BylawCircle').abi.filter((x) => x.type === 'function').map((x) => x.name);
  console.log('functions:', names.join(', '));
  for (const bad of ['owner', 'setOwner', 'pause', 'upgrade', 'withdraw', 'setCircuit', 'transferOwnership']) {
    assert.ok(!names.includes(bad), bad);
  }
});

test('everyone paid but the rule was swapped: after 30 days the circle can be closed and all get refunded', async () => {
  const { tape, token, circle, members, s, warp, period } = await setup();
  for (const m of members) await (await circle.connect(m).contribute()).wait();
  await warp(Number(period) + 1);
  const evil = new Builder(17);
  const out = evil.build([evil.not(evil.input(16))]);
  await (await tape.register(1, hex(out.bytes), 17, 1)).wait();
  await assert.rejects(circle.connect(s[5]).payout(0));
  await warp(8 * 24 * 3600);
  await assert.rejects(circle.declareFailed.staticCall()); // a week is not enough when everyone paid
  await warp(23 * 24 * 3600);
  await (await circle.declareFailed()).wait();
  for (const m of members) await (await circle.connect(m).claimRefund()).wait();
  for (const m of members) assert.equal(await token.balanceOf(await m.getAddress()), 1000n);
});
