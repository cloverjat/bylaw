import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ganache from 'ganache';
import { ethers } from 'ethers';
import { buildEscrowRule, escrowReference } from '../../compiler/src/escrow.mjs';

const art = (n) => JSON.parse(fs.readFileSync(new URL(`../out/${n}.json`, import.meta.url)));
const hex = (u8) => '0x' + Buffer.from(u8).toString('hex');
const no = (c, name, ...args) => assert.rejects(c[name].staticCall(...args), undefined, name + ' should fail');
const yes = async (c, name, ...args) => (await c[name](...args)).wait();

async function setup({ feeBps = 0n, withReferee = true, count = 3n } = {}) {
  const server = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 6 }, chain: { hardfork: 'shanghai' } });
  const provider = new ethers.BrowserProvider(server);
  const s = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => provider.getSigner(i)));
  const deploy = async (name, signer, ...args) => { const a = art(name); const c = await new ethers.ContractFactory(a.abi, a.bytecode, signer).deploy(...args); await c.waitForDeployment(); return c; };
  const token = await deploy('MockToken', s[0]);
  const tape = await deploy('MockTapeOut', s[0]);
  const rule = buildEscrowRule();
  await yes(tape, 'register', 1, hex(rule.bytes), rule.nIn, rule.nOut);
  const terms = ethers.sha256(ethers.toUtf8Bytes('Three videos, one per week, for 300 USDC per video'));
  const buyer = s[1], seller = s[2], referee = withReferee ? await s[3].getAddress() : ethers.ZeroAddress;
  const esc = await deploy('BylawEscrow', buyer, await token.getAddress(), await tape.getAddress(), 1, await seller.getAddress(), referee, 100n, count, 3600n, 1800n, terms, await s[4].getAddress(), feeBps);
  await yes(token, 'mint', await buyer.getAddress(), 100000n);
  await yes(token.connect(buyer), 'approve', await esc.getAddress(), 100000n);
  const warp = async (sec) => { await provider.send('evm_increaseTime', [sec]); await provider.send('evm_mine', []); };
  const ready = async () => { await yes(esc.connect(seller), 'accept'); await yes(esc.connect(buyer), 'fund'); };
  return { s, token, esc, buyer, seller, ref: s[3], warp, ready };
}

test('escrow rule circuit matches the reference table for all 512 inputs', () => {
  const rule = buildEscrowRule();
  assert.equal(rule.nIn, 9); assert.equal(rule.nOut, 2);
  for (let v = 0; v < 512; v++) {
    const bits = [...Array(9).keys()].map((i) => (v >> i) & 1);
    const sig = [0, 1, ...bits];
    const n = rule.bytes;
    for (let k = 0; k < n.length / 7; k++) {
      const o = k * 7; const a = (n[o + 1] << 16) | (n[o + 2] << 8) | n[o + 3]; const b = (n[o + 4] << 16) | (n[o + 5] << 8) | n[o + 6];
      sig.push((sig[a] & sig[b]) ^ 1);
    }
    assert.deepEqual(sig.slice(sig.length - 2), escrowReference(bits), 'input ' + v);
  }
});

test('escrow: seller signs, buyer locks everything, each installment pays when approved', async () => {
  const { s, token, esc, buyer, seller, ready } = await setup();
  await no(esc.connect(buyer), 'fund'); // seller has not accepted
  await no(esc.connect(buyer), 'accept'); // only the seller can accept
  await yes(esc.connect(seller), 'accept');
  await no(esc.connect(s[5]), 'fund'); // a stranger cannot fund
  await yes(esc.connect(buyer), 'fund');
  assert.equal(await token.balanceOf(await esc.getAddress()), 300n); // all three installments locked
  await no(esc.connect(s[5]), 'release', 0); // not approved, not due
  await no(esc.connect(seller), 'approve', 0); // seller cannot approve their own work
  await yes(esc.connect(buyer), 'approve', 0);
  await yes(esc.connect(s[5]), 'release', 0); // a stranger may trigger it
  assert.equal(await token.balanceOf(await seller.getAddress()), 100n);
  await no(esc.connect(s[5]), 'release', 0); // never twice
  await no(esc.connect(s[5]), 'release', 1); // second installment not approved or due
  await no(esc.connect(buyer), 'approve', 0); // already paid
});

test('escrow: silence pays the seller after the due time plus the response window, never before', async () => {
  const { token, esc, seller, ready, warp, s } = await setup();
  await ready();
  await warp(3600 + 1000); // due, but still inside the 30-minute window
  await no(esc.connect(s[5]), 'release', 0);
  await warp(900); // window over
  await yes(esc.connect(s[5]), 'release', 0);
  assert.equal(await token.balanceOf(await seller.getAddress()), 100n);
  await no(esc.connect(s[5]), 'release', 1); // installment 2 is not due yet
  await warp(3600 * 3);
  await yes(esc.connect(s[5]), 'release', 1); await yes(esc.connect(s[5]), 'release', 2);
  assert.equal(await token.balanceOf(await esc.getAddress()), 0n);
});

