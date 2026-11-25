// The browser code builds raw call data by hand. These tests check it byte for byte against the real contract ABI.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ethers } from 'ethers';
// the page code expects a browser: give it a minimal one before it loads
globalThis.window = { addEventListener() {}, dispatchEvent() {}, removeEventListener() {} };
globalThis.CustomEvent = class { constructor(t) { this.type = t; } };
const { WALLET_BYTECODE } = await import('../../web/wallet-bytecode.mjs');
const { walletDeployData, walletActions, validateWallet, walletSentence, WALLET_CIRCUITS, WALLET_DEFAULTS, unitsOf, toBase } = await import('../../web/wallet.mjs');

const abi = JSON.parse(fs.readFileSync(new URL('../out/BylawWallet.json', import.meta.url))).abi;
const iface = new ethers.Interface(abi);
const ME = '0x1111111111111111111111111111111111111111';
const CONF = '0x2222222222222222222222222222222222222222';
const WALLET = '0x3333333333333333333333333333333333333333';
const TO = '0x4444444444444444444444444444444444444444';

// capture what the UI would send to the wallet
async function capture(fn) {
  const sent = [];
  globalThis.window.okxwallet = { request: async ({ method, params }) => { sent.push({ method, params }); return '0xhash'; } };
  globalThis.fetch = async (url, opts) => ({ json: async () => ({ result: '0x' }) }); // the pre-send simulation passes
  await fn();
  return sent[0].params[0];
}

test('wallet bytecode in the web bundle is the compiled contract', () => {
  assert.equal(WALLET_BYTECODE.toLowerCase(), JSON.parse(fs.readFileSync(new URL('../out/BylawWallet.json', import.meta.url))).bytecode.toLowerCase());
});

for (const [kind, f] of [[1, { limitA: 50, limitB: 0 }], [2, { limitA: 5, limitB: 24 }], [3, { limitA: 20, limitB: 0, confirmer: CONF }]]) {
  test(`deploy data for kind ${kind} decodes to the settings the person typed`, () => {
    const form = { kind, unitUsdc: 10, ...f };
    const data = walletDeployData(form);
    assert.ok(data.startsWith(WALLET_BYTECODE));
    const args = ethers.AbiCoder.defaultAbiCoder().decode(['address', 'address', 'uint256', 'uint8', 'uint256', 'uint256', 'uint256', 'address'], '0x' + data.slice(WALLET_BYTECODE.length));
    assert.equal(args[0].toLowerCase(), WALLET_DEFAULTS.token.toLowerCase());
    assert.equal(args[1].toLowerCase(), WALLET_DEFAULTS.processor.toLowerCase());
    assert.equal(Number(args[2]), WALLET_CIRCUITS[kind]);
    assert.equal(Number(args[3]), kind);
    assert.equal(args[4], 10_000_000n);
    assert.equal(Number(args[5]), f.limitA);
    assert.equal(Number(args[6]), f.limitB);
    assert.equal(args[7].toLowerCase(), kind === 3 ? CONF : ethers.ZeroAddress);
  });
}

test('rule circuit ids are the ones taped out on X Layer (#10 cap, #9 trusted-or-small, #8 confirm)', () => {
  assert.deepEqual(WALLET_CIRCUITS, { 1: 10, 2: 9, 3: 8 });
});

test('send, save, propose, confirm, execute and deposit build exactly the ABI call data', async () => {
  const s = { token: WALLET_DEFAULTS.token };
  const cases = [
    ['send', () => walletActions.send(ME, WALLET, s, TO, 3_500_000), WALLET, iface.encodeFunctionData('send', [TO, 3_500_000n])],
    ['saveRecipient', () => walletActions.saveRecipient(ME, WALLET, s, TO), WALLET, iface.encodeFunctionData('saveRecipient', [TO])],
    ['propose', () => walletActions.propose(ME, WALLET, s, TO, 25_000_000), WALLET, iface.encodeFunctionData('propose', [TO, 25_000_000n])],
    ['confirm', () => walletActions.confirm(ME, WALLET, s, 7), WALLET, iface.encodeFunctionData('confirm', [7n])],
    ['execute', () => walletActions.execute(ME, WALLET, s, 7), WALLET, iface.encodeFunctionData('execute', [7n])],
    ['deposit', () => walletActions.deposit(ME, WALLET, s, 2_000_000), WALLET_DEFAULTS.token, new ethers.Interface(['function transfer(address,uint256)']).encodeFunctionData('transfer', [WALLET, 2_000_000n])],
  ];
  for (const [name, fn, to, data] of cases) {
    const tx = await capture(fn);
    assert.equal(tx.to.toLowerCase(), to.toLowerCase(), name + ' target');
    assert.equal(tx.data.toLowerCase(), data.toLowerCase(), name + ' data');
  }
});

test('every read selector the page uses exists on the contract', () => {
  const sels = { token: '0xfc0c546a', processor: '0xce1b1d43', circuitId: '0x030c9d5c', netlistHash: '0x543862ee', owner: '0x8da5cb5b', kind: '0x04baa00b', unit: '0x907af6c0', limitA: '0x1f9d4eeb', limitB: '0x701dc3bf', confirmer: '0x6fc3c817', spentNow: '0xa739b50f', addedAt: '0x0c46b81a', proposals: '0x013cf08b', proposalCount: '0xda35c664', balance: '0xb69ef8a8' };
  for (const [n, sel] of Object.entries(sels)) assert.equal(iface.getFunction(n).selector, sel, n);
});

test('amounts: steps round up, never down', () => {
  assert.equal(toBase('3.5'), 3_500_000);
  assert.equal(unitsOf(3_500_000, 1_000_000), 4);
  assert.equal(unitsOf(1, 1_000_000), 1);
  assert.equal(unitsOf(10_000_000, 10_000_000), 1);
  assert.equal(unitsOf(10_000_001, 10_000_000), 2);
});

test('form checks catch bad input', () => {
  const ok = { kind: 1, unitUsdc: 1, limitA: 50, limitB: 0 };
  assert.equal(validateWallet(ok), null);
  assert.ok(validateWallet({ ...ok, limitA: 64 }));
  assert.ok(validateWallet({ ...ok, limitA: 0 }));
  assert.ok(validateWallet({ ...ok, limitA: 2.5 }));
  assert.ok(validateWallet({ ...ok, unitUsdc: 3 }));
  assert.ok(validateWallet({ ...ok, kind: 2, limitB: 64 }));
  assert.equal(validateWallet({ ...ok, kind: 2, limitB: 0 }), null);
  assert.ok(validateWallet({ ...ok, kind: 3, confirmer: '0x123' }));
  assert.ok(validateWallet({ ...ok, kind: 3, confirmer: CONF, owner: CONF }));
  assert.equal(validateWallet({ ...ok, kind: 3, confirmer: CONF, owner: ME }), null);
  assert.match(walletSentence({ kind: 1, unitUsdc: 5, limitA: 10 }), /50 USDC a day/);
});
