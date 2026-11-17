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
  function route(t, ins, devState) {
    switch (t.type) {
      case 'conveyor': return t.out;
      case 'crossing': return opp(ins);
      case 'bin': return FF.SINK;
      case 'diverter': case 'distributor': return t.outs[devState[t.dev]];
      default: return t.out;
    }
  }

  // Desviador e distribuidor escolhem a saída no instante em que o objeto entra.
  function isSwitch(t) { return !!t && (t.type === 'diverter' || t.type === 'distributor'); }

  // Saída conhecida antes de o objeto entrar (UNKNOWN para desviadores).
  function knownExit(t, ins) {
    switch (t.type) {
      case 'conveyor': return t.out;
      case 'crossing': return opp(ins);
      case 'bin': return FF.SINK;
      case 'diverter': case 'distributor': return FF.UNKNOWN;
      default: return t.out;
    }
  }

  function isInteractive(t) { return !!t && t.dev >= 0; }

  FF.Routing = { route: route, knownExit: knownExit, isInteractive: isInteractive, isSwitch: isSwitch };
})(globalThis.FF = globalThis.FF || {});
