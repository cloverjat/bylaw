import { connect, short, usdc, waitFor, waitReceipt, deployCircle, EXPLORER } from './circle.mjs';
import { remember } from './finder.mjs';
import { ruleBadge, showBadge } from './official.mjs';
import { verifyBox } from './verify.mjs';
import { ESCROW_DEFAULTS, GRACE_DAYS, validateEscrow, scheduleOf, escrowTotals, escrowDeployData, escrowArgs, termsFingerprint, readEscrow, escrowActions, escrowAllowance } from './escrow.mjs';
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const $ = (id) => document.getElementById(id);
const qs = { get: (k) => new URLSearchParams(location.search).get(k) };
let me = null, S = null;
const say = (id, m, c = '') => { $(id).textContent = m; $(id).className = c; };
const now = () => Math.floor(Date.now() / 1000);
const when = (t) => new Date(t * 1000).toLocaleString();
const SCHED_TEXT = { once: 'once', weekly: 'every week', biweekly: 'every 2 weeks', monthly: 'every 30 days' };

// ---- create ----
const sync = () => { const once = $('ec_sched').value === 'once'; $('ec_cntw').hidden = once; $('ec_dlw').hidden = !once; };
$('ec_sched').addEventListener('change', sync); sync();
const form = () => {
  const sch = scheduleOf({ schedule: $('ec_sched').value, count: Number($('ec_cnt').value), deadlineSeconds: Math.round(Number($('ec_dl').value) * 86400) });
  return { seller: $('ec_seller').value.trim(), referee: $('ec_ref').value.trim(), buyer: me, amount: Number($('ec_amt').value), count: sch.count, interval: sch.interval, terms: $('ec_text').value.trim() };
};
$('ec_review').addEventListener('click', () => {
  const f = form(), err = validateEscrow(f);
  $('ec_err').textContent = err || ''; $('ec_sum').hidden = !!err;
  $('ec_ack').checked = false; $('ec_go').disabled = true;
  if (err) return;
  say('ec_cmsg', ESCROW_DEFAULTS.circuitId == null ? 'The escrow rule is still being put on X Layer, so creating an agreement opens very soon.' : '');
  const { per, total, fee } = escrowTotals(f.amount, f.count);
  const plan = f.count === 1 ? `one payment of ${usdc(per)} USDC, due ${$('ec_dl').value} days after you lock the money` : `${f.count} payments of ${usdc(per)} USDC, ${SCHED_TEXT[$('ec_sched').value]}`;
  $('ec_sentence').textContent = `The buyer (you) locks ${usdc(total)} USDC (plus a ${usdc(fee)} USDC fee) once, after the seller ${short(f.seller)} accepts the terms. It is paid as ${plan}. Each payment goes to the seller when you approve it, or automatically ${GRACE_DAYS} days after it is due. ` +
    (f.referee ? `You can hold a payment before then, and the referee ${short(f.referee)} decides who gets it. ` : 'No referee was named, so payments cannot be held. ') + `The seller can return a payment to you at any time. Terms: "${f.terms}"`;
});
$('ec_ack').addEventListener('change', () => { $('ec_go').disabled = !$('ec_ack').checked || ESCROW_DEFAULTS.circuitId == null; });
$('ec_go').addEventListener('click', async () => {
  try {
    if (!me) me = await connect();
    const f = form(), err = validateEscrow(f);
    if (err) { say('ec_cmsg', err, 'bad'); return; }
    say('ec_cmsg', 'Check your wallet and read the popup before you confirm...');
    const termsHash = await termsFingerprint(f.terms);
    const h = await deployCircle(me, escrowDeployData({ ...f, termsHash }));
    say('ec_cmsg', 'Sent. Waiting for the network...');
    const r = await waitReceipt(h);
    if (!r || r.status !== '0x1' || !r.contractAddress) { say('ec_cmsg', 'The agreement was not created.', 'bad'); return; }
    const link = location.origin + location.pathname + '?escrow=' + r.contractAddress + '&name=' + encodeURIComponent($('ec_name').value.trim()) + '&terms=' + encodeURIComponent(f.terms) + '#escCard';
    remember({ kind: 'escrow', addr: r.contractAddress, name: $('ec_name').value.trim() || 'Agreement', names: '' });
    say('ec_cmsg', 'Agreement created. Send this link to the seller so they can accept it, then come back to lock the money: ' + link, 'ok');
    history.replaceState(null, '', link); await load();
  } catch (e) { say('ec_cmsg', e.message || String(e), 'bad'); }
});

