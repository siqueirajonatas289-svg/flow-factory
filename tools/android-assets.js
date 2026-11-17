#!/usr/bin/env node
/* FLOW FACTORY — gera ícones e splash do Android a partir do emblema do jogo
 * (esteira em Y + desviador ciano + objetos), o mesmo de www/icons/icon.svg.
 * Uso: node tools/android-assets.js   (depois do `npx cap add android`) */
'use strict';
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const res = path.join(root, 'android/app/src/main/res');
const store = path.join(root, 'resources/store');
const BG = '#070c1a';

// Emblema no espaço 512×512. As esteiras passam das bordas de propósito
// (o recorte do ícone adaptativo corta o excesso).
// Versão monocromática (ícones temáticos do Android 13+): só traços e formas, sem lona.
function emblemMono() {
  return `<g transform="translate(-72 6)">
  <g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">
    <path d="M200 -40 V250 Q200 396 346 396 H560" stroke-width="16"/>
    <path d="M312 -40 V250 Q312 284 346 284 H560" stroke-width="16"/>
    <circle cx="256" cy="300" r="58" stroke-width="16"/>
  </g>
  <path d="M302 300 L246 270 L256 300 L246 330 Z" fill="#fff"/>
  <circle cx="256" cy="140" r="34" fill="#fff"/>
  <rect x="398" y="308" width="62" height="62" rx="12" fill="#fff"/></g>`;
}

function emblem(mono) {
  if (mono) return emblemMono();
  const rail = mono ? '#fff' : '#4a5874', railOff = mono ? '#fff' : '#232c40';
  const belt = mono ? 'none' : '#0d1320', beltOff = mono ? 'none' : '#0a0f1a';
  const cyan = mono ? '#fff' : '#2fe6e6';
  const hubFill = mono ? 'none' : '#0b1220';
  const red = mono ? '#fff' : '#ff4f62', redDark = mono ? '#fff' : '#9e1f33';
  const blue = mono ? '#fff' : '#3d8bff', blueDark = mono ? '#fff' : '#173f99';
  const beltW = mono ? 0 : 98;
  return `
  <g fill="none" stroke-linejoin="round">
    <path d="M256 -200 V256 Q256 340 340 340 H760" stroke="${rail}" stroke-width="122"/>
    <path d="M256 256 Q256 340 172 340 H-250" stroke="${railOff}" stroke-width="122" ${mono ? 'stroke-opacity="0.45"' : ''}/>
    ${mono ? '' : `<path d="M256 256 Q256 340 172 340 H-250" stroke="${beltOff}" stroke-width="${beltW}"/>
    <path d="M256 -200 V256 Q256 340 340 340 H760" stroke="${belt}" stroke-width="${beltW}"/>`}
  </g>
  ${mono ? '' : `<g fill="none" stroke="${cyan}" stroke-opacity=".55" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
    <path d="M232 52 L256 72 L280 52"/><path d="M232 214 L256 234 L280 214"/>
    <path d="M340 316 L360 340 L340 364"/><path d="M482 316 L502 340 L482 364"/>
  </g>`}
  <circle cx="256" cy="300" r="58" fill="${hubFill}" stroke="${cyan}" stroke-width="14"/>
  <path d="M302 300 L246 270 L256 300 L246 330 Z" fill="${cyan}"/>
  <circle cx="256" cy="140" r="36" fill="${red}" stroke="${redDark}" stroke-width="9"/>
  <rect x="396" y="306" width="66" height="66" rx="12" fill="${blue}" stroke="${blueDark}" stroke-width="9"/>`;
}
const DEFS = `<defs>
  <radialGradient id="bg" cx="0.5" cy="0.2" r="0.85"><stop offset="0" stop-color="#16285a"/><stop offset="0.55" stop-color="#0c1428"/><stop offset="1" stop-color="${BG}"/></radialGradient>
</defs>`;

