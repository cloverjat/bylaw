import { compileSpec, interpretSpec, layout, sha256 } from './spec.mjs';
import { proveExhaustive } from './netlist.mjs';

// Compile a spec, then prove the circuit equals the spec on EVERY possible input.
export function certify(spec) {
  const circuit = compileSpec(spec);
  const { nIn } = layout(spec);
  const proof = proveExhaustive(circuit, (bits) => interpretSpec(spec, bits));
  return {
    certificate: {
      version: 1,
      name: spec.name,
      specSha256: sha256(JSON.stringify(spec)),
      netlistSha256: sha256(Buffer.from(circuit.bytes)),
      inputPins: nIn,
      gates: circuit.nGates,
      inputsChecked: proof.checked,
      proved: proof.ok,
      counterexample: proof.counterexample ?? null,
      note: 'Circuit equals the spec on every input. Says nothing about whether the spec is what you meant: read the rule.',
    },
    circuit,
  };
}

// Render the spec back to plain English so a human can check it is what they meant.
export function describe(spec) {
  const o = (x) => (x.field !== undefined ? x.field : String(x.const));
  const words = { eq: 'equals', neq: 'differs from', lt: 'is less than', lte: 'is at most', gt: 'is more than', gte: 'is at least' };
  const go = (e) => {
    switch (e.op) {
      case 'and': return e.args.map(go).join(' AND ');
      case 'or': return '(' + e.args.map(go).join(' OR ') + ')';
      case 'not': return `NOT (${go(e.arg)})`;
      case 'flag': return `${e.field} is on`;
      case 'cmp': return `${o(e.left)} ${words[e.cmp]} ${o(e.right)}`;
    }
  };
  return `Allow only if ${go(spec.rule)}.`;
}
