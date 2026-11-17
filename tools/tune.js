#!/usr/bin/env node
/* Calibrador de fases: testa variações de ritmo/atraso/sequência das fontes
 * de uma fase e lista as melhores segundo metas de design.
 * Uso: node tools/tune.js <id> [--win 0.8] [--min 3] [--max 12] [--gate] [--n 120]
 * As variações vêm do campo `tune` da fase (opcional):
 *   tune: { A: { seq: ['RRB', 'RBR'], interval: [60, 80], delay: [0, 40] }, ... }
 */
const { solve, replay, FF } = require('./solver');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : (isNaN(+v) ? v : +v);
}

const id = process.argv[2];
const base = FF.levelById(id);
if (!base) { console.error('fase não encontrada: ' + id); process.exit(1); }
const goal = { win: arg('win', 0.8), min: arg('min', 1), max: arg('max', 14), gate: !!arg('gate', false), n: arg('n', 150) };

let seed = 1234;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];

const space = base.tune || {};
const keys = Object.keys(space);
const seen = new Set(), results = [];
for (let t = 0; t < goal.n; t++) {
  const L = JSON.parse(JSON.stringify(base));
  const choice = {};
  keys.forEach(k => {
    const sp = space[k], src = L.legend[k], c = {};
    ['seq', 'interval', 'delay'].forEach(f => { if (sp[f]) { c[f] = pick(sp[f]); src[f] = c[f]; } });
    choice[k] = c;
  });
  const sig = JSON.stringify(choice);
  if (seen.has(sig)) continue;
  seen.add(sig);
  const r = solve(L, { maxWork: 6e5 });
  if (!r.bestClean) continue;
  const b = r.bestClean, win = b.minWindow === Infinity ? 99 : b.minWindow / 60;
  if (win < goal.win || b.taps < goal.min || b.taps > goal.max) continue;
  if (replay(L, b).status !== 'won') continue;
  if (goal.gate) { const ng = solve(L, { maxHolds: 0, maxWork: 3e5 }); if (ng.bestClean) continue; }
  const idle = FF.Sim.create(L); FF.Sim.start(idle); while (idle.status === 'running') FF.Sim.step(idle);
  if (idle.status === 'won') continue;
  results.push({ choice, taps: b.taps, win: +win.toFixed(2), secs: +(b.ticks / 60).toFixed(1), sols: r.solutions });
}
results.sort((a, b) => b.taps - a.taps || b.win - a.win);
console.log(`${id}: ${results.length} configurações boas de ${seen.size} testadas`);
results.slice(0, 8).forEach(r => console.log(JSON.stringify(r)));
