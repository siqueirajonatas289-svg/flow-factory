/* FLOW FACTORY — conveyor.js
 * Movimento nas esteiras: faixas, espaçamento e capacidade.
 *
 * Modelo: cada bloco tem meias-faixas de ENTRADA (borda -> centro) e de
 * SAÍDA (centro -> borda), cada uma com 50 unidades. Um objeto está
 * sempre numa meia-faixa com progresso p ∈ [0,50).
 *
 * Regras de espaço (garantem que objetos nunca se sobreponham):
 *  1. Na mesma faixa, distância mínima GAP (capacidade = 2 objetos por bloco).
 *  2. Nos nós (centro de um bloco) funciona um "zíper": quem está mais perto
 *     do centro passa primeiro; empate = objeto mais antigo (id menor).
 *  3. Um objeto que vai cruzar a faixa de outro mantém NODE_GAP.
 *  4. Saída sem conexão = parede: o objeto para antes da borda.
 */
(function (FF) {
  'use strict';
  var C = FF.CONFIG, opp = FF.opp, SINK = FF.SINK, UNKNOWN = FF.UNKNOWN;
  var HALF = C.HALF;

  function laneKey(tile, half, side) { return tile * 8 + half * 4 + side; }
  function itemLane(it) { return laneKey(it.tile, it.half, it.half === 0 ? it.ins : it.outs); }

  function laneAdd(sim, it) {
    var k = itemLane(it);
    var a = sim.lanes.get(k);
    if (!a) { a = []; sim.lanes.set(k, a); }
    var i = a.length;
    while (i > 0 && a[i - 1].p < it.p) i--;
    a.splice(i, 0, it);
  }

  function laneRemove(sim, it) {
    var a = sim.lanes.get(itemLane(it));
    if (!a) return;
    var i = a.indexOf(it);
    if (i >= 0) a.splice(i, 1);
  }

  // Último objeto (menor progresso) de uma faixa.
  function laneLast(sim, key) {
    var a = sim.lanes.get(key);
    return a && a.length ? a[a.length - 1] : null;
  }

  function rebuildLanes(sim) {
    sim.lanes = new Map();
    for (var i = 0; i < sim.items.length; i++) if (!sim.items[i].dead) laneAdd(sim, sim.items[i]);
  }

  // Limite de avanço imposto pelo nó central do bloco T a um objeto X que
  // está a dX unidades do centro, entrando pelo lado xEntry e saindo por xExit.
  function nodeLimit(sim, X, T, dX, xEntry, xExit) {
    var F = sim.F, lim = Infinity, s, a, j, Y, d, l;
    var bridge = T.type === 'bridge';
    // Recipiente fechado: a fila espera na linha de parada
    if (T.type === 'bin' && dX >= C.BIN_STOP && FF.Routing.binClosed(sim, T)) lim = dX - C.BIN_STOP;
    // Concorrentes que chegam por outros lados (zíper)
    for (s = 0; s < 4; s++) {
      if (s === xEntry || !T.accepts[s]) continue;
      if (bridge && (s & 1) !== (xEntry & 1)) continue;         // ponte: o outro eixo passa por cima
      if (T.type === 'rev' && s === T.dirs[sim.dev[T.dev]]) continue; // ponta fechada da reversível
      a = sim.lanes.get(laneKey(T.i, 0, s));
      if (a) {
        for (j = 0; j < a.length; j++) {
          Y = a[j]; d = HALF - Y.p;
          if (d < dX || (d === dX && Y.id < X.id)) { l = dX - d - C.GAP; if (l < lim) lim = l; }
        }
      }
      var M = F.nb(T, s);
      if (M) {
        a = sim.lanes.get(laneKey(M.i, 1, opp(s)));
        if (a) {
          for (j = 0; j < a.length; j++) {
            Y = a[j]; d = 2 * HALF - Y.p;
            if (d < dX || (d === dX && Y.id < X.id)) { l = dX - d - C.GAP; if (l < lim) lim = l; }
          }
        }
      }
    }
    // Objetos que acabaram de sair do centro
    for (j = 0; j < T.exits.length; j++) {
      var e = T.exits[j];
      if (bridge && (e & 1) !== (xEntry & 1)) continue;
      Y = laneLast(sim, laneKey(T.i, 1, e));
      if (!Y) continue;
      var gap = (xExit === UNKNOWN || xExit === e) ? C.GAP : C.NODE_GAP;
      l = dX + Y.p - gap;
      if (l < lim) lim = l;
    }
    return lim;
  }

  // Quanto o objeto X pode avançar neste tick.
  function clearance(sim, X) {
    var F = sim.F, T = F.tiles[X.tile];
    var lim = T.speed, N, ent, Y;
    var a = sim.lanes.get(itemLane(X));
    var k = a.indexOf(X);
    if (k > 0) lim = Math.min(lim, a[k - 1].p - X.p - C.GAP);

    if (X.half === 0) {
      var dC = HALF - X.p;
      lim = Math.min(lim, nodeLimit(sim, X, T, dC, X.ins, X.outs));
      if (T.type === 'gate' && dC >= C.GATE_STOP) {
        // Bloqueador fechado: para na linha. Quem já passou da linha segue.
        if (sim.dev[T.dev] > 0) lim = Math.min(lim, dC - C.GATE_STOP);
        else if (sim.gateDecide && dC - lim < C.GATE_STOP && sim.gateDecide(sim, X, T)) lim = Math.min(lim, dC - C.GATE_STOP);
      }
      if (X.outs !== SINK) {
        N = F.nb(T, X.outs); ent = opp(X.outs);
        if (!FF.Routing.canEnter(sim, N, ent)) lim = Math.min(lim, dC + HALF - C.EDGE_STOP);
        else {
          Y = laneLast(sim, laneKey(N.i, 0, ent));
          if (Y) lim = Math.min(lim, dC + HALF + Y.p - C.GAP);
        }
      }
    } else {
      var dE = HALF - X.p;
      N = F.nb(T, X.outs); ent = opp(X.outs);
      if (!FF.Routing.canEnter(sim, N, ent)) lim = Math.min(lim, dE - C.EDGE_STOP);
      else {
        Y = laneLast(sim, laneKey(N.i, 0, ent));
        if (Y) lim = Math.min(lim, dE + Y.p - C.GAP);
        lim = Math.min(lim, nodeLimit(sim, X, N, dE + HALF, ent, FF.Routing.knownExit(N, ent)));
      }
    }
    return lim > 0 ? lim : 0;
  }

  FF.Conveyor = {
    laneKey: laneKey, itemLane: itemLane, laneAdd: laneAdd, laneRemove: laneRemove,
    laneLast: laneLast, rebuildLanes: rebuildLanes, clearance: clearance
  };
})(globalThis.FF = globalThis.FF || {});
