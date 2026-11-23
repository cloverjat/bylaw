// Bylaw netlist core: build NAND circuits, encode them in the TapeOut byte
// format, simulate them, and prove properties over every input.
//
// Format (from third-party reverse-engineering, see docs/NETLIST-NOTES.md,
// to be re-checked on the first real tape-out):
//   NAND = 0x00 | u24 a | u24 b      (7 bytes, big-endian)
//   signal 0 = const 0, signal 1 = const 1, input i = 2+i,
//   gate g = 2+nIn+g, gates in topological order, last nOut gates = outputs.
// Eval: inputs/outputs bit-packed, bit 0 = first pin, least-significant bit first.

export const CONST0 = 0;
export const CONST1 = 1;

export class Builder {
  constructor(nIn) {
    this.nIn = nIn;
    this.gates = []; // [a, b]
  }
  input(i) {
    if (i < 0 || i >= this.nIn) throw new Error(`input ${i} out of range`);
    return 2 + i;
  }
  nand(a, b) {
    const limit = 2 + this.nIn + this.gates.length;
    if (a >= limit || b >= limit) throw new Error('NAND: future signal');
    this.gates.push([a, b]);
    return 2 + this.nIn + this.gates.length - 1;
  }
  not(a) { return this.nand(a, a); }
  and(a, b) { return this.not(this.nand(a, b)); }
  or(a, b) { return this.nand(this.not(a), this.not(b)); }
  xor(a, b) {
    const n = this.nand(a, b);
    return this.nand(this.nand(a, n), this.nand(b, n));
  }
  xnor(a, b) { return this.not(this.xor(a, b)); }

  // a <= b for two unsigned words (arrays of signals, least-significant bit first)
  lte(A, B) {
    if (A.length !== B.length) throw new Error('width mismatch');
    let r = CONST1; // equal so far => true
    for (let i = 0; i < A.length; i++) {
      const lt = this.and(this.not(A[i]), B[i]);
      const eq = this.xnor(A[i], B[i]);
      r = this.or(lt, this.and(eq, r));
    }
    return r;
  }

  // Ripple-carry adder. A, B: arrays of signals (LSB first), same width. Returns width+1 signals.
  add(A, B) {
    if (A.length !== B.length) throw new Error('width mismatch');
    const out = [];
    let carry = CONST0;
    for (let i = 0; i < A.length; i++) {
      const x = this.xor(A[i], B[i]);
      out.push(this.xor(x, carry));
      carry = this.or(this.and(A[i], B[i]), this.and(x, carry));
    }
    out.push(carry);
    return out;
  }

  // Finish: the last nOut gates must be the outputs, so each output is
  // copied through a double inverter placed at the very end.
  build(outputs) {
    const inner = outputs.map((o) => this.not(o));
    outputs.forEach((_, k) => this.not(inner[k]));
    const nOut = outputs.length;
    const bytes = new Uint8Array(this.gates.length * 7);
    this.gates.forEach(([a, b], g) => {
      const o = g * 7;
      bytes[o] = 0x00;
      bytes[o + 1] = (a >> 16) & 255; bytes[o + 2] = (a >> 8) & 255; bytes[o + 3] = a & 255;
      bytes[o + 4] = (b >> 16) & 255; bytes[o + 5] = (b >> 8) & 255; bytes[o + 6] = b & 255;
    });
    return { bytes, nIn: this.nIn, nOut, nGates: this.gates.length };
  }
}

export function decode(bytes) {
  if (bytes.length % 7 !== 0) throw new Error('bad netlist length');
  const gates = [];
  for (let o = 0; o < bytes.length; o += 7) {
    if (bytes[o] !== 0x00) throw new Error('only NAND gates supported');
    gates.push([
      (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3],
      (bytes[o + 4] << 16) | (bytes[o + 5] << 8) | bytes[o + 6],
    ]);
  }
  return gates;
}

// inputBits: array of 0/1, pin order. Returns array of 0/1 outputs.
export function evaluate({ bytes, nIn, nOut }, inputBits) {
  const gates = decode(bytes);
  const sig = new Uint8Array(2 + nIn + gates.length);
  sig[1] = 1;
  for (let i = 0; i < nIn; i++) sig[2 + i] = inputBits[i] ? 1 : 0;
  gates.forEach(([a, b], g) => { sig[2 + nIn + g] = (sig[a] & sig[b]) ^ 1; });
  return Array.from(sig.slice(sig.length - nOut));
}

export function pack(bits) {
  const out = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((b, i) => { if (b) out[i >> 3] |= 1 << (i & 7); });
  return out;
}

// Exhaustive proof: checks the circuit against a reference predicate for
// every one of the 2^nIn inputs. Returns {ok, checked, counterexample?}.
export function proveExhaustive(circuit, reference, maxInputs = 24) {
  const { nIn } = circuit;
  if (nIn > maxInputs) throw new Error(`too many inputs for exhaustive proof: ${nIn}`);
  const total = 2 ** nIn;
  const bits = new Array(nIn).fill(0);
  for (let v = 0; v < total; v++) {
    for (let i = 0; i < nIn; i++) bits[i] = Math.floor(v / 2 ** i) % 2;
    const got = evaluate(circuit, bits);
    const want = reference(bits);
    if (got.length !== want.length || got.some((x, k) => x !== want[k])) {
      return { ok: false, checked: v + 1, counterexample: { inputs: [...bits], got, want } };
    }
  }
  return { ok: true, checked: total };
}
