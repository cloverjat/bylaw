// Prints the exact BylawCircle constructor values for Remix.
// Usage: node scripts/args.mjs <member1> <member2> <member3> [...] [--fee-to 0x..] [--fee-bps 100] [--contribution 10000] [--period 300]
import { ethers } from 'ethers';

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const members = argv.filter((a, i) => /^0x/i.test(a) && argv[i - 1]?.startsWith('--') === false || (/^0x/i.test(a) && !argv[i - 1]?.startsWith('--')));
const feeTo = opt('fee-to', '0x11BccB28A40ee64EA0eebC3199b9B00D5359e7de');
const feeBps = opt('fee-bps', '100');
const contribution = opt('contribution', '10000'); // 0.01 USDC (6 decimals)
const period = opt('period', '300'); // seconds
const TOKEN = opt('token', '0xB6CEceAB302E2E4948951eE7843FC24E92933061'); // native USDC (Circle) on X Layer, 6 decimals
const PROCESSOR = '0x526b96238cc418d909005e2e2d79e327da4bd0f7'; // My 4004 #29
const CIRCUIT_ID = '6';

if (members.length < 2 || members.length > 15) throw new Error('need 2 to 15 member addresses');
const all = [TOKEN, PROCESSOR, feeTo, ...members];
for (const a of all) if (!ethers.isAddress(a)) throw new Error('bad address ' + a);
if (new Set(members.map((m) => m.toLowerCase())).size !== members.length) throw new Error('duplicate member');

const cs = (a) => ethers.getAddress(a.toLowerCase());
console.log('Paste into the Remix "Deploy" constructor fields, in this order:\n');
console.log('token_        :', cs(TOKEN));
console.log('processor_    :', cs(PROCESSOR));
console.log('circuitId_    :', CIRCUIT_ID);
console.log('members_      :', JSON.stringify(members.map(cs)));
console.log('contribution_ :', contribution, `(= ${Number(contribution) / 1e6} USDC)`);
console.log('period_       :', period, `seconds`);
console.log('feeRecipient_ :', cs(feeTo));
console.log('feeBps_       :', feeBps, `(= ${Number(feeBps) / 100}%)`);
