/* FLOW FACTORY — solver.js (validador de fases)
 *
 * O estado de um desviador só é lido no instante em que um objeto entra
 * nele. Portanto, QUALQUER estratégia do jogador equivale a uma sequência
 * de escolhas (saída A ou B) nesses instantes. O solver faz uma busca em
 * profundidade sobre essas escolhas, simulando o jogo real entre elas.
 * Isso torna a verificação exata (dentro do limite de trabalho).
 *
 * Também verifica se a solução é humanamente executável: cada troca de
 * desviador precisa de uma janela mínima entre dois objetos e de um
 * intervalo mínimo desde o toque anterior.
 */
const load = require('./load');
const FF = load();
const C = FF.CONFIG;

class NeedDecision {
  constructor(item, tile) { this.item = item; this.tile = tile; this.key = item.id + '@' + tile.i; }
}

// Para cada (bloco, saída): quais categorias, saindo por ali, conseguem chegar a um
// recipiente que as aceite. Considera pintores (a cor muda no caminho), curinga e descarte.
const ALL_CATS = Object.keys(FF.CATS);
function computeReach(F) {
  const reach = new Map();
  const key = (t, e) => t.i * 4 + e;
  F.tiles.forEach(t => { if (t) t.exits.forEach(e => reach.set(key(t, e), new Set())); });
  const get = (t, e) => reach.get(key(t, e)) || new Set();
  let changed = true, guard = 0;
  while (changed && guard++ < 400) {
    changed = false;
    F.tiles.forEach(t => {
      if (!t) return;
      t.exits.forEach(e => {
        const set = reach.get(key(t, e));
        const before = set.size;
        const N = F.nb(t, e), ent = FF.opp(e);
        if (!N || !N.accepts[ent]) return;
        for (const c of ALL_CATS) {
          if (set.has(c)) continue;
          let ok = false;
          switch (N.type) {
            case 'bin': ok = FF.binAccepts(N.cat, c); break;
            case 'paint': ok = get(N, N.out).has(c === 'X' ? 'X' : N.color); break;
            case 'conveyor': case 'gate': ok = get(N, N.out).has(c); break;
            case 'crossing': case 'bridge': ok = get(N, e).has(c); break;
            case 'filter':
              ok = get(N, N.outs[1]).has(c) || (N.colors.indexOf(c) >= 0 && get(N, N.outs[0]).has(c));
              break;
            case 'rev': ok = N.dirs.some(d => d !== ent && get(N, d).has(c)); break;
            case 'diverter': case 'distributor': ok = N.outs.some(o => get(N, o).has(c)); break;
          }
          if (ok) set.add(c);
        }
        if (set.size !== before) changed = true;
      });
    });
  }
  return { get };
}

function decisionPossible(sim) {
  const F = sim.F;
  for (const X of sim.items) {
    if (X.dead) continue;
    const T = F.tiles[X.tile];
    if (X.half === 0) {
      // chegada à linha de parada de um bloqueador aberto
      if (T.type === 'gate' && sim.dev[T.dev] === 0 && sim.gateOpened[T.dev] < sim.tick) {
        const dC = C.HALF - X.p;
        if (dC >= C.GATE_STOP && dC - T.speed < C.GATE_STOP) return true;
      }
      continue;
    }
    if (X.p + T.speed < C.HALF) continue;
    const N = F.nb(T, X.outs);
    if (FF.Routing.isSwitch(N)) return true;
    if (N && N.type === 'rev' && !(T.type === 'rev' && T.dev === N.dev)) return true;
  }
  return false;
}

// Agenda k toques seguidos num dispositivo antes do instante `now`.
function scheduleTaps(sv, d, k, now, releaseTick) {
  for (let i = 0; i < k; i++) {
    const tapTime = Math.max(sv.lastTap + C.MIN_TAP_GAP, releaseTick + 1);
    if (tapTime > now) { sv.infeasible = true; }
    sv.taps++;
    sv.lastTap = tapTime;
    sv.schedule.push({ tick: tapTime, dev: d });
    releaseTick = tapTime;
  }
}

