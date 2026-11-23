// Free, no-AI "plain English" step: fixed templates the user fills in with numbers.
// Each returns a rule spec. The same spec/prove pipeline then checks it.
const f = (name, bits) => ({ name, bits });
const cmp = (c, l, r) => ({ op: 'cmp', cmp: c, left: l, right: r });
const fld = (field) => ({ field });
const num = (n) => ({ const: n });

export const TEMPLATES = {
  circle: {
    title: 'Savings circle payout',
    blurb: 'Pay the member whose turn it is, only when everyone has paid and the round is over.',
    params: [],
    build: () => ({
      name: 'Circle payout',
      fields: [f('recipient', 4), f('round', 4), f('paid', 4), f('members', 4), f('window', 1)],
      rule: { op: 'and', args: [cmp('eq', fld('recipient'), fld('round')), cmp('eq', fld('paid'), fld('members')), { op: 'flag', field: 'window' }] },
    }),
  },
  dailyCap: {
    title: 'Daily spending cap',
    blurb: 'Block any payment that would take today\'s total over the cap. Amounts are in whole units (e.g. 1 unit = 1 USDT0).',
    params: [{ name: 'cap', label: 'Daily cap (units, 1-63)', min: 1, max: 63, def: 50 }],
    build: ({ cap }) => ({
      name: `Daily cap ${cap}`,
      fields: [f('amount', 6), f('spent', 6)],
      rule: cmp('lte', { add: [fld('amount'), fld('spent')] }, num(cap)),
    }),
  },
  trustedOrSmall: {
    title: 'Trusted recipients, small first payments',
    blurb: 'Pay saved recipients freely. A new recipient only gets small payments, and only after a waiting time.',
    params: [
      { name: 'trial', label: 'Max to a new recipient (units, 0-63)', min: 0, max: 63, def: 5 },
      { name: 'hours', label: 'Waiting time for a new recipient (hours, 0-63)', min: 0, max: 63, def: 24 },
    ],
    build: ({ trial, hours }) => ({
      name: `Trusted or small (<=${trial}, ${hours}h wait)`,
      fields: [f('trusted', 1), f('amount', 6), f('ageHours', 6)],
      rule: { op: 'or', args: [
        { op: 'flag', field: 'trusted' },
        { op: 'and', args: [cmp('lte', fld('amount'), num(trial)), cmp('gte', fld('ageHours'), num(hours))] },
      ] },
    }),
  },
  confirmAbove: {
    title: 'Confirm big payments',
    blurb: 'Payments above a limit need an extra confirmation from the owner.',
    params: [{ name: 'limit', label: 'Confirmation needed above (units, 0-63)', min: 0, max: 63, def: 20 }],
    build: ({ limit }) => ({
      name: `Confirm above ${limit}`,
      fields: [f('amount', 6), f('confirmed', 1)],
      rule: { op: 'or', args: [cmp('lte', fld('amount'), num(limit)), { op: 'flag', field: 'confirmed' }] },
    }),
  },
};

export function fromTemplate(key, values = {}) {
  const t = TEMPLATES[key];
  if (!t) throw new Error(`unknown template ${key}`);
  const p = {};
  for (const d of t.params) {
    const v = values[d.name] ?? d.def;
    if (!Number.isInteger(v) || v < d.min || v > d.max) throw new Error(`${d.label}: must be a whole number from ${d.min} to ${d.max}`);
    p[d.name] = v;
  }
  return t.build(p);
}
