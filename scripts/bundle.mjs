// Builds a single self-contained HTML file from index.html and src/.
// The repo runs as-is (GitHub Pages serves index.html and loads src/ in order);
// this bundle is for opening the app offline from one file.
//
//   node scripts/bundle.mjs            -> dist/hardcap.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

let html = read('index.html');

// Escapes that would close the inline tag early
const safeScript = (js) => js.replace(/<\/script/gi, '<\\/script');
const safeStyle = (css) => css.replace(/<\/style/gi, '<\\/style');

let styles = 0;
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => {
  styles++;
  return `<style>\n${safeStyle(read(href))}</style>`;
});

let scripts = 0;
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  scripts++;
  return `<script>\n${safeScript(read(src))}</script>`;
});

mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', 'hardcap.html');
writeFileSync(out, html);
console.log(`Bundled ${styles} stylesheet and ${scripts} scripts into dist/hardcap.html (${Math.round(html.length / 1024)} KB)`);
