#!/usr/bin/env node
/* FLOW FACTORY — validador de fases
 * Uso: node tools/validate.js [id-da-fase ...] [--json]
 *
 * Para cada fase verifica:
 *  - estrutura: caracteres, conexões quebradas, saídas sem destino,
 *    cruzamentos com fluxo frontal, blocos inalcançáveis, cores sem recipiente
 *  - solução: busca exaustiva; exige vitória, solução executável por humano,
 *    solução "limpa" (sem sobrecarga) e meta de intervenções (par) coerente
 *  - replay: reproduz a solução com toques reais na API do jogo
 *  - física: nenhum par de objetos se sobrepõe em nenhum tick
 *  - não-interação: informa se a fase se resolve sem tocar em nada
 */
const { solve, replay, FF } = require('./solver');
const C = FF.CONFIG;

function structural(level) {
  const errors = [], warnings = [];
  let F;
  try { F = FF.buildFactory(level); } catch (e) { return { errors: [e.message], warnings }; }
  errors.push(...F.errors);
  if (!F.sources.length) errors.push('Nenhuma fonte');
  if (!F.bins.length) errors.push('Nenhum recipiente');

  F.tiles.forEach(t => {
    if (!t) return;
    const where = `${t.type} em (${t.x},${t.y})`;
    t.exits.forEach(e => {
      const N = F.nb(t, e);
      if (!N) errors.push(`Conexão quebrada: ${where} aponta para fora do mapa`);
      else if (!N.accepts[FF.opp(e)]) errors.push(`Conexão quebrada: ${where} aponta para ${N.type} que não aceita entrada`);
    });
    if (t.type === 'crossing') {
      if ((t.feeders[0] && t.feeders[2]) || (t.feeders[1] && t.feeders[3]))
        errors.push(`Cruzamento com fluxo frontal em (${t.x},${t.y})`);
      if (t.exits.length < 2) warnings.push(`Cruzamento subutilizado em (${t.x},${t.y})`);
    }
    if (t.type === 'diverter') {
      if (t.outs.length !== 2) errors.push(`Desviador precisa de 2 saídas em (${t.x},${t.y})`);
      if (!t.feeders.some(Boolean)) errors.push(`Desviador sem entrada em (${t.x},${t.y})`);
    }
    if (t.type === 'distributor' && !t.feeders.some(Boolean)) errors.push(`Distribuidor sem entrada em (${t.x},${t.y})`);
    if (t.type === 'gate' && !t.feeders.some(Boolean)) errors.push(`Bloqueador sem entrada em (${t.x},${t.y})`);
  });

  // Alcance a partir das fontes
  const seen = new Set();
  const stack = F.sources.map(s => F.tiles[s.tile]);
  while (stack.length) {
    const t = stack.pop();
    if (seen.has(t.i)) continue;
    seen.add(t.i);
    t.exits.forEach(e => { const N = F.nb(t, e); if (N && N.accepts[FF.opp(e)]) stack.push(N); });
  }
  F.tiles.forEach(t => { if (t && !seen.has(t.i)) warnings.push(`Bloco inalcançável: ${t.type} em (${t.x},${t.y})`); });

  const cats = new Set();
  F.sources.forEach(s => s.seq.forEach(c => { cats.add(c); if (!FF.CATS[c]) errors.push('Categoria inválida: ' + c); }));
  cats.forEach(c => { if (!F.bins.some(b => b.cat === c)) errors.push(`Sem recipiente para ${c}`); });
  F.bins.forEach(b => { if (!cats.has(b.cat)) warnings.push(`Recipiente ${b.cat} nunca recebe objetos`); });
  return { errors, warnings, F };
}

function minDistanceCheck(level, sol) {
  let minD = Infinity, worst = null;
  const p = {}, q = {};
  const sim = replay(level, sol, s => {
    const its = s.items;
    for (let i = 0; i < its.length; i++) {
      FF.Geo.itemPos(s.F, its[i], p);
      for (let j = i + 1; j < its.length; j++) {
        FF.Geo.itemPos(s.F, its[j], q);
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < minD) { minD = d; worst = { tick: s.tick, a: its[i].id, b: its[j].id }; }
      }
    }
  });
  return { minD, worst, sim };
}

function idleRun(level) {
  const sim = FF.Sim.create(level);
  FF.Sim.start(sim);
  while (sim.status === 'running') FF.Sim.step(sim);
  return sim;
}

