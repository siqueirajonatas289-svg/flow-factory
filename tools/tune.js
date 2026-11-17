#!/usr/bin/env node
/* Calibrador de fases: testa variações de ritmo/atraso/sequência das fontes
 * de uma fase e escolhe a melhor segundo metas de design.
 * Uso: node tools/tune.js <id> [--win 0.8] [--min 3] [--max 12] [--target 8] [--gate] [--n 120] [--json]
 * As variações vêm do campo `tune` da fase:
 *   tune: { A: { seq: ['RRB', 'RBR'], interval: [60, 80], delay: [0, 40] }, ... }
 * Com --target, ordena pela proximidade da meta de toques (dificuldade).
 */
const { solve, replay, FF } = require('./solver');
const { solveBuild } = require('./validate');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : (isNaN(+v) ? v : +v);
}

const id = process.argv[2];
const base = FF.levelById(id);
if (!base) { console.error('fase não encontrada: ' + id); process.exit(1); }
const goal = {
  win: arg('win', 0.8), min: arg('min', 1), max: arg('max', 20), gate: !!arg('gate', false) || !!base.requiresHold,
  n: arg('n', 150), target: arg('target', null), json: !!arg('json', false), work: arg('work', 6e5)
};

let seed = 1234 + id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];

const space = base.tune || {};
const keys = Object.keys(space);
const seen = new Set(), results = [];
const t0 = Date.now(), budget = arg('secs', 400) * 1000;
for (let t = 0; t < goal.n && Date.now() - t0 < budget; t++) {
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
  const r = L.build ? solveBuild(L, { maxWork: goal.work }) : solve(L, { maxWork: goal.work });
  if (!r.bestClean) continue;
  const b = r.bestClean, win = b.minWindow === Infinity ? 99 : b.minWindow / 60;
  if (win < goal.win || b.taps < goal.min || b.taps > goal.max) continue;
  if (replay(L, b).status !== 'won') continue;
  if (goal.gate) { const ng = solve(L, { maxHolds: 0, maxWork: 3e5 }); if (ng.bestClean) continue; }
  if (!L.build) {
    const idle = FF.Sim.create(L); FF.Sim.start(idle); while (idle.status === 'running') FF.Sim.step(idle);
    if (idle.status === 'won') continue;
  }
  results.push({ choice, taps: b.taps, win: +win.toFixed(2), secs: +(b.ticks / 60).toFixed(1), sols: r.solutions });
}
if (goal.target !== null) results.sort((a, b) => Math.abs(a.taps - goal.target) - Math.abs(b.taps - goal.target) || b.win - a.win);
else results.sort((a, b) => b.taps - a.taps || b.win - a.win);
if (goal.json) { console.log(JSON.stringify({ id, tested: seen.size, results: results.slice(0, 5) })); process.exit(0); }
console.log(`${id}: ${results.length} configurações boas de ${seen.size} testadas`);
results.slice(0, 8).forEach(r => console.log(JSON.stringify(r)));
