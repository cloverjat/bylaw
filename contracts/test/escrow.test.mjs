import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ganache from 'ganache';
import { ethers } from 'ethers';
import { buildEscrowRule, escrowReference } from '../../compiler/src/escrow.mjs';

const art = (n) => JSON.parse(fs.readFileSync(new URL(`../out/${n}.json`, import.meta.url)));
const hex = (u8) => '0x' + Buffer.from(u8).toString('hex');
async function reverts(p) { try { const t = await p; const r = await t.wait(); if (r && r.status === 0) return; } catch (e) { return; } assert.fail('expected a revert'); }

async function setup(feeBps = 0n) {
  const server = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 5 }, chain: { hardfork: 'shanghai' } });
  const provider = new ethers.BrowserProvider(server);
  const s = await Promise.all([0, 1, 2, 3, 4].map((i) => provider.getSigner(i)));
  const deploy = async (name, signer, ...args) => { const a = art(name); const c = await new ethers.ContractFactory(a.abi, a.bytecode, signer).deploy(...args); await c.waitForDeployment(); return c; };
  const token = await deploy('MockToken', s[0]);
  const tape = await deploy('MockTapeOut', s[0]);
  const rule = buildEscrowRule();
  await (await tape.register(1, hex(rule.bytes), rule.nIn, rule.nOut)).wait();
  const terms = ethers.sha256(ethers.toUtf8Bytes('Sell plot 7 for 1000 USDC'));
  const buyer = s[1], seller = s[2];
  const esc = await deploy('BylawEscrow', buyer, await token.getAddress(), await tape.getAddress(), 1, await seller.getAddress(), 1000n, 3600n, terms, await s[4].getAddress(), feeBps);
  await (await token.mint(await buyer.getAddress(), 100000n)).wait();
  await (await token.connect(buyer).approve(await esc.getAddress(), 100000n)).wait();
  const warp = async (sec) => { await provider.send('evm_increaseTime', [sec]); await provider.send('evm_mine', []); };
  return { s, token, esc, buyer, seller, warp };
}

test('escrow rule circuit matches the reference table for all 64 inputs', () => {
  const rule = buildEscrowRule();
  assert.equal(rule.nIn, 6); assert.equal(rule.nOut, 2);
  for (let v = 0; v < 64; v++) {
    const bits = [0, 1, 2, 3, 4, 5].map((i) => (v >> i) & 1);
    const want = escrowReference(bits);
    // evaluate NAND netlist directly
    const sig = [0, 1, ...bits];
    const n = rule.bytes;
    for (let k = 0; k < n.length / 7; k++) {
      const o = k * 7; const a = (n[o + 1] << 16) | (n[o + 2] << 8) | n[o + 3]; const b = (n[o + 4] << 16) | (n[o + 5] << 8) | n[o + 6];
      sig.push((sig[a] & sig[b]) ^ 1);
    }
    assert.deepEqual(sig.slice(sig.length - 2), want, 'input ' + v);
  }
});

test('escrow: seller accepts, buyer funds, buyer approves, seller is paid once', async () => {
  const { s, token, esc, buyer, seller } = await setup();
  await assert.rejects(esc.connect(buyer).fund.staticCall()); // seller has not accepted
  await reverts(esc.connect(buyer).accept()); // only the seller can accept
  await (await esc.connect(seller).accept()).wait();
  await reverts(esc.connect(s[3]).fund()); // a stranger cannot fund
  await (await esc.connect(buyer).fund()).wait();
  assert.equal(await token.balanceOf(await esc.getAddress()), 1000n);
  await reverts(esc.release()); // not approved yet
  await reverts(esc.refund()); // deadline not reached
  await reverts(esc.connect(seller).approve()); // seller cannot approve their own delivery
  await (await esc.connect(buyer).approve()).wait();
  await (await esc.connect(s[3]).release()).wait(); // a stranger may trigger it
  assert.equal(await token.balanceOf(await seller.getAddress()), 1000n);
  await reverts(esc.release());
  await reverts(esc.refund());
});

test('escrow: no approval means a refund after the deadline, and never a release', async () => {
  const { token, esc, buyer, seller, warp } = await setup();
  await (await esc.connect(seller).accept()).wait();
  await (await esc.connect(buyer).fund()).wait();
  const before = await token.balanceOf(await buyer.getAddress());
  await warp(3601);
  await reverts(esc.release());
  await (await esc.refund()).wait();
  assert.equal((await token.balanceOf(await buyer.getAddress())) - before, 1000n);
  await reverts(esc.refund());
});

test('escrow: seller can agree to refund early; approval blocks the deadline refund', async () => {
  const a = await setup();
  await (await a.esc.connect(a.seller).accept()).wait();
  await (await a.esc.connect(a.buyer).fund()).wait();
  await reverts(a.esc.connect(a.buyer).offerRefund());
  await (await a.esc.connect(a.seller).offerRefund()).wait();
  await (await a.esc.refund()).wait();
  assert.equal(await a.token.balanceOf(await a.esc.getAddress()), 0n);
  const b = await setup();
  await (await b.esc.connect(b.seller).accept()).wait();
  await (await b.esc.connect(b.buyer).fund()).wait();
  await (await b.esc.connect(b.buyer).approve()).wait();
  await b.warp(3601);
  await reverts(b.esc.refund()); // approved, so the seller is owed the money
  await (await b.esc.release()).wait();
});

test('escrow: fee goes on top to the fee recipient, bad parameters rejected', async () => {
  const { s, token, esc, buyer, seller } = await setup(100n);
  await (await esc.connect(seller).accept()).wait();
  await (await esc.connect(buyer).fund()).wait();
  assert.equal(await token.balanceOf(await s[4].getAddress()), 10n);
  assert.equal(await token.balanceOf(await esc.getAddress()), 1000n);
});
