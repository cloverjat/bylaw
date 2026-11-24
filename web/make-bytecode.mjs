import fs from 'node:fs';
const a = JSON.parse(fs.readFileSync('../contracts/out/BylawCircle.json', 'utf8'));
const b = (a.bytecode.object || a.bytecode).replace(/^0x/, '');
fs.writeFileSync('bytecode.mjs', "// Creation bytecode of contracts/src/BylawCircle.sol (solc 0.8.39, optimizer 200 runs).\nexport const CIRCLE_BYTECODE = '0x" + b + "';\n");
