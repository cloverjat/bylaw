// Does this contract use the official Bylaw rule, token and fee wallet? Shown as a badge on every dashboard.
const OFFICIAL = {
  token: '0xb6ceceab302e2e4948951ee7843fc24e92933061',
  processor: '0x526b96238cc418d909005e2e2d79e327da4bd0f7',
  feeRecipient: '0x11bccb28a40ee64ea0eebc3199b9b00d5359e7de',
};
export function ruleBadge(s, circuitId, what) {
  const bad = [];
  if (String(s.processor).toLowerCase() !== OFFICIAL.processor) bad.push('a different rule processor');
  if (Number(s.circuitId) !== circuitId) bad.push('a different rule (circuit #' + s.circuitId + ', not #' + circuitId + ')');
  if (String(s.token).toLowerCase() !== OFFICIAL.token) bad.push('a different token (not USDC)');
  if (s.feeBps && String(s.feeRecipient).toLowerCase() !== OFFICIAL.feeRecipient) bad.push('fees going to a different wallet');
  if (!bad.length) return { ok: true, html: '<b>Official Bylaw rule.</b> This ' + what + ' uses Bylaw circuit #' + circuitId + ', USDC, and the standard fee. The rule was locked when it was created.' };
  return { ok: false, html: '<b>Warning: this is not the official Bylaw ' + what + '.</b> It uses ' + bad.join(', ') + '. Do not pay in unless you fully trust whoever sent you this link and have checked the details.' };
}
export function showBadge(el, b) {
  el.hidden = false;
  el.style.cssText = 'padding:10px 12px;border-radius:10px;font-size:14px;line-height:1.45;margin:10px 0;border:2px solid ' + (b.ok ? '#2e9d5b;background:#eefaf2' : '#d33;background:#fff0f0;font-size:16px');
  el.innerHTML = b.html;
}
