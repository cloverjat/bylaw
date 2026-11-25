// Left-hand menu: each tool gets its own page-like view instead of one long scroll.
const ORDER = ['home', 'home', 'circle', 'circle', 'payroll', 'escrow', 'wallet', 'wallet', 'lab'];
const NAMES = ['home', 'circle', 'payroll', 'escrow', 'wallet', 'lab'];

export function initViews() {
  const wrap = document.querySelectorAll('.wrap')[document.querySelectorAll('.wrap').length - 1];
  const hero = document.querySelector('.hero');
  document.body.classList.add('hasside');
  let h = -1; const groups = [];
  for (const el of [...wrap.children]) {
    if (el.tagName === 'H2') h++;
    if (el.tagName === 'FOOTER' || el.tagName === 'SCRIPT') continue;
    groups.push([el, ORDER[Math.max(h, 0)]]);
  }
  const q = new URLSearchParams(location.search);
  let cur = q.get('circle') ? 'circle' : q.get('payroll') ? 'payroll' : q.get('escrow') ? 'escrow' : q.get('wallet') ? 'wallet' : 'home';
  const show = (v, target) => {
    cur = v;
    for (const [el, g] of groups) el.classList.toggle('vhide', g !== v);
    hero.classList.toggle('vhide', v !== 'home');
    document.querySelectorAll('#side a').forEach((a) => a.classList.toggle('on', a.dataset.view === v));
    const tg = target && document.querySelector(target);
    if (tg) tg.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0);
    try { history.replaceState(null, '', location.pathname + location.search + (v === 'home' ? '' : '#' + v)); } catch {}
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-view]'); if (!a || !NAMES.includes(a.dataset.view)) return;
    e.preventDefault();
    const href = a.getAttribute('href');
    show(a.dataset.view, href && href.startsWith('#') ? href : null);
  });
  // when the app opens a circle/payroll/wallet card by itself, jump to its view
  const fromHash = location.hash.replace('#', '');
  show(NAMES.includes(fromHash) ? fromHash : cur);
  return { show };
}