function applyChoice(s, X, N, st) {
  const d = N.dev, sv = s.solve, n = FF.Routing.nStates(N);
  if (s.dev[d] === -1) {
    sv.init[d] = st; // definido no planejamento, sem custo
  } else if (N.type === 'rev' && s.dev[d] !== st) {
    // inverter: só com o trecho vazio no começo do tick, e o toque é agora
    if (s.solveOcc[d] > 0 || sv.lastTap + C.MIN_TAP_GAP > s.tick) sv.infeasible = true;
    sv.taps++;
    sv.lastTap = s.tick;
    sv.schedule.push({ tick: s.tick, dev: d });
  } else if (s.dev[d] !== st) {
    const window = s.tick - sv.lastLock[d];
    if (window < C.MIN_TAP_WINDOW) sv.infeasible = true;
    // desviador de 2 saídas: 1 toque; distribuidor: avança 1 saída por toque
    const k = (st - s.dev[d] + n) % n;
    scheduleTaps(sv, d, k, s.tick, sv.lastLock[d]);
    if (window < sv.minWindow) sv.minWindow = window;
  }
  s.dev[d] = st; // o distribuidor avança sozinho em routeOnEnter
  sv.lastLock[d] = s.tick;
  return st;
}

// Bloqueador: segurar = um toque agora (fecha por GATE_TICKS).
function applyGate(s, X, T, hold) {
  if (!hold) return false;
  const sv = s.solve, d = T.dev;
  // o toque acontece no próprio instante da chegada (antes do passo deste tick no replay)
  if (sv.lastTap + C.MIN_TAP_GAP > s.tick) sv.infeasible = true;
  sv.taps++;
  sv.lastTap = s.tick;
  sv.schedule.push({ tick: s.tick, dev: d });
  s.dev[d] = (s.tick - 1) + C.GATE_TICKS;
  sv.holds = (sv.holds || 0) + 1;
  return true;
}

