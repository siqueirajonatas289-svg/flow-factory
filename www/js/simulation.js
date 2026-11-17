/* FLOW FACTORY — simulation.js
 * Simulação determinística da produção (tick fixo, aritmética inteira).
 * Mesma fase + mesmas decisões nos mesmos ticks = mesmo resultado.
 *
 * Estados: planning -> running <-> paused -> won | failed
 */
(function (FF) {
  'use strict';
  var C = FF.CONFIG, opp = FF.opp, SINK = FF.SINK, HALF = C.HALF;
  var CV = FF.Conveyor;

  function create(level) {
    var F = FF.buildFactory(level);
    if (F.errors.length) throw new Error('Fase ' + level.id + ': ' + F.errors.join('; '));
    var total = 0;
    F.sources.forEach(function (s) { total += s.seq.length; });
    return {
      level: level, F: F,
      gateDecide: null, // gancho do validador para o bloqueador
      gateOpened: F.devices.map(function () { return -1; }), // tick da última reabertura
      tick: 0, status: 'planning',
      items: [], nextId: 1,
      lanes: new Map(),
      dev: F.devices.map(function (d) { return d.type === 'gate' ? (d.init ? C.GATE_TICKS : 0) : d.init; }),
      src: F.sources.map(function (s) {
        return { idx: 0, made: 0, timer: s.interval - s.delay, pressure: 0, blocked: false };
      }),
      binCount: F.bins.map(function () { return 0; }),
      total: total, delivered: 0,
      taps: 0, planTaps: 0,
      lastMove: 0, peakPressure: 0, jamTicks: 0,
      fail: null,
      events: [],
      decide: null // gancho do validador: (sim, item, tile) => estado do desviador
    };
  }

  function start(sim) {
    if (sim.status !== 'planning') return false;
    sim.status = 'running';
    sim.lastMove = sim.tick;
    sim.events.push({ type: 'start' });
    return true;
  }

  function setPaused(sim, paused) {
    if (paused && sim.status === 'running') { sim.status = 'paused'; return true; }
    if (!paused && sim.status === 'paused') { sim.status = 'running'; return true; }
    return false;
  }

  function toggle(sim, devIndex) {
    if (sim.status === 'won' || sim.status === 'failed') return false;
    var d = sim.F.devices[devIndex];
    var t = sim.F.tiles[d.tile];
    if (d.type === 'gate') sim.dev[devIndex] = sim.dev[devIndex] > 0 ? 0 : sim.tick + C.GATE_TICKS;
    else sim.dev[devIndex] = (sim.dev[devIndex] + 1) % t.outs.length;
    if (sim.status === 'planning') sim.planTaps++; else sim.taps++;
    sim.events.push({ type: 'toggle', dev: devIndex, tile: d.tile, state: sim.dev[devIndex] });
    return true;
  }

  function fail(sim, reason, info) {
    if (sim.status === 'failed') return;
    sim.status = 'failed';
    sim.fail = Object.assign({ reason: reason, tick: sim.tick }, info || {});
    sim.events.push({ type: 'fail', reason: reason, tile: sim.fail.tile });
  }

  function routeOnEnter(sim, X, N) {
    if (N.type === 'diverter' || N.type === 'distributor') {
      var st = sim.decide ? sim.decide(sim, X, N) : sim.dev[N.dev];
      if (N.type === 'distributor') {
        // alterna sozinho para a próxima saída
        sim.dev[N.dev] = (st + 1) % N.outs.length;
        sim.events.push({ type: 'cycle', dev: N.dev, tile: N.i, state: sim.dev[N.dev] });
      }
      return N.outs[st];
    }
    return FF.Routing.route(N, X.ins, sim.dev);
  }

  function deliver(sim, X, T) {
    X.dead = true;
    if (X.cat === T.cat) {
      sim.delivered++;
      sim.binCount[T.bin]++;
      sim.events.push({ type: 'deliver', tile: T.i, cat: X.cat, bin: T.bin });
    } else {
      sim.events.push({ type: 'wrong', tile: T.i, cat: X.cat });
      fail(sim, 'wrong', { tile: T.i, cat: X.cat, binCat: T.cat });
    }
  }

  function moveItem(sim, X, adv) {
    var F = sim.F;
    var newP = X.p + adv;
    if (newP < HALF) { X.p = newP; return; } // mesma faixa: ordem preservada
    CV.laneRemove(sim, X);
    X.p = newP - HALF;
    var T = F.tiles[X.tile];
    if (X.half === 0) {
      if (X.outs === SINK) { deliver(sim, X, T); return; }
      X.half = 1;
    } else {
      var N = F.nb(T, X.outs);
      X.half = 0; X.tile = N.i; X.ins = opp(X.outs);
      X.outs = routeOnEnter(sim, X, N);
    }
    CV.laneAdd(sim, X);
  }

  function spawn(sim, si) {
    var S = sim.F.sources[si], st = sim.src[si];
    var T = sim.F.tiles[S.tile];
    var it = {
      id: sim.nextId++, cat: S.seq[st.idx], src: si,
      tile: S.tile, half: 1, ins: -1, outs: T.out, p: 0,
      adv: 0, stall: 0, born: sim.tick, dead: false
    };
    sim.items.push(it);
    CV.laneAdd(sim, it);
    st.idx++;
    sim.events.push({ type: 'spawn', tile: S.tile, cat: it.cat });
  }

  function step(sim) {
    if (sim.status !== 'running') return;
    var F = sim.F, i;
    sim.tick++;

    // 0) Bloqueadores reabrem sozinhos
    for (i = 0; i < F.devices.length; i++) {
      if (F.devices[i].type === 'gate' && sim.dev[i] > 0 && sim.tick >= sim.dev[i]) {
        sim.dev[i] = 0;
        sim.gateOpened[i] = sim.tick;
        sim.events.push({ type: 'gateOpen', dev: i, tile: F.devices[i].tile });
      }
    }

    // 1) Fontes
    for (i = 0; i < F.sources.length; i++) {
      var S = F.sources[i], st = sim.src[i];
      st.blocked = false;
      // a fonte produz no seu ritmo para o depósito, esteja a esteira livre ou não
      if (st.made < S.seq.length) {
        st.timer++;
        if (st.timer >= S.interval) {
          if (st.made - st.idx >= C.HOPPER_MAX) { fail(sim, 'overload', { tile: S.tile, src: i, jamTile: jamOrigin(sim) }); return; }
          st.made++;
          st.timer = 0;
          if (st.made - st.idx === C.HOPPER_WARN) sim.events.push({ type: 'warn', tile: S.tile });
        }
      }
      // o depósito solta um objeto quando a saída tem espaço
      if (st.made > st.idx) {
        var Y = CV.laneLast(sim, CV.laneKey(S.tile, 1, F.tiles[S.tile].out));
        if (!Y || Y.p >= C.GAP) { spawn(sim, i); sim.lastMove = sim.tick; }
        else st.blocked = true;
      }
      st.pressure = st.made - st.idx;
      if (st.pressure > sim.peakPressure) sim.peakPressure = st.pressure;
    }

    // 2) Objetos, em ordem de criação (determinístico)
    var anyMoved = false, anyDead = false, jammed = false;
    for (i = 0; i < sim.items.length; i++) {
      var X = sim.items[i];
      if (X.dead) continue;
      var adv = CV.clearance(sim, X);
      X.adv = adv;
      if (adv > 0) { moveItem(sim, X, adv); anyMoved = true; X.stall = 0; }
      else { X.stall++; if (X.stall >= C.STALL_TICKS) jammed = true; }
      if (X.dead) anyDead = true;
      if (sim.status === 'failed') break;
    }
    if (anyDead) sim.items = sim.items.filter(function (x) { return !x.dead; });
    if (sim.status === 'failed') return;
    if (anyMoved || anyDead) sim.lastMove = sim.tick;
    if (jammed) sim.jamTicks++;

    // 3) Fim de fase
    var allEmitted = true;
    for (i = 0; i < F.sources.length; i++) if (sim.src[i].idx < F.sources[i].seq.length) allEmitted = false;
    if (allEmitted && sim.items.length === 0) {
      sim.status = 'won';
      sim.events.push({ type: 'win' });
      return;
    }
    // Se alguma fonte ainda vai produzir, a sobrecarga cuida do caso; senão, parado = travado.
    var stillProducing = false;
    for (i = 0; i < F.sources.length; i++) if (sim.src[i].made < F.sources[i].seq.length) stillProducing = true;
    if (!stillProducing && sim.items.length && sim.tick - sim.lastMove > C.GRIDLOCK_TICKS) {
      fail(sim, 'gridlock', { tile: jamOrigin(sim), jamTile: jamOrigin(sim) });
      return;
    }
    if (sim.tick > C.MAX_TICKS) fail(sim, 'timeout', {});
  }

  // Origem provável de um congestionamento: o objeto parado mais antigo
  // (é o que está na frente da fila).
  function jamOrigin(sim) {
    var best = null;
    for (var i = 0; i < sim.items.length; i++) {
      var it = sim.items[i];
      if (it.stall >= C.STALL_TICKS && (!best || it.id < best.id)) best = it;
    }
    return best ? best.tile : -1;
  }

  // Avaliação: até 3 estrelas
  function evaluate(sim) {
    var L = sim.level;
    var par = L.par !== undefined ? L.par : 0;
    var c1 = sim.status === 'won';
    var c2 = c1 && sim.peakPressure < C.HOPPER_WARN;
    var c3 = c1 && sim.taps <= par;
    return {
      stars: c1 ? 1 + (c2 ? 1 : 0) + (c3 ? 1 : 0) : 0,
      criteria: [
        { ok: c1, label: 'Todos os objetos entregues' },
        { ok: c2, label: 'Sem sobrecarga nas linhas' },
        { ok: c3, label: 'Intervenções: ' + sim.taps + ' (meta ' + par + ')' }
      ],
      taps: sim.taps, par: par, seconds: sim.tick / C.TICK_RATE
    };
  }

  // Cópia profunda do estado mutável (usada pelo validador)
  function clone(sim) {
    var c = Object.assign({}, sim);
    c.items = sim.items.map(function (x) { return Object.assign({}, x); });
    c.dev = sim.dev.slice();
    c.src = sim.src.map(function (s) { return Object.assign({}, s); });
    c.binCount = sim.binCount.slice();
    c.gateOpened = sim.gateOpened.slice();
    c.events = [];
    c.fail = sim.fail ? Object.assign({}, sim.fail) : null;
    CV.rebuildLanes(c);
    return c;
  }

  // Ocupação de um bloco (0..2+) para indicadores visuais
  function tileLoad(sim, tileIndex) {
    var n = 0;
    for (var s = 0; s < 4; s++) {
      var a = sim.lanes.get(CV.laneKey(tileIndex, 0, s)); if (a) n += a.length;
      a = sim.lanes.get(CV.laneKey(tileIndex, 1, s)); if (a) n += a.length;
    }
    return n;
  }

  FF.Sim = {
    create: create, start: start, setPaused: setPaused, toggle: toggle,
    step: step, evaluate: evaluate, jamOrigin: jamOrigin, clone: clone, tileLoad: tileLoad, fail: fail
  };
})(globalThis.FF = globalThis.FF || {});