/** scale: fração do lado ocupada pelo emblema (1 = arte original de 512). */
function svg({ bg, scale, mono, w = 512, h = 512, dy = 0 }) {
  const k = (scale * Math.min(w, h)) / 512;
  let back = '';
  if (bg === 'square') back = `<rect width="${w}" height="${h}" rx="${w * 0.22}" fill="url(#bg)"/>`;
  if (bg === 'circle') back = `<circle cx="${w / 2}" cy="${h / 2}" r="${w / 2}" fill="url(#bg)"/>`;
  if (bg === 'full') back = `<rect width="${w}" height="${h}" fill="url(#bg)"/>`;
  const clip = bg === 'square' ? `<clipPath id="c"><rect width="${w}" height="${h}" rx="${w * 0.22}"/></clipPath>`
    : bg === 'circle' ? `<clipPath id="c"><circle cx="${w / 2}" cy="${h / 2}" r="${w / 2}"/></clipPath>`
    : `<clipPath id="c"><rect width="${w}" height="${h}"/></clipPath>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${DEFS}<defs>${clip}</defs>${back}
  <g clip-path="url(#c)"><g transform="translate(${w / 2} ${h / 2 + dy}) scale(${k}) translate(-256 -256)">${emblem(mono)}</g></g></svg>`;
}

async function png(svgText, size, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const [w, h] = Array.isArray(size) ? size : [size, size];
  await sharp(Buffer.from(svgText), { density: 300 }).resize(w, h).png().toFile(file);
}

const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

(async () => {
  if (!fs.existsSync(res)) { console.error('Projeto Android não encontrado. Rode `npx cap add android` antes.'); process.exit(1); }
  const out = [];
  for (const [d, k] of Object.entries(DENS)) {
    const dir = path.join(res, 'mipmap-' + d);
    // ícone legado (Android < 8) e redondo
    await png(svg({ bg: 'square', scale: 1 }), Math.round(48 * k), path.join(dir, 'ic_launcher.png'));
    await png(svg({ bg: 'circle', scale: 0.95 }), Math.round(48 * k), path.join(dir, 'ic_launcher_round.png'));
    // ícone adaptativo (108dp): o essencial dentro da zona segura central de 66dp
    await png(svg({ scale: 0.62 }), Math.round(108 * k), path.join(dir, 'ic_launcher_foreground.png'));
    await png(svg({ scale: 0.62, mono: true }), Math.round(108 * k), path.join(dir, 'ic_launcher_monochrome.png'));
    out.push(d);
  }
  // o XML do ícone adaptativo do template referencia o monocromático só se existir: garante o arquivo
  const adaptive = path.join(res, 'mipmap-anydpi-v26/ic_launcher.xml');
  if (fs.existsSync(adaptive)) {
    let x = fs.readFileSync(adaptive, 'utf8');
    if (!x.includes('monochrome')) {
      x = x.replace('</adaptive-icon>', '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n</adaptive-icon>');
      fs.writeFileSync(adaptive, x);
    }
  }
  // splash Android 12+: ícone 288dp (só a área circular central de 192dp aparece)
  await png(svg({ scale: 0.55 }), 1152, path.join(res, 'drawable-nodpi/splash_icon.png'));
  // splash Android < 12: imagem de fundo inteira, retrato e paisagem
  const splashes = {
    'drawable': [480, 320],
    'drawable-port-mdpi': [320, 480], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280],
    'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920],
    'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480], 'drawable-land-xhdpi': [1280, 720],
    'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280]
  };
  for (const [dir, [w, h]] of Object.entries(splashes)) {
    await png(svg({ bg: 'full', scale: 0.3, w, h }), [w, h], path.join(res, dir, 'splash.png'));
  }
  await png(svg({ bg: 'full', scale: 1 }), 512, path.join(store, 'play-icon-512.png'));
  console.log('Ícones gerados para: ' + out.join(', ') + ' + splash + ícone da loja');
})().catch(e => { console.error(e); process.exit(1); });
