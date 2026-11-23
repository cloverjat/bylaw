import solc from 'solc';
import fs from 'node:fs';
import path from 'node:path';
const dir = 'src';
const sources = {};
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sol'))) sources[`${dir}/${f}`] = { content: fs.readFileSync(path.join(dir, f), 'utf8') };
const out = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity', sources,
  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
})));
const errs = (out.errors || []).filter((e) => e.severity === 'error');
for (const e of out.errors || []) console.log(e.severity.toUpperCase(), e.formattedMessage.split('\n')[0]);
if (errs.length) process.exit(1);
fs.mkdirSync('out', { recursive: true });
for (const file of Object.values(out.contracts)) for (const [name, c] of Object.entries(file)) {
  fs.writeFileSync(`out/${name}.json`, JSON.stringify({ abi: c.abi, bytecode: '0x' + c.evm.bytecode.object }));
}
console.log('compiled:', fs.readdirSync('out').join(', '));
