// Rule spec: the small, readable format that plain English is translated into.
// The English->spec step is never trusted. Everything below checks the result.
//
// {
//   name: "Circle payout",
//   fields: [{ name: "recipient", bits: 4 }, ...],   // pins in this order, LSB first
//   rule: { op: "and", args: [ { op: "cmp", cmp: "eq", left: {field:"a"}, right: {field:"b"} }, { op: "flag", field: "open" } ] }
// }
// ops: and, or, not, flag, cmp (eq neq lt lte gt gte). Operands: {field} or {const}.
import { Builder, CONST0, CONST1 } from './netlist.mjs';
import { createHash } from 'node:crypto';

export function layout(spec) {
  let pin = 0;
  const map = {};
  for (const f of spec.fields) {
    if (map[f.name]) throw new Error(`duplicate field ${f.name}`);
    if (!Number.isInteger(f.bits) || f.bits < 1 || f.bits > 32) throw new Error(`bad width for ${f.name}`);
    map[f.name] = { from: pin, bits: f.bits };
    pin += f.bits;
  }
  return { map, nIn: pin };
}

function operandBits(b, map, o, width) {
  let sigs;
  if (o.field !== undefined) {
    const f = map[o.field];
    if (!f) throw new Error(`unknown field ${o.field}`);
    sigs = Array.from({ length: f.bits }, (_, i) => b.input(f.from + i));
  } else if (o.const !== undefined) {
    if (!Number.isInteger(o.const) || o.const < 0) throw new Error('bad constant');
    const w = Math.max(1, o.const.toString(2).length);
    sigs = Array.from({ length: w }, (_, i) => (Math.floor(o.const / 2 ** i) % 2 ? CONST1 : CONST0));
  } else throw new Error('bad operand');
  if (sigs.length > width) throw new Error('operand wider than comparison width');
  while (sigs.length < width) sigs.push(CONST0);
  return sigs;
}
const widthOf = (map, o) => (o.field !== undefined ? map[o.field]?.bits ?? 0 : Math.max(1, o.const.toString(2).length));

function eq(b, A, B) {
  let r = b.xnor(A[0], B[0]);
  for (let i = 1; i < A.length; i++) r = b.and(r, b.xnor(A[i], B[i]));
  return r;
}

function compileExpr(b, map, e) {
  switch (e.op) {
    case 'and': return e.args.map((a) => compileExpr(b, map, a)).reduce((x, y) => b.and(x, y));
    case 'or': return e.args.map((a) => compileExpr(b, map, a)).reduce((x, y) => b.or(x, y));
    case 'not': return b.not(compileExpr(b, map, e.arg));
    case 'flag': {
      const f = map[e.field];
      if (!f || f.bits !== 1) throw new Error(`flag needs a 1-bit field: ${e.field}`);
      return b.input(f.from);
    }
    case 'cmp': {
      const w = Math.max(widthOf(map, e.left), widthOf(map, e.right));
      const L = operandBits(b, map, e.left, w);
      const R = operandBits(b, map, e.right, w);
      switch (e.cmp) {
        case 'eq': return eq(b, L, R);
        case 'neq': return b.not(eq(b, L, R));
        case 'lte': return b.lte(L, R);
        case 'gte': return b.lte(R, L);
        case 'lt': return b.not(b.lte(R, L));
        case 'gt': return b.not(b.lte(L, R));
        default: throw new Error(`bad cmp ${e.cmp}`);
      }
    }
    default: throw new Error(`bad op ${e.op}`);
  }
}

export function compileSpec(spec) {
  const { map, nIn } = layout(spec);
  const b = new Builder(nIn);
  const out = compileExpr(b, map, spec.rule);
  return { ...b.build([out]), map };
}

// Independent reference: evaluates the spec directly on integers (no gates involved).
export function interpretSpec(spec, bits) {
  const { map } = layout(spec);
  const val = (name) => { const f = map[name]; let v = 0; for (let i = 0; i < f.bits; i++) v += bits[f.from + i] * 2 ** i; return v; };
  const opv = (o) => (o.field !== undefined ? val(o.field) : o.const);
  const go = (e) => {
    switch (e.op) {
      case 'and': return e.args.every(go);
      case 'or': return e.args.some(go);
      case 'not': return !go(e.arg);
      case 'flag': return val(e.field) === 1;
      case 'cmp': {
        const l = opv(e.left), r = opv(e.right);
        return { eq: l === r, neq: l !== r, lt: l < r, lte: l <= r, gt: l > r, gte: l >= r }[e.cmp];
      }
    }
  };
  return [go(spec.rule) ? 1 : 0];
}

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
