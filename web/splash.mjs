// Opening screen: logo, short brief, disclaimer, then "Enter". Shown once per visit; shared links (?circle=, ?wallet=...) skip it.
const el = document.getElementById('splash');
let seen = false; try { seen = sessionStorage.getItem('bylaw_seen') === '1'; } catch {}
const deep = /[?&](circle|payroll|wallet|dev)=/.test(location.search);
const close = () => { el.classList.add('out'); document.body.style.overflow = ''; try { sessionStorage.setItem('bylaw_seen', '1'); } catch {} setTimeout(() => el.remove(), 600); };
if (seen || deep) el.remove();
else {
  document.body.style.overflow = 'hidden';
  setTimeout(() => el.classList.add('ready'), 1500);
  document.getElementById('splash_go').addEventListener('click', close);
}
