import { build } from 'esbuild';
import fs from 'node:fs';
const r = await build({ entryPoints: ['app.mjs'], bundle: true, format: 'iife', minify: true, write: false });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', fs.readFileSync('template.html', 'utf8').replace('/*APP*/', () => js));
console.log('dist/index.html', fs.statSync('dist/index.html').size, 'bytes');
