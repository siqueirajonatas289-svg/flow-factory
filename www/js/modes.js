/* FLOW FACTORY — modes.js
 * Modos extras: Desafio do dia (uma fase verificada, sorteada pela data) e Modo infinito.
 * Tudo offline: o sorteio usa só a data local do aparelho.
 */
(function (FF) {
  'use strict';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function hash(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }

  // Fases que entram no sorteio: do capítulo 3 em diante (as primeiras são tutoriais).
  function dailyPool() { return FF.LEVELS.filter(function (L) { return L.chapter >= 3; }); }

  function dailyLevel(key) {
    key = key || todayKey();
    var pool = dailyPool();
    var L = pool[hash('flow-factory:' + key) % pool.length];
    // cópia com identidade própria: não mexe no progresso da campanha
    var D = JSON.parse(JSON.stringify(L));
    D.baseId = L.id;
    D.id = 'DIA';
    D.name = 'Desafio do dia';
    D.tutorial = null;
    D.mode = 'daily';
    D.dateKey = key;
    D.subtitle = 'Fase ' + L.id + ' · ' + L.name;
    return D;
  }

  // Modo infinito: uma linha sem fim, o ritmo acelera até a fábrica não dar conta.
  var ENDLESS = {
    id: 'INF', chapter: 0, name: 'Modo infinito', mode: 'endless', par: 0, seed: 20261117,
    map: ['...A...', '...v...', '.v<d>v.', '.v...v.', '.v...v.', 'vev.vfv', '1.2.3.4'],
    legend: {
      A: { type: 'source', out: 'S', endless: { start: 115, step: 2, min: 34, cats: 'RBYG' }, delay: 30 },
      d: { type: 'diverter', outs: ['W', 'E'] },
      e: { type: 'diverter', outs: ['W', 'E'] },
      f: { type: 'diverter', outs: ['W', 'E'] },
      1: { type: 'bin', cat: 'R' }, 2: { type: 'bin', cat: 'B' }, 3: { type: 'bin', cat: 'Y' }, 4: { type: 'bin', cat: 'G' }
    }
  };

  function endlessLevel() {
    var L = JSON.parse(JSON.stringify(ENDLESS));
    // cada partida tem uma ordem de cores diferente
    L.seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0 || 1;
    return L;
  }

  function dailyStatus() {
    var key = todayKey(), x = FF.Storage.extra();
    return { key: key, stars: (x.daily && x.daily[key]) || 0, count: x.dailyCount || 0, level: dailyLevel(key) };
  }

  FF.Modes = { todayKey: todayKey, dailyLevel: dailyLevel, dailyPool: dailyPool, dailyStatus: dailyStatus, endlessLevel: endlessLevel, ENDLESS: ENDLESS };
})(globalThis.FF = globalThis.FF || {});