function solve(level, opts = {}) {
  const maxWork = opts.maxWork || 4e6;     // ticks simulados no total
  const maxTicks = opts.maxTicks || 60 * 240;
  const placements = opts.placements || {};
  const root = FF.Sim.create(level, placements);
  const F = root.F;
  const reach = computeReach(F);
  root.dev = root.dev.map((v, i) => F.devices[i].type === 'gate' ? 0 : -1);
  root.solve = {
    taps: 0, lastTap: -1e9, lastLock: F.devices.map(() => -1e9),
    init: F.devices.map(d => d.init), schedule: [], minWindow: Infinity, infeasible: false
  };
  root.forced = {};
  FF.Sim.start(root);

  let work = 0, exhaustive = true, solutions = 0;
  let best = null, bestClean = null;
  const failures = {};

  const cloneS = (s) => {
    const c = FF.Sim.clone(s);
    c.solve = Object.assign({}, s.solve, {
      lastLock: s.solve.lastLock.slice(), init: s.solve.init.slice(), schedule: s.solve.schedule.slice()
    });
    c.forced = Object.assign({}, s.forced);
    return c;
  };

  function record(sim) {
    solutions++;
    const r = {
      taps: sim.solve.taps, ticks: sim.tick, peak: sim.peakPressure,
      clean: sim.peakPressure < C.HOPPER_WARN, init: sim.solve.init.slice(),
      schedule: sim.solve.schedule.slice(), minWindow: sim.solve.minWindow, placements
    };
    const better = (a, b) => !b || a.taps < b.taps || (a.taps === b.taps && a.ticks < b.ticks);
    if (better(r, best)) best = r;
    if (r.clean && better(r, bestClean)) bestClean = r;
  }

  function run(sim) {
    for (;;) {
      if (++work > maxWork) { exhaustive = false; return; }
      if (sim.status === 'won') { record(sim); return; }
      if (sim.status === 'failed') { failures[sim.fail.reason] = (failures[sim.fail.reason] || 0) + 1; return; }
      if (sim.solve.infeasible) { failures.reaction = (failures.reaction || 0) + 1; return; }
      if (sim.tick > maxTicks) { failures.timeout = (failures.timeout || 0) + 1; return; }
      if (bestClean && sim.solve.taps > bestClean.taps) return; // poda
      // ocupação dos trechos reversíveis no começo do tick (regra: só inverte vazio)
      sim.solveOcc = F.devices.map((dv, i) => dv.type === 'rev' ? FF.Sim.revLoad(sim, i) : 0);
      const snap = decisionPossible(sim) ? cloneS(sim) : null;
      let req = null;
      sim.decide = (s, X, N) => {
        const k = X.id + '@' + N.i;
        if (s.forced[k] !== undefined) return applyChoice(s, X, N, s.forced[k]);
        throw new NeedDecision(X, N);
      };
      sim.gateDecide = (s, X, T) => {
        // quem espera na linha passa no instante em que o bloqueador reabre (humano não re-fecha a tempo)
        if (s.gateOpened[T.dev] >= s.tick - 1) return false;
        const k = 'g' + X.id + '@' + T.i + '@' + s.tick;
        if (s.forced[k] !== undefined) return applyGate(s, X, T, s.forced[k]);
        const e = new NeedDecision(X, T); e.key = k; e.gate = true;
        throw e;
      };
      try { FF.Sim.step(sim); } catch (e) { if (!(e instanceof NeedDecision)) throw e; req = e; }
      if (req) {
        if (!snap) throw new Error('Decisão inesperada sem snapshot');
        const N = req.tile, d = N.dev, cur = snap.dev[d];
        let options;
        if (req.gate) {
          options = (snap.solve.holds || 0) < (opts.maxHolds !== undefined ? opts.maxHolds : 12) ? [false, true] : [false];
        } else {
          const n = FF.Routing.nStates(N), cat = req.item.cat;
          const cost = st => cur >= 0 ? (st - cur + n) % n : 0;
          if (N.type === 'filter') {
            // estados diferentes podem dar a mesma saída: fica o mais barato de cada saída
            const best = new Map();
            for (let st = 0; st < n; st++) {
              const ex = FF.Routing.filterExit(N, st, cat);
              if (!reach.get(N, ex).has(cat)) continue;
              if (!best.has(ex) || cost(st) < cost(best.get(ex))) best.set(ex, st);
            }
            options = [...best.values()];
          } else if (N.type === 'rev') {
            options = [0, 1].filter(i => N.dirs[i] !== req.item.ins && reach.get(N, N.dirs[i]).has(cat));
          } else {
            options = N.outs.map((_, i) => i).filter(i => reach.get(N, N.outs[i]).has(cat));
          }
          options.sort((a, b) => cost(a) - cost(b));
        }
        if (!options.length) { failures.unreachable = (failures.unreachable || 0) + 1; return; }
        for (const o of options) {
          const child = cloneS(snap);
          child.forced[req.key] = o;
          run(child);
        }
        return;
      }
    }
  }

  run(root);
  return { best, bestClean, exhaustive, work, solutions, failures, reach };
}

// Reproduz uma solução usando APENAS a API pública do jogo (toques reais).
function replay(level, sol, onTick) {
  const sim = FF.Sim.create(level, sol.placements || {});
  sol.init.forEach((st, d) => {
    if (sim.F.devices[d].type === 'gate') { if (sim.dev[d] > 0) FF.Sim.toggle(sim, d); return; }
    while (sim.dev[d] !== st) FF.Sim.toggle(sim, d);
  });
  sim.planTaps = 0;
  FF.Sim.start(sim);
  const byTick = new Map();
  sol.schedule.forEach(s => { if (!byTick.has(s.tick)) byTick.set(s.tick, []); byTick.get(s.tick).push(s.dev); });
  while (sim.status === 'running' && sim.tick < C.MAX_TICKS) {
    const next = sim.tick + 1;
    (byTick.get(next) || []).forEach(d => FF.Sim.toggle(sim, d));
    FF.Sim.step(sim);
    if (onTick) onTick(sim);
  }
  return sim;
}

module.exports = { solve, replay, computeReach, FF };
