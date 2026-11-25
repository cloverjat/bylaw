import { build } from 'esbuild';
import fs from 'node:fs';
fs.mkdirSync('dist', { recursive: true });
const r = await build({ entryPoints: ['app.mjs'], bundle: true, format: 'iife', minify: true, write: false });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
fs.writeFileSync('dist/index.html', fs.readFileSync('template.html', 'utf8').replace('/*APP*/', () => js));
console.log('dist/index.html', fs.statSync('dist/index.html').size, 'bytes');
// WalletConnect: separate file, fetched only when someone picks it.
await build({ entryPoints: ['wc-entry.mjs'], bundle: true, format: 'iife', minify: true, outfile: 'dist/wc.js', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error' });
console.log('dist/wc.js', fs.statSync('dist/wc.js').size, 'bytes');
