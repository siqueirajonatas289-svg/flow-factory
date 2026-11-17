#!/usr/bin/env node
/* Gera dist/flow-factory.html: o jogo inteiro num único arquivo
 * (CSS, JS, fontes e ícone embutidos). Útil para testar no celular,
 * compartilhar ou hospedar em qualquer lugar. O app Android usa a pasta www/.
 */
const fs = require('fs');
const path = require('path');
const WWW = path.join(__dirname, '..', 'www');
const DIST = path.join(__dirname, '..', 'dist');

let html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
let css = fs.readFileSync(path.join(WWW, 'css', 'style.css'), 'utf8');

css = css.replace(/url\('\.\.\/fonts\/([^']+)'\)/g, (_, f) => {
  const b64 = fs.readFileSync(path.join(WWW, 'fonts', f)).toString('base64');
  return `url(data:font/woff2;base64,${b64})`;
});
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}\n</style>`);

const icon = fs.readFileSync(path.join(WWW, 'icons', 'icon-192.png')).toString('base64');
html = html.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="image/png" href="data:image/png;base64,${icon}">`);
html = html.replace(/<link rel="apple-touch-icon"[^>]*>\n?\s*/, '');
html = html.replace(/<link rel="manifest"[^>]*>\n?\s*/, '');

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(s => !s.includes('vendor/'));
let js = 'globalThis.FF = globalThis.FF || {}; FF.BUNDLED = true;\n';
for (const s of scripts) js += `\n/* ---- ${s} ---- */\n` + fs.readFileSync(path.join(WWW, s), 'utf8');
html = html.replace(/(\s*<script src="[^"]+"><\/script>)+/, () => `\n  <script>\n${js.replace(/<\/script/gi, '<\\/script')}\n  </script>`);

fs.mkdirSync(DIST, { recursive: true });
const out = path.join(DIST, 'flow-factory.html');
fs.writeFileSync(out, html);
console.log(`dist/flow-factory.html (${(html.length / 1024).toFixed(0)} KB, ${scripts.length} módulos embutidos)`);
