// "Find your circle or payroll": remembers items on this device and opens any address someone shares.
import { readCircle } from './circle.mjs';
import { readPayroll } from './payroll.mjs';
import { readWallet } from './wallet.mjs';
import { readEscrow } from './escrow.mjs';
const KEY = 'bylaw.mine';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
export function remember(item) {
  try {
    const l = load().filter((x) => x.addr.toLowerCase() !== item.addr.toLowerCase());
    l.unshift(item); localStorage.setItem(KEY, JSON.stringify(l.slice(0, 30)));
  } catch { /* storage may be unavailable: it is only a convenience */ }
}
const href = (x) => '?' + (x.kind === 'payroll' ? 'payroll' : x.kind === 'wallet' ? 'wallet' : x.kind === 'escrow' ? 'escrow' : 'circle') + '=' + x.addr + '&names=' + encodeURIComponent(x.names || '') + '&name=' + encodeURIComponent(x.name || '');
export function renderFinder(list, empty, input, go, err) {
  const items = load();
  empty.hidden = items.length > 0;
  list.innerHTML = items.map((x) => `<li><span><b>${(x.name || '').replace(/</g, '&lt;')}</b><br><small>${x.kind === 'payroll' ? 'Payroll' : x.kind === 'wallet' ? 'Wallet' : x.kind === 'escrow' ? 'Agreement' : 'Savings circle'} · ${x.addr.slice(0, 6)}…${x.addr.slice(-4)}</small></span><a href="${href(x)}">Open</a></li>`).join('');
  go.addEventListener('click', async () => {
    err.textContent = '';
    const m = input.value.match(/0x[0-9a-fA-F]{40}/);
    if (!m) { err.textContent = 'That does not look like an address. It starts with 0x and has 42 characters.'; return; }
    const a = m[0].toLowerCase();
    go.disabled = true;
    try {
      let kind = null;
      try { await readCircle(a); kind = 'circle'; } catch { try { await readPayroll(a); kind = 'payroll'; } catch { try { await readWallet(a); kind = 'wallet'; } catch { try { await readEscrow(a); kind = 'escrow'; } catch { /* none */ } } } }
      if (!kind) { err.textContent = 'This address is not a Bylaw savings circle, payroll, agreement or wallet on X Layer.'; return; }
      location.href = href({ kind, addr: a, names: '', name: '' });
    } finally { go.disabled = false; }
  });
}
