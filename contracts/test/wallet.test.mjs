import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ganache from 'ganache';
import { ethers } from 'ethers';
import { buildCapRule, buildTrustRule, buildConfirmRule } from '../../compiler/src/wallet.mjs';
import { Builder } from '../../compiler/src/netlist.mjs';

const art = (n) => JSON.parse(fs.readFileSync(new URL(`../out/${n}.json`, import.meta.url)));
const hex = (u8) => '0x' + Buffer.from(u8).toString('hex');
async function reverts(p) { try { const t = await p; const r = await t.wait(); if (r && r.status === 0) return; } catch (e) { return; } assert.fail('expected a revert'); }
const U = 1_000_000n; // 1 unit = 1 USDC

async function setup(kind, limitA, limitB = 0, withConfirmer = false, feeBps = 0) {
  const server = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 6 }, chain: { hardfork: 'shanghai' } });
  const provider = new ethers.BrowserProvider(server);
  const s = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => provider.getSigner(i)));
  const deploy = async (name, signer, ...args) => { const a = art(name); const c = await new ethers.ContractFactory(a.abi, a.bytecode, signer).deploy(...args); await c.waitForDeployment(); return c; };
  const token = await deploy('MockToken', s[0]);
  const tape = await deploy('MockTapeOut', s[0]);
  const rule = [null, buildCapRule(), buildTrustRule(), buildConfirmRule()][kind];
  await (await tape.register(1, hex(rule.bytes), rule.nIn, rule.nOut)).wait();
  const wallet = await deploy('BylawWallet', s[1], await token.getAddress(), await tape.getAddress(), 1, kind, U, limitA, limitB, withConfirmer ? await s[2].getAddress() : ethers.ZeroAddress, await s[5].getAddress(), feeBps);
  await (await token.mint(await wallet.getAddress(), 1000n * U)).wait();
  const warp = async (sec) => { await provider.send('evm_increaseTime', [sec]); await provider.send('evm_mine', []); };
  const addr = (i) => s[i].getAddress();
  return { provider, s, token, tape, wallet, warp, addr };
}

test('daily cap: spends up to the cap, refuses the rest, resets the next day', async () => {
  const { wallet, token, s, warp, addr } = await setup(1, 50);
  const w = wallet.connect(s[1]);
  await (await w.send(await addr(4), 30n * U)).wait();
  await (await w.send(await addr(4), 20n * U)).wait(); // exactly 50
  await reverts(w.send(await addr(4), 1n * U));       // over the cap
  assert.equal(await token.balanceOf(await addr(4)), 50n * U);
  await warp(24 * 3600 + 5);
  await (await w.send(await addr(4), 50n * U)).wait(); // new day
  assert.equal(await token.balanceOf(await addr(4)), 100n * U);
});

test('daily cap: a stranger cannot send; a payment bigger than 63 units is refused', async () => {
  const { wallet, s, addr } = await setup(1, 50);
  await reverts(wallet.connect(s[3]).send(await addr(4), 1n * U));
  await reverts(wallet.connect(s[1]).send(await addr(4), 64n * U));
});

test('daily cap: fractions round up, so the rule is never looser', async () => {
  const { wallet, s, addr } = await setup(1, 2);
  const w = wallet.connect(s[1]);
  await (await w.send(await addr(4), U + 1n)).wait(); // 1.000001 counts as 2 units
  await reverts(w.send(await addr(4), 1n));            // spent counts as 2 units already, one more unit would pass 2
});

test('trusted or small: new recipient gets only a small amount, and only after the waiting time', async () => {
  const { wallet, token, s, warp, addr } = await setup(2, 5, 24);
  const w = wallet.connect(s[1]);
  const to = await addr(4);
  await reverts(w.send(to, 1n * U));                    // never saved, no waiting
  await (await w.saveRecipient(to)).wait();
  await reverts(w.send(to, 1n * U));                    // saved just now
  await warp(25 * 3600);
  await (await w.send(to, 5n * U)).wait();              // small and waited
  await reverts(w.send(to, 6n * U));                    // too big, not trusted yet (only 25 h)
  await warp(30 * 3600);                                // now over 48 h: trusted
  await (await w.send(to, 60n * U)).wait();
  assert.equal(await token.balanceOf(to), 65n * U);
  await reverts(w.send(await addr(5), 1n * U));         // a stranger address stays blocked
});

test('confirm big payments: small goes through, big needs the second person', async () => {
  const { wallet, token, s, addr } = await setup(3, 20, 0, true);
  const w = wallet.connect(s[1]);
  const to = await addr(4);
  await (await w.send(to, 20n * U)).wait();
  await reverts(w.send(to, 21n * U));
  await (await w.propose(to, 40n * U)).wait();
  await reverts(w.execute(0));                          // not confirmed
  await reverts(wallet.connect(s[1]).confirm(0));       // the owner cannot confirm
  await (await wallet.connect(s[2]).confirm(0)).wait();
  await reverts(wallet.connect(s[3]).execute(0));       // only the owner executes
  await (await w.execute(0, { gasLimit: 800000 })).wait();
  assert.equal(await token.balanceOf(to), 60n * U);
  await reverts(w.execute(0));                          // only once
});

