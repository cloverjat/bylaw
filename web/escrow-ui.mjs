import { connect, short, usdc, waitFor, waitReceipt, deployCircle, EXPLORER } from './circle.mjs';
import { remember } from './finder.mjs';
import { ruleBadge, showBadge } from './official.mjs';
import { escrowArgs, verifyBox } from './verify.mjs';
import { ESCROW_DEFAULTS, validateEscrow, escrowFee, escrowDeployData, termsFingerprint, readEscrow, escrowActions, escrowAllowance } from './escrow.mjs';
const $ = (id) => document.getElementById(id);
const qs = { get: (k) => new URLSearchParams(location.search).get(k) };
let me = null, S = null;
const say = (id, m, c = '') => { $(id).textContent = m; $(id).className = c; };
const now = () => Math.floor(Date.now() / 1000);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- create ----
const form = () => ({
  seller: $('ec_seller').value.trim(), buyer: me, amount: Number($('ec_amt').value), terms: $('ec_text').value.trim(),
  periodSeconds: Math.round(Number($('ec_per').value) * Number($('ec_unit').value)),
});
const unitName = () => { const u = $('ec_unit').selectedOptions[0].textContent; return Number($('ec_per').value) === 1 ? u.replace(/s$/, '') : u; };
$('ec_review').addEventListener('click', () => {
  const f = form(), err = validateEscrow(f);
  $('ec_err').textContent = err || ''; $('ec_sum').hidden = !!err;
  if (err) return;
  const { amount, fee } = escrowFee(f.amount);
  say('ec_cmsg', ESCROW_DEFAULTS.circuitId == null ? 'The escrow rule is still being put on X Layer, so creating an agreement opens very soon.' : '');
  $('ec_sentence').textContent = `The buyer (you) locks ${usdc(amount)} USDC (plus a ${usdc(fee)} USDC fee) after the seller ${short(f.seller)} accepts the terms. It goes to the seller only after you approve. If you have not approved ${$('ec_per').value} ${unitName()} after locking, the money goes back to you. Terms: "${f.terms}"`;
});
$('ec_ack').addEventListener('change', () => { $('ec_go').disabled = !$('ec_ack').checked || ESCROW_DEFAULTS.circuitId == null; });
$('ec_review').addEventListener('click', () => { $('ec_ack').checked = false; $('ec_go').disabled = true; });
$('ec_go').addEventListener('click', async () => {
  try {
    if (!me) me = await connect();
    const f = form(), err = validateEscrow(f);
    if (err) { say('ec_cmsg', err, 'bad'); return; }
    say('ec_cmsg', 'Check your wallet and read the popup before you confirm...');
    const termsHash = await termsFingerprint(f.terms);
    const h = await deployCircle(me, escrowDeployData({ seller: f.seller, amount: f.amount, periodSeconds: f.periodSeconds, termsHash }));
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
const STEP = (s) => (s.settled ? 4 : s.approved ? 3 : s.funded ? 2 : s.accepted ? 1 : 0);
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
  const step = STEP(S);
  [...$('ec_prog').children].forEach((el, i) => el.classList.toggle('on', i <= Math.min(step, 3) && !(step === 4 && false)));
  const isBuyer = me && me === S.buyer, isSeller = me && me === S.seller;
  $('ec_list').innerHTML = `<li><span><b>Buyer</b> (${short(S.buyer)})${isBuyer ? ' (you)' : ''}</span><span>${S.funded ? '🔒 locked ' + usdc(S.amount) + ' USDC' : 'not locked yet'}</span></li>` +
    `<li><span><b>Seller</b> (${short(S.seller)})${isSeller ? ' (you)' : ''}</span><span>${S.accepted ? '✅ accepted' : 'not accepted yet'}</span></li>`;
  const expired = S.funded && now() >= S.deadline;
  let cta = { label: me ? 'Nothing to do right now' : 'Connect your wallet', act: me ? '' : 'connect', help: '' }, alt = null;
  if (S.settled) cta.help = S.approved ? 'Done. The money was released to the seller.' : 'Done. The money went back to the buyer.';
  else if (!S.accepted) {
    if (isSeller) cta = { label: 'Accept the terms (your signature)', act: 'accept', help: 'This records on the blockchain that you accept exactly these terms. No money moves.' };
    else if (me) cta.help = 'Waiting for the seller ' + short(S.seller) + ' to accept the terms.';
  } else if (!S.funded) {
    if (isBuyer) {
      const al = await escrowAllowance(S, me, c.toLowerCase());
      cta = al >= S.amount + S.fee ? { label: 'Lock the money: ' + usdc(S.amount + S.fee) + ' USDC', act: 'fund', help: 'Step 2 of 2. The money stays locked in the contract until you approve or the deadline passes.' } : { label: 'Step 1: allow ' + usdc(S.amount + S.fee) + ' USDC', act: 'allow', help: 'Your wallet asks to let the agreement take exactly this amount. Then you lock it.' };
    } else if (me) cta.help = 'The seller accepted. Waiting for the buyer ' + short(S.buyer) + ' to lock the money.';
  } else {
    if (S.approved || S.sellerRefunds || expired) {
      const toSeller = S.approved;
      cta = { label: toSeller ? 'Release the money to the seller: ' + usdc(S.amount) + ' USDC' : 'Return the money to the buyer: ' + usdc(S.amount) + ' USDC', act: toSeller ? 'release' : 'refund', help: 'Anyone can press this. The public rule decides, and the money only goes to the seller or back to the buyer.' };
    } else if (isBuyer) {
      cta = { label: 'Approve the delivery', act: 'approve', help: 'Press this when you got what was agreed. It lets the money go to the seller. Before the deadline (' + new Date(S.deadline * 1000).toLocaleString() + '), the money stays locked.' };
    } else if (isSeller) {
      cta.help = 'The buyer has locked the money. It is released after they approve. If they do not approve by ' + new Date(S.deadline * 1000).toLocaleString() + ', it goes back to them.';
      alt = { label: 'Agree to a refund', act: 'offerRefund' };
    } else if (me) cta.help = 'The money is locked until ' + new Date(S.deadline * 1000).toLocaleString() + ' or until the buyer approves.';
  }
  $('ec_cta').textContent = cta.label; $('ec_cta').dataset.act = cta.act; $('ec_cta').disabled = !cta.act; $('ec_help').textContent = cta.help;
  $('ec_alt').hidden = !alt; if (alt) { $('ec_alt').textContent = alt.label; $('ec_alt').dataset.act = alt.act; }
  if (ESCROW_DEFAULTS.circuitId != null) showBadge($('ebadge') || $('ec_check'), ruleBadge(S, ESCROW_DEFAULTS.circuitId, 'agreement'));
  $('ec_kv').innerHTML = verifyBox(escrowArgs(S), 'BylawEscrow.standard-input.json');
  $('ec_facts').innerHTML = `Buyer ${short(S.buyer)} · seller ${short(S.seller)} · ${usdc(S.amount)} USDC · <a href="${EXPLORER}/address/${c}" target="_blank" rel="noopener">view on explorer</a>`;
}
async function act(a) {
  const c = qs.get('escrow').toLowerCase();
  try {
    if (a === 'connect' || !me) { me = await connect(); await load(); if (a === 'connect') return; }
    say('ec_msg', 'Check your wallet and read the popup before you confirm...');
    const h = a === 'allow' ? await escrowActions.allow(me, c, S) : await escrowActions[a](me, c);
    say('ec_msg', 'Sent. Waiting for confirmation...');
    const ok = await waitFor(h);
    await load();
    say('ec_msg', ok ? 'Done. Confirmed.' : 'The transaction did not confirm.', ok ? 'ok' : 'bad');
  } catch (e) { say('ec_msg', e.message || String(e), 'bad'); }
}
$('ec_cta').addEventListener('click', () => act($('ec_cta').dataset.act));
$('ec_alt').addEventListener('click', () => act($('ec_alt').dataset.act));
window.addEventListener('bylaw:account', (e) => { me = e.detail || me; if (qs.get('escrow')) load(); });
load();
setInterval(() => { if (!document.hidden) load(); }, 15000);