test('escrow: the buyer can hold one installment, the referee decides, others still pay', async () => {
  const { token, esc, buyer, seller, ref, ready, warp, s } = await setup();
  await ready();
  await no(esc.connect(seller), 'hold', 0); // only the buyer can hold
  await yes(esc.connect(buyer), 'hold', 0);
  await no(esc.connect(buyer), 'approve', 0); // held installments cannot be approved
  await warp(3600 * 3);
  await no(esc.connect(s[5]), 'release', 0); // held: not paid automatically
  await no(esc.connect(s[5]), 'refund', 0); // and not returned until the referee decides
  await no(esc.connect(buyer), 'decide', 0, false); // only the referee decides
  await yes(esc.connect(ref), 'decide', 0, false);
  const before = await token.balanceOf(await buyer.getAddress());
  await yes(esc.connect(s[5]), 'refund', 0);
  assert.equal((await token.balanceOf(await buyer.getAddress())) - before, 100n);
  await no(esc.connect(s[5]), 'release', 0);
  await yes(esc.connect(s[5]), 'release', 1); // installment 2 was not held and its window passed
  // referee rules for the seller on another held installment
  const b = await setup(); await b.ready();
  await yes(b.esc.connect(b.buyer), 'hold', 2);
  await yes(b.esc.connect(b.ref), 'decide', 2, true);
  await yes(b.esc.connect(b.s[5]), 'release', 2);
  assert.equal(await b.token.balanceOf(await b.seller.getAddress()), 100n);
});

test('escrow: holds need a referee, must be made before the window ends, and the seller can return an installment', async () => {
  const a = await setup({ withReferee: false }); await a.ready();
  await no(a.esc.connect(a.buyer), 'hold', 0); // no referee named
  const b = await setup(); await b.ready();
  await b.warp(3600 + 1900);
  await no(b.esc.connect(b.buyer), 'hold', 0); // window over: too late to hold
  const c = await setup(); await c.ready();
  await no(c.esc.connect(c.s[5]), 'refund', 0);
  await no(c.esc.connect(c.buyer), 'offerRefund', 0);
  await yes(c.esc.connect(c.seller), 'offerRefund', 1);
  const before = await c.token.balanceOf(await c.buyer.getAddress());
  await yes(c.esc.connect(c.s[5]), 'refund', 1);
  assert.equal((await c.token.balanceOf(await c.buyer.getAddress())) - before, 100n);
});

test('escrow: a single payment works too, the fee goes on top, bad parameters rejected', async () => {
  const { s, token, esc, ready } = await setup({ feeBps: 100n, count: 1n });
  await ready();
  assert.equal(await token.balanceOf(await s[4].getAddress()), 1n); // 1% of 100
  assert.equal(await token.balanceOf(await esc.getAddress()), 100n);
  const a = art('BylawEscrow');
  const f = new ethers.ContractFactory(a.abi, a.bytecode, s[1]);
  const z = ethers.ZeroAddress, t = ethers.ZeroHash;
  await assert.rejects(f.deploy(z, z, 1, await s[2].getAddress(), z, 100n, 0n, 3600n, 0n, t, z, 0n)); // zero installments count
  await assert.rejects(f.deploy(z, z, 1, await s[1].getAddress(), z, 100n, 1n, 3600n, 0n, t, z, 0n)); // seller is the buyer
});

test('escrow: approval followed by a seller refund offer cannot be paid out, only returned; paid installments cannot be returned', async () => {
  const a = await setup(); await a.ready();
  await yes(a.esc.connect(a.buyer), 'approve', 0);
  await yes(a.esc.connect(a.seller), 'offerRefund', 0);
  await no(a.esc.connect(a.s[5]), 'release', 0);   // the refund offer wins over the approval
  const before = await a.token.balanceOf(await a.buyer.getAddress());
  await yes(a.esc.connect(a.s[5]), 'refund', 0);
  assert.equal((await a.token.balanceOf(await a.buyer.getAddress())) - before, 100n);
  const b = await setup(); await b.ready();
  await b.warp(3600 + 3600 * 24 * 3);              // auto-release window passed
  await yes(b.esc.connect(b.s[5]), 'release', 0);
  await no(b.esc.connect(b.seller), 'offerRefund', 0); // already paid
  await no(b.esc.connect(b.s[5]), 'refund', 0);
});