function validateLevel(level) {
  const rep = { id: level.id, name: level.name, ok: true, errors: [], warnings: [], info: {} };
  const st = structural(level);
  rep.errors.push(...st.errors); rep.warnings.push(...st.warnings);
  if (rep.errors.length) { rep.ok = false; return rep; }

  const t0 = Date.now();
  const res = solve(level, { maxWork: level.solverWork || 4e6 });
  rep.info.ms = Date.now() - t0;
  rep.info.exhaustive = res.exhaustive;
  rep.info.solutions = res.solutions;
  rep.info.deadEnds = res.failures;
  if (!res.best) { rep.errors.push('SEM SOLUÇÃO encontrada'); rep.ok = false; return rep; }
  if (!res.bestClean) { rep.errors.push('Nenhuma solução sem sobrecarga (3 estrelas impossível)'); }
  const ref = res.bestClean || res.best;
  rep.info.minTaps = res.best.taps;
  rep.info.cleanTaps = res.bestClean ? res.bestClean.taps : null;
  rep.info.seconds = +(ref.ticks / C.TICK_RATE).toFixed(1);
  rep.info.minWindow = ref.minWindow === Infinity ? null : +(ref.minWindow / C.TICK_RATE).toFixed(2);
  rep.info.reference = { init: ref.init, schedule: ref.schedule };

  if (level.par === undefined) rep.errors.push(`Defina par (sugestão: ${ref.taps})`);
  else if (res.bestClean && level.par < res.bestClean.taps) rep.errors.push(`par=${level.par} é menor que o mínimo possível (${res.bestClean.taps})`);
  else if (res.exhaustive && res.bestClean && level.par > res.bestClean.taps + 2) rep.warnings.push(`par=${level.par} folgado (mínimo ${res.bestClean.taps})`);

  // Replay com toques reais + checagem de sobreposição
  const chk = minDistanceCheck(level, ref);
  rep.info.replay = chk.sim.status;
  rep.info.minDist = +chk.minD.toFixed(3);
  if (chk.sim.status !== 'won') rep.errors.push('Replay da solução NÃO venceu: ' + chk.sim.status + ' ' + JSON.stringify(chk.sim.fail));
  if (chk.minD < C.ITEM_SIZE - 1e-6) rep.errors.push(`Sobreposição: distância ${chk.minD.toFixed(3)} < ${C.ITEM_SIZE} em ${JSON.stringify(chk.worst)}`);
  const ev = FF.Sim.evaluate(chk.sim);
  rep.info.replayStars = ev.stars;

  const idle = idleRun(level);
  rep.info.idle = idle.status === 'won' ? 'vence sem tocar' : (idle.fail ? idle.fail.reason : idle.status);
  if (level.requiresAction && idle.status === 'won') rep.errors.push('Fase deveria exigir ação mas vence sem toques');
  if (level.requiresHold) {
    const nh = solve(level, { maxHolds: 0, maxWork: 1e6 });
    rep.info.withoutGate = nh.bestClean ? 'resolve sem bloqueador' : 'exige bloqueador';
    if (nh.bestClean) rep.errors.push('Fase deveria exigir o bloqueador, mas tem solução limpa sem ele');
  }

  rep.ok = rep.errors.length === 0;
  return rep;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const ids = args.filter(a => !a.startsWith('--'));
  const levels = FF.LEVELS.filter(l => !ids.length || ids.includes(l.id));
  let bad = 0;
  const out = [];
  for (const L of levels) {
    const r = validateLevel(L);
    out.push(r);
    if (!r.ok) bad++;
    if (!json) {
      const i = r.info;
      console.log(`${r.ok ? '✔' : '✘'} ${r.id.padEnd(4)} ${String(r.name).padEnd(22)} ` +
        (i.minTaps !== undefined ? `toques min=${i.minTaps} limpo=${i.cleanTaps} par=${L.par} t=${i.seconds}s janela=${i.minWindow === null ? '-' : i.minWindow + 's'} dist=${i.minDist} sem-toque=${i.idle} ${i.exhaustive ? 'exato' : 'PARCIAL'} sols=${i.solutions} ${i.ms}ms` : ''));
      r.errors.forEach(e => console.log('    ERRO: ' + e));
      r.warnings.forEach(w => console.log('    aviso: ' + w));
    }
  }
  if (json) console.log(JSON.stringify(out, null, 2));
  else console.log(`\n${levels.length - bad}/${levels.length} fases válidas`);
  process.exit(bad ? 1 : 0);
}

module.exports = { validateLevel, structural };
