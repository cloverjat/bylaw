import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ganache from 'ganache';
import { ethers } from 'ethers';
import { buildPayrollRule } from '../../compiler/src/payroll.mjs';

const art = (n) => JSON.parse(fs.readFileSync(new URL(`../out/${n}.json`, import.meta.url)));
const hex = (u8) => '0x' + Buffer.from(u8).toString('hex');

async function reverts(p) { try { const t = await p; const r = await t.wait(); if (r && r.status === 0) return; } catch (e) { return; } assert.fail('expected a revert'); }

async function setup(feeBps = 0n, cycles = 3) {
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
  const rule = buildPayrollRule();
  await (await tape.register(1, hex(rule.bytes), rule.nIn, rule.nOut)).wait();
  const boss = s[1];
  const addrs = [await s[2].getAddress(), await s[3].getAddress()];
  const pay = await deploy('BylawPayroll', boss, await token.getAddress(), await tape.getAddress(), 1, addrs, [100n, 50n], 3600n, BigInt(cycles), await s[4].getAddress(), feeBps);
  await (await token.mint(await boss.getAddress(), 100000n)).wait();
  await (await token.connect(boss).approve(await pay.getAddress(), 100000n)).wait();
  const warp = async (sec) => { await provider.send('evm_increaseTime', [sec]); await provider.send('evm_mine', []); };
  return { s, token, tape, pay, boss, warp };
}

test('payroll: nothing before funding, nothing before the cycle ends, then each worker is paid once per cycle', async () => {
  const { s, token, pay, warp } = await setup();
  const w0 = await s[2].getAddress();
  await reverts(pay.connect(s[5]).pay(0, 0)); // not funded
  await (await pay.connect(s[1]).fund()).wait();
  assert.equal(await token.balanceOf(await pay.getAddress()), 450n);
  await reverts(pay.pay(0, 0)); // cycle not over
  await warp(3601);
  await (await pay.connect(s[5]).pay(0, 0)).wait(); // a stranger can trigger it
  assert.equal(await token.balanceOf(w0), 100n);
  await reverts(pay.pay(0, 0)); // already paid
  await reverts(pay.pay(0, 1)); // cycle 1 not due
  await (await pay.pay(1, 0)).wait();
  assert.equal(await token.balanceOf(await s[3].getAddress()), 50n);
  await warp(3600 * 5);
  for (const c of [1, 2]) for (const w of [0, 1]) await (await pay.pay(w, c)).wait();
  await reverts(pay.pay(0, 3)); // beyond the agreed cycles
  assert.equal(await token.balanceOf(await pay.getAddress()), 0n);
});

test('payroll: boss cannot take money early, funding twice fails, strangers cannot fund', async () => {
  const { s, pay, warp } = await setup();
  await reverts(pay.connect(s[2]).fund());
  await (await pay.connect(s[1]).fund()).wait();
  await reverts(pay.connect(s[1]).fund());
  await reverts(pay.connect(s[1]).reclaim());
  await warp(3600 * 3 + 86400 * 30);
  await reverts(pay.connect(s[1]).reclaim()); // still inside the 90 days
  await reverts(pay.connect(s[2]).reclaim()); // not the boss
});

test('payroll: after the end plus 90 days the boss gets back only what was not claimed', async () => {
  const { s, token, pay, warp } = await setup();
  await (await pay.connect(s[1]).fund()).wait();
  await warp(3601);
  await (await pay.pay(0, 0)).wait(); // 100 of 450 paid
  const before = await token.balanceOf(await s[1].getAddress());
  await warp(3600 * 3 + 86400 * 91);
  await (await pay.connect(s[1]).reclaim()).wait();
  assert.equal((await token.balanceOf(await s[1].getAddress())) - before, 350n);
  await reverts(pay.connect(s[1]).reclaim());
});

test('payroll: fee is 1% at most, paid once at funding', async () => {
  const { s, token, pay } = await setup(100n);
  await (await pay.connect(s[1]).fund()).wait();
  assert.equal(await token.balanceOf(await s[4].getAddress()), 4n); // 1% of 450 = 4 (rounded down)
  assert.equal(await token.balanceOf(await pay.getAddress()), 450n);
  const a = art('BylawPayroll');
  await reverts(new ethers.ContractFactory(a.abi, a.bytecode, s[1]).deploy(ethers.ZeroAddress, ethers.ZeroAddress, 1, [await s[2].getAddress()], [1n], 3600n, 3n, await s[4].getAddress(), 101n));
});

test('payroll: no way to change terms', async () => {
  const a = art('BylawPayroll');
  const names = a.abi.filter((x) => x.type === 'function' && !['view', 'pure'].includes(x.stateMutability)).map((x) => x.name).sort();
  assert.deepEqual(names, ['fund', 'pay', 'reclaim']);
});