test('confirm: owner and confirmer must be different people', async () => {
  const server = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 3 }, chain: { hardfork: 'shanghai' } });
  const provider = new ethers.BrowserProvider(server);
  const s0 = await provider.getSigner(0);
  const token = await new ethers.ContractFactory(art('MockToken').abi, art('MockToken').bytecode, s0).deploy(); await token.waitForDeployment();
  const tape = await new ethers.ContractFactory(art('MockTapeOut').abi, art('MockTapeOut').bytecode, s0).deploy(); await tape.waitForDeployment();
  const r = buildConfirmRule(); await (await tape.register(1, hex(r.bytes), r.nIn, r.nOut)).wait();
  const a = art('BylawWallet');
  await assert.rejects(new ethers.ContractFactory(a.abi, a.bytecode, s0).deploy(await token.getAddress(), await tape.getAddress(), 1, 3, U, 20, 0, await s0.getAddress(), ethers.ZeroAddress, 0));
});

test('rule changed: payments stop, and only then the owner can rescue the money', async () => {
  const { wallet, tape, token, s, addr } = await setup(1, 50);
  const w = wallet.connect(s[1]);
  await reverts(w.rescueIfRuleChanged());               // rule intact: no way around it
  const evil = new Builder(18); const out = evil.build([evil.not(evil.input(17))]);
  await (await tape.register(1, hex(out.bytes), 18, 1)).wait();
  await reverts(w.send(await addr(4), 1n * U));
  await (await w.rescueIfRuleChanged({ gasLimit: 500000 })).wait(); // explicit gas: ganache can replay an earlier failed estimate
  assert.equal(await token.balanceOf(await addr(1)), 1000n * U);
});

test('fee: 0.1% is added on top of each payment, the recipient gets the full amount, the cap counts only the amount', async () => {
  const { wallet, token, s, addr } = await setup(1, 50, 0, false, 10);
  const w = wallet.connect(s[1]);
  await (await w.send(await addr(4), 30n * U)).wait();
  assert.equal(await token.balanceOf(await addr(4)), 30n * U);            // recipient: exactly what was sent
  assert.equal(await token.balanceOf(await addr(5)), 30_000n);              // fee wallet: 0.1% of 30 USDC = 0.03 USDC
  assert.equal(await token.balanceOf(await wallet.getAddress()), 1000n * U - 30n * U - 30_000n);
  await (await w.send(await addr(4), 20n * U)).wait();                       // 30 + 20 = 50: the fee did not use up cap
  await reverts(w.send(await addr(4), 1n * U));                              // 51 is over the cap
  assert.equal(await token.balanceOf(await addr(5)), 50_000n);
});

test('fee: confirm-above pays the fee when the confirmed payment is executed', async () => {
  const { wallet, token, s, addr } = await setup(3, 20, 0, true, 10);
  const w = wallet.connect(s[1]), c = wallet.connect(s[2]);
  await (await w.propose(await addr(4), 40n * U)).wait();
  await (await c.confirm(0)).wait();
  await (await w.execute(0)).wait();
  assert.equal(await token.balanceOf(await addr(4)), 40n * U);
  assert.equal(await token.balanceOf(await addr(5)), 40_000n);
});

test('fee: a payment that cannot also cover the fee is refused whole, nothing half-sent', async () => {
  const { wallet, token, s, addr } = await setup(3, 63, 0, true, 10);
  const w = wallet.connect(s[1]);
  for (let i = 0; i < 16; i++) await (await w.send(await addr(4), 60n * U)).wait();
  const bal = await token.balanceOf(await wallet.getAddress()); // 1000 - 16 * 60.06 = 39.04 USDC
  assert.equal(bal, 39_040_000n);
  const before = await token.balanceOf(await addr(4));
  await reverts(w.send(await addr(4), bal)); // the amount fits, the amount plus the fee does not
  assert.equal(await token.balanceOf(await addr(4)), before);
  assert.equal(await token.balanceOf(await wallet.getAddress()), bal);
});

test('fee: bounded at 1% and needs a recipient', async () => {
  await setup(1, 50, 0, false, 100); // exactly 1% is allowed
  const server = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 3 }, chain: { hardfork: 'shanghai' } });
  const provider = new ethers.BrowserProvider(server);
  const s0 = await provider.getSigner(0);
  const token = await new ethers.ContractFactory(art('MockToken').abi, art('MockToken').bytecode, s0).deploy(); await token.waitForDeployment();
  const tape = await new ethers.ContractFactory(art('MockTapeOut').abi, art('MockTapeOut').bytecode, s0).deploy(); await tape.waitForDeployment();
  const r = buildCapRule(); await (await tape.register(1, hex(r.bytes), r.nIn, r.nOut)).wait();
  const a = art('BylawWallet');
  const mk = (fee, rec) => new ethers.ContractFactory(a.abi, a.bytecode, s0).deploy(token.target, tape.target, 1, 1, U, 50, 0, ethers.ZeroAddress, rec, fee);
  const rec = '0x' + '11'.repeat(20);
  await (await mk(10, rec)).waitForDeployment();           // a valid one deploys
  await assert.rejects(mk(101, rec));                       // above 1%
  await assert.rejects(mk(10, ethers.ZeroAddress));         // a fee with nowhere to go
});
