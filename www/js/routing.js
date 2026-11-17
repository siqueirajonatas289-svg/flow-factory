/* FLOW FACTORY — routing.js
 * Regras de roteamento de cada tipo de bloco.
 *
 * Regra do desviador: a rota é TRAVADA no instante em que o objeto
 * entra no bloco do desviador. Tocar no desviador muda a rota de todos
 * os objetos que ainda não entraram nele.
 * Cruzamento: o objeto sempre segue reto.
 */
(function (FF) {
  'use strict';
  var opp = FF.opp;

  // Saída escolhida para um objeto que entra em `t` pelo lado `ins`.
  function route(t, ins, devState, cat) {
    switch (t.type) {
      case 'conveyor': case 'paint': return t.out;
      case 'crossing': case 'bridge': return opp(ins);
      case 'filter': return filterExit(t, t.dev >= 0 ? devState[t.dev] : 0, cat);
      case 'rev': return t.dirs[devState[t.dev]];
      case 'bin': return FF.SINK;
      case 'diverter': case 'distributor': return t.outs[devState[t.dev]];
      default: return t.out;
    }
  }

  // Desviador e distribuidor escolhem a saída no instante em que o objeto entra.
  function isSwitch(t) { return !!t && (t.type === 'diverter' || t.type === 'distributor' || (t.type === 'filter' && t.dev >= 0)); }
  function nStates(t) { return t.type === 'filter' ? t.colors.length : t.type === 'rev' ? 2 : t.outs.length; }

  // Pode entrar em `t` pelo lado `ent` agora? (a ponta de saída da reversível é fechada)
  function canEnter(sim, t, ent) {
    if (!t || !t.accepts[ent]) return false;
    if (t.type === 'rev' && ent === t.dirs[sim.dev[t.dev]]) return false;
    return true;
  }

  // Recipiente fechado: cheio (capacidade) ou prensando (tempo de recarga)
  function binClosed(sim, t) {
    if (t.type !== 'bin') return false;
    if (t.cap && sim.binCount[t.bin] >= t.cap) return true;
    if (t.press && sim.tick < sim.binBusy[t.bin]) return true;
    return false;
  }

  // Saída conhecida antes de o objeto entrar (UNKNOWN para desviadores).
  // Filtro: a cor escolhida sai pela 1ª saída; todo o resto pela 2ª.
  function filterExit(t, state, cat) { return cat === t.colors[state] ? t.outs[0] : t.outs[1]; }

  function knownExit(t, ins) {
    switch (t.type) {
      case 'conveyor': case 'paint': return t.out;
      case 'crossing': case 'bridge': return opp(ins);
      case 'filter': case 'rev': return FF.UNKNOWN;
      case 'bin': return FF.SINK;
      case 'diverter': case 'distributor': return FF.UNKNOWN;
      default: return t.out;
    }
  }

  function isInteractive(t) { return !!t && t.dev >= 0; }

  FF.Routing = {
    route: route, knownExit: knownExit, isInteractive: isInteractive, isSwitch: isSwitch,
    nStates: nStates, filterExit: filterExit, canEnter: canEnter, binClosed: binClosed
  };
})(globalThis.FF = globalThis.FF || {});
