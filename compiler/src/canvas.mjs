// Export a netlist as a TapeOut canvas design file (open it with "Open design..." in TapeOut).
// Circuits must not use constant signals (0/1) and end with the two NAND buffers per output that build() adds;
// the processor appends those buffers itself, so they are left out of the drawing.
import { decode } from './netlist.mjs';

export function toCanvas({ bytes, nIn, nOut }) {
  const gates = decode(bytes);
  const real = gates.slice(0, gates.length - 2 * nOut);
  const sig = (s) => {
    if (s < 2) throw new Error('constant signals cannot be drawn on the canvas');
    return s < 2 + nIn ? `in${s - 2}` : `g${s - 2 - nIn}`;
  };
  const nodes = [], edges = [];
  for (let i = 0; i < nIn; i++) nodes.push({ id: `in${i}`, type: 'input', position: { x: 0, y: i * 70 }, data: { index: i } });
  // depth for a left-to-right layout
  const depth = new Map();
  real.forEach(([a, b], g) => { const d = (s) => (s < 2 + nIn ? 0 : depth.get(`g${s - 2 - nIn}`)); depth.set(`g${g}`, Math.max(d(a), d(b)) + 1); });
  const col = new Map();
  real.forEach(([a, b], g) => {
    const dp = depth.get(`g${g}`);
    const row = col.get(dp) ?? 0; col.set(dp, row + 1);
    nodes.push({ id: `g${g}`, type: 'nand', position: { x: 260 * dp, y: row * 90 }, data: {} });
    edges.push({ id: `e${g}a`, source: sig(a), sourceHandle: 'out', target: `g${g}`, targetHandle: 'a' });
    edges.push({ id: `e${g}b`, source: sig(b), sourceHandle: 'out', target: `g${g}`, targetHandle: 'b' });
  });
  const maxD = Math.max(...depth.values());
  for (let k = 0; k < nOut; k++) {
    const inner = gates[gates.length - 2 * nOut + k]; // NOT(o) = nand(o, o)
    nodes.push({ id: `out${k}`, type: 'output', position: { x: 260 * (maxD + 1), y: k * 90 }, data: { index: k } });
    edges.push({ id: `eo${k}`, source: sig(inner[0]), sourceHandle: 'out', target: `out${k}`, targetHandle: 'in' });
  }
  return { format: 'tapeout-canvas', v: 1, at: 0, demo: null, nodes, edges };
}
