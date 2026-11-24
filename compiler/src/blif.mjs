// Export a Bylaw NAND circuit as BLIF so it can be imported into the TapeOut canvas.
import { decode } from './netlist.mjs';

export function toBlif({ bytes, nIn, nOut }, model = 'bylaw') {
  const gates = decode(bytes);
  const total = gates.length;
  const name = (s) => {
    if (s === 0) return 'const0';
    if (s === 1) return 'const1';
    if (s < 2 + nIn) return `i${s - 2}`;
    const g = s - 2 - nIn;
    return g >= total - nOut ? `o${g - (total - nOut)}` : `g${g}`;
  };
  const used = new Set();
  gates.forEach(([a, b]) => { used.add(a); used.add(b); });
  const lines = [`.model ${model}`];
  lines.push('.inputs ' + Array.from({ length: nIn }, (_, i) => `i${i}`).join(' '));
  lines.push('.outputs ' + Array.from({ length: nOut }, (_, i) => `o${i}`).join(' '));
  if (used.has(0)) lines.push('.names const0');
  if (used.has(1)) lines.push('.names const1', '1');
  gates.forEach(([a, b], g) => {
    lines.push(`.names ${name(a)} ${name(b)} ${name(2 + nIn + g)}`, '0- 1', '-0 1');
  });
  lines.push('.end');
  return lines.join('\n') + '\n';
}

// Minimal parser for our own output, used by tests to prove the export is faithful.
export function evalBlif(text, inputBits) {
  const sig = {};
  const lines = text.split('\n').filter(Boolean);
  let outs = [];
  for (let i = 0; i < lines.length; i++) {
    const [k, ...rest] = lines[i].split(' ');
    if (k === '.inputs') rest.forEach((n, j) => (sig[n] = inputBits[j] ? 1 : 0));
    else if (k === '.outputs') outs = rest;
    else if (k === '.names') {
      const out = rest[rest.length - 1];
      if (rest.length === 1) { sig[out] = lines[i + 1] === '1' ? 1 : 0; continue; }
      const [a, b] = rest;
      sig[out] = (sig[a] & sig[b]) ^ 1; // our export only ever writes NAND tables
    }
  }
  return outs.map((o) => sig[o]);
}
