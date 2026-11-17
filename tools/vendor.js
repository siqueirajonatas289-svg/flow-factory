#!/usr/bin/env node
/* Copia os bundles IIFE do Capacitor para www/js/vendor, para o jogo usar sem bundler.
 * Rodado automaticamente por `npm run sync`. No navegador comum esses scripts só registram
 * implementações web (inofensivas); no app Android eles conversam com a ponte nativa. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'www/js/vendor');
fs.mkdirSync(out, { recursive: true });
const files = [
  ['node_modules/@capacitor/core/dist/capacitor.js', 'capacitor.js'],
  ['node_modules/@capacitor/app/dist/plugin.js', 'capacitor-app.js'],
  ['node_modules/@capacitor/haptics/dist/plugin.js', 'capacitor-haptics.js']
];
for (const [src, dst] of files) {
  const from = path.join(root, src);
  if (!fs.existsSync(from)) { console.error('Faltando ' + src + ' — rode `npm install`.'); process.exit(1); }
  // remove a referência ao .map (não é copiado) para não gerar 404 no console
  const code = fs.readFileSync(from, 'utf8').replace(/\n\/\/# sourceMappingURL=.*$/m, '\n');
  fs.writeFileSync(path.join(out, dst), code);
  console.log('vendor: ' + dst);
}
