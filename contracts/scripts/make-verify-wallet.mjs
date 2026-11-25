// Builds the Standard JSON Input for the explorer and checks it reproduces the exact bytecode the website deploys.
import solc from 'solc';
import fs from 'node:fs';
const src = fs.readFileSync('src/BylawWallet.sol', 'utf8');
const input = { language: 'Solidity', sources: { 'src/BylawWallet.sol': { content: src } }, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'metadata'] } } } };
const out = JSON.parse(solc.compile(JSON.stringify(input)));
if ((out.errors || []).some((e) => e.severity === 'error')) { console.error(out.errors); process.exit(1); }
const bc = '0x' + out.contracts['src/BylawWallet.sol'].BylawWallet.evm.bytecode.object;
const web = fs.readFileSync('../web/wallet-bytecode.mjs', 'utf8').match(/'(0x[0-9a-f]+)'/)[1];
console.log('matches the website bytecode exactly:', bc === web, '| bytes:', (bc.length - 2) / 2);
if (bc !== web) process.exit(1);
const std = { language: 'Solidity', sources: input.sources, settings: { optimizer: input.settings.optimizer, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'metadata'] } } } };
fs.writeFileSync('../docs/verify/BylawWallet.standard-input.json', JSON.stringify(std));
console.log('wrote docs/verify/BylawWallet.standard-input.json');