// ---- dashboard ----
const dueAt = (k) => S.start + (k + 1) * S.interval;
const windowEnd = (k) => dueAt(k) + S.grace;
function rowFor(k) {
  const it = S.items[k], isBuyer = me && me === S.buyer, isSeller = me && me === S.seller, isRef = me && S.referee && me === S.referee;
  const over = S.funded && now() >= windowEnd(k);
  let chip, btns = [];
  if (it.settled) chip = it.refBuyer || it.sellerRefunds ? '↩️ returned' : '✅ paid';
  else if (!S.funded) chip = '·';
  else if (it.held && it.refSeller) { chip = '⚖️ referee: pay seller'; btns.push(['release', 'Pay the seller']); }
  else if (it.held && it.refBuyer) { chip = '⚖️ referee: return'; btns.push(['refund', 'Return to the buyer']); }
  else if (it.held) { chip = '⏸ on hold'; if (isRef) btns.push(['decideSeller', 'Decide: pay seller'], ['decideBuyer', 'Decide: return to buyer']); }
  else if (it.approved || over) { chip = it.approved ? '👍 approved' : '⏳ due'; btns.push(['release', 'Pay the seller']); }
  else { chip = '⏳ ' + when(dueAt(k)); if (isBuyer) { btns.push(['approve', 'Approve now']); if (S.referee) btns.push(['hold', 'Hold']); } }
  if (S.funded && !it.settled && isSeller && !it.sellerRefunds) btns.push(['offerRefund', 'Return to buyer']);
  if (S.funded && !it.settled && it.sellerRefunds) btns.push(['refund', 'Return to the buyer']);
  const seen = new Set(); btns = btns.filter(([a]) => !seen.has(a) && seen.add(a));
  return `<li><span><b>Payment ${k + 1}</b><br><small>${usdc(S.installment)} USDC</small></span><span>${chip} ${btns.map(([a, l]) => `<button class="ghost" data-act="${a}" data-k="${k}" style="margin-left:6px;padding:6px 10px">${l}</button>`).join('')}</span></li>`;
}
async function load() {
  const c = qs.get('escrow');
  if (!c) return;
  $('escCard').hidden = false;
  { const nm = qs.get('name'); if (nm) $('ec_title').textContent = nm; remember({ kind: 'escrow', addr: c, name: nm || 'Agreement', names: '' }); }
  try { S = await readEscrow(c.toLowerCase()); } catch (e) { say('ec_msg', 'Could not read this agreement: ' + e.message, 'bad'); return; }
  const terms = qs.get('terms') || '';
  if (terms) {
    $('ec_terms').textContent = '"' + terms + '"';
    const ok = (await termsFingerprint(terms)).toLowerCase() === S.termsHash.toLowerCase();
    $('ec_check').textContent = ok ? 'These terms match the fingerprint locked in the contract. They are exactly what the seller accepts.' : 'Warning: these terms do NOT match the contract. Do not accept or pay.';
    $('ec_check').className = ok ? 'note' : 'bad';
  } else { $('ec_terms').textContent = 'The terms are not in this link. Ask the buyer for the full link.'; $('ec_check').textContent = ''; }
  const paid = S.items.filter((x) => x.settled).length;
  [...$('ec_prog').children].forEach((el, i) => el.classList.toggle('on', i === 0 ? S.accepted : i === 1 ? S.funded : paid > 0));
  const isBuyer = me && me === S.buyer, isSeller = me && me === S.seller;
  $('ec_list').innerHTML = `<li><span><b>Buyer</b> ${short(S.buyer)}${isBuyer ? ' (you)' : ''}</span><span>${S.funded ? '🔒 locked ' + usdc(S.installment * S.count) + ' USDC' : 'not locked yet'}</span></li>` +
    `<li><span><b>Seller</b> ${short(S.seller)}${isSeller ? ' (you)' : ''}</span><span>${S.accepted ? '✅ accepted' : 'not accepted yet'}</span></li>` +
    (S.referee ? `<li><span><b>Referee</b> ${short(S.referee)}${me && me === S.referee ? ' (you)' : ''}</span><span>decides disputes</span></li>` : '');
  let cta = { label: me ? 'Nothing to do right now' : 'Connect your wallet', act: me ? '' : 'connect', help: '' };
  const total = S.installment * S.count;
  if (!S.accepted) {
    if (isSeller) cta = { label: 'Accept the terms (your signature)', act: 'accept', help: 'This records on the blockchain that you accept exactly these terms. No money moves.' };
    else if (me) cta.help = 'Waiting for the seller ' + short(S.seller) + ' to accept the terms.';
  } else if (!S.funded) {
    if (isBuyer) {
      const al = await escrowAllowance(S, me, c.toLowerCase());
      cta = al >= total + S.fee ? { label: 'Lock the money: ' + usdc(total + S.fee) + ' USDC', act: 'fund', help: 'Step 2 of 2. The full amount is locked in the contract and paid out in installments by the rule.' } : { label: 'Step 1: allow ' + usdc(total + S.fee) + ' USDC', act: 'allow', help: 'Your wallet asks to let the agreement take exactly this amount. Then you lock it.' };
    } else if (me) cta.help = 'The seller accepted. Waiting for the buyer ' + short(S.buyer) + ' to lock the money.';
  } else if (paid === S.count) cta.help = 'Every payment is done. This agreement is finished.';
  else cta.help = isBuyer ? 'Approve each payment when you are happy with the work. Unapproved payments are paid automatically ' + GRACE_DAYS + ' days after they are due' + (S.referee ? ', unless you hold them first.' : '.') : 'Each payment is released when the buyer approves it, or automatically ' + GRACE_DAYS + ' days after it is due.';
  $('ec_cta').textContent = cta.label; $('ec_cta').dataset.act = cta.act; $('ec_cta').disabled = !cta.act; $('ec_help').textContent = cta.help;
  $('ec_rows').innerHTML = S.funded ? S.items.map((_, k) => rowFor(k)).join('') : '';
  if (ESCROW_DEFAULTS.circuitId != null) showBadge($('ebadge'), ruleBadge(S, ESCROW_DEFAULTS.circuitId, 'agreement'));
  $('ec_kv').innerHTML = verifyBox(escrowArgs(S), 'BylawEscrow.standard-input.json');
  $('ec_facts').innerHTML = `Buyer ${short(S.buyer)} · seller ${short(S.seller)} · ${S.count} × ${usdc(S.installment)} USDC · <a href="${EXPLORER}/address/${esc(c)}" target="_blank" rel="noopener">view on explorer</a>`;
}
async function act(a, k) {
  const c = qs.get('escrow').toLowerCase();
  try {
    if (a === 'connect' || !me) { me = await connect(); await load(); if (a === 'connect') return; }
    say('ec_msg', 'Check your wallet and read the popup before you confirm...');
    const h = a === 'allow' ? await escrowActions.allow(me, c, S) : await escrowActions[a](me, c, k);
    say('ec_msg', 'Sent. Waiting for confirmation...');
    const ok = await waitFor(h);
    await load();
    say('ec_msg', ok ? 'Done. Confirmed.' : 'The transaction did not confirm.', ok ? 'ok' : 'bad');
  } catch (e) { say('ec_msg', e.message || String(e), 'bad'); }
}
$('ec_cta').addEventListener('click', () => act($('ec_cta').dataset.act));
$('ec_rows').addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) act(b.dataset.act, Number(b.dataset.k)); });
window.addEventListener('bylaw:account', (e) => { me = e.detail || null; if (qs.get('escrow')) load(); });
load();
setInterval(() => { if (!document.hidden) load(); }, 15000);
