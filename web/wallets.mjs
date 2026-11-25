// Pick any EVM wallet: browser extensions (EIP-6963), injected phone wallets, or open this page inside a wallet app.
const found = new Map(); // uuid or name -> { name, icon, provider }
function add(name, icon, provider) {
  if (!provider || typeof provider.request !== 'function') return;
  for (const w of found.values()) if (w.provider === provider) return;
  found.set(name, { name, icon, provider });
}
window.addEventListener('eip6963:announceProvider', (e) => { const d = e.detail; if (d && d.provider) add(d.info.name, d.info.icon, d.provider); });
window.dispatchEvent(new Event('eip6963:requestProvider'));

function detect() {
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  add('OKX Wallet', null, window.okxwallet);
  add('Bitget Wallet', null, window.bitkeep && window.bitkeep.ethereum);
  add('Trust Wallet', null, window.trustwallet || (window.ethereum && window.ethereum.isTrust ? window.ethereum : null));
  add('Coinbase Wallet', null, window.coinbaseWalletExtension);
  if (window.ethereum) {
    const e = window.ethereum;
    const name = e.isRabby ? 'Rabby' : e.isMetaMask ? 'MetaMask' : e.isTrust ? 'Trust Wallet' : e.isBitKeep ? 'Bitget Wallet' : e.isOkxWallet ? 'OKX Wallet' : 'Browser wallet';
    add(name, null, e);
  }
  return [...found.values()];
}

const here = () => location.href;
const enc = encodeURIComponent;
const APPS = [
  { name: 'MetaMask', url: () => 'https://metamask.app.link/dapp/' + here().replace(/^https?:\/\//, '') },
  { name: 'Trust Wallet', url: () => 'https://link.trustwallet.com/open_url?coin_id=60&url=' + enc(here()) },
  { name: 'Bitget Wallet', url: () => 'https://bkcode.vip?action=dapp&url=' + enc(here()) },
  { name: 'OKX Wallet', url: () => 'https://www.okx.com/download?deeplink=' + enc('okx://wallet/dapp/url?dappUrl=' + enc(here())) },
  { name: 'Coinbase Wallet', url: () => 'https://go.cb-w.com/dapp?cb_url=' + enc(here()) },
];

function modal(title, bodyBuilder) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;color:#111;border-radius:16px;max-width:380px;width:100%;padding:18px;max-height:90vh;overflow:auto;font:15px/1.45 system-ui,sans-serif';
    const h = document.createElement('div'); h.style.cssText = 'font-weight:700;font-size:18px;margin-bottom:10px'; h.textContent = title; box.appendChild(h);
    const done = (v) => { back.remove(); resolve(v); };
    bodyBuilder(box, done);
    const x = document.createElement('button'); x.textContent = 'Cancel'; x.style.cssText = 'margin-top:12px;width:100%;padding:10px;border:0;border-radius:10px;background:#eee;font-size:15px;cursor:pointer';
    x.onclick = () => done(null); box.appendChild(x);
    back.onclick = (e) => { if (e.target === back) done(null); };
    back.appendChild(box); document.body.appendChild(back);
  });
}
const rowStyle = 'display:flex;align-items:center;gap:10px;width:100%;padding:12px;margin:6px 0;border:1px solid #ddd;border-radius:12px;background:#fafafa;font-size:16px;cursor:pointer;text-align:left;text-decoration:none;color:#111;box-sizing:border-box';

export async function chooseWallet() {
  let list = detect();
  if (!list.length) { await new Promise((r) => setTimeout(r, 400)); list = detect(); } // some wallets announce late
  if (list.length === 1) return list[0].provider;
  if (list.length > 1) {
    return modal('Choose your wallet', (box, done) => {
      for (const w of list) {
        const b = document.createElement('button'); b.style.cssText = rowStyle;
        if (w.icon) { const i = document.createElement('img'); i.src = w.icon; i.width = 28; i.height = 28; b.appendChild(i); }
        b.appendChild(document.createTextNode(w.name)); b.onclick = () => done(w.provider); box.appendChild(b);
      }
    });
  }
  // No wallet in this browser: open the page inside a wallet app.
  await modal('No wallet in this browser', (box, done) => {
    const p = document.createElement('div'); p.style.marginBottom = '6px';
    p.textContent = 'Open this page inside your wallet app, then press Connect again. Or install a wallet extension on your computer.'; box.appendChild(p);
    for (const a of APPS) { const l = document.createElement('a'); l.href = a.url(); l.style.cssText = rowStyle; l.textContent = 'Open in ' + a.name; box.appendChild(l); }
    const c = document.createElement('button'); c.style.cssText = rowStyle; c.textContent = 'Copy page link';
    c.onclick = async () => { try { await navigator.clipboard.writeText(here()); c.textContent = 'Link copied'; } catch { c.textContent = here(); } };
    box.appendChild(c);
  });
  return null;
}
