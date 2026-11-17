/* FLOW FACTORY — storage.js
 * Progresso e configurações em localStorage (com tolerância a falhas:
 * se o armazenamento não estiver disponível, o jogo segue em memória).
 */
(function (FF) {
  'use strict';
  var KEY = 'flowfactory.save.v1';
  var data = null;

  function defaults() {
    return { version: 1, levels: {}, settings: { music: true, sfx: true, vibration: true }, extra: { endlessBest: 0, dailyCount: 0, daily: {} } };
  }

  function load() {
    data = defaults();
    try {
      var raw = globalThis.localStorage && localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) {
          data.levels = parsed.levels || {};
          data.extra = Object.assign(data.extra, parsed.extra || {});
          Object.assign(data.settings, parsed.settings || {});
        }
      }
    } catch (e) { /* armazenamento indisponível */ }
    return data;
  }

  function save() {
    try { if (globalThis.localStorage) localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }

  function get() { return data || load(); }

  function levelResult(id) { return get().levels[id] || null; }

  // Guarda o melhor resultado. Retorna true se for um recorde novo.
  function recordWin(id, stars, taps, seconds) {
    var cur = levelResult(id);
    var better = !cur || stars > cur.stars;
    get().levels[id] = {
      done: true,
      stars: Math.max(stars, cur ? cur.stars : 0),
      bestTaps: cur && cur.bestTaps !== undefined ? Math.min(cur.bestTaps, taps) : taps,
      bestTime: cur && cur.bestTime ? Math.min(cur.bestTime, seconds) : seconds
    };
    save();
    return better;
  }

  // Mescla um resultado vindo de um código de transferência (fica o melhor).
  function mergeResult(id, stars) {
    var cur = levelResult(id);
    if (cur && cur.done && cur.stars >= stars) return false;
    get().levels[id] = Object.assign({}, cur || {}, { done: true, stars: Math.max(stars, cur ? cur.stars || 0 : 0) });
    return true;
  }

  function extra() { return get().extra; }

  function isUnlocked(id) {
    var i = FF.levelIndex(id);
    if (i <= 0) return i === 0;
    var prev = levelResult(FF.LEVELS[i - 1].id);
    return !!(prev && prev.done);
  }

  function totals() {
    var stars = 0, done = 0;
    FF.LEVELS.forEach(function (L) {
      var r = levelResult(L.id);
      if (r && r.done) { done++; stars += r.stars; }
    });
    return { stars: stars, maxStars: FF.LEVELS.length * 3, done: done, total: FF.LEVELS.length };
  }

  // Próxima fase recomendada: a primeira desbloqueada e não concluída.
  function nextLevelId() {
    for (var i = 0; i < FF.LEVELS.length; i++) {
      var L = FF.LEVELS[i];
      var r = levelResult(L.id);
      if (!(r && r.done) && isUnlocked(L.id)) return L.id;
    }
    return null;
  }

  function setting(name, value) {
    if (value === undefined) return get().settings[name];
    get().settings[name] = value;
    save();
    return value;
  }

  function reset() {
    var s = get().settings;
    data = defaults();
    data.settings = s;
    save();
  }

  // Desafio diário: guarda as estrelas por data e conta quantos dias foram concluídos.
  function recordDaily(dateKey, stars) {
    var x = extra(), prev = x.daily[dateKey] || 0;
    if (!prev) x.dailyCount = (x.dailyCount || 0) + 1;
    x.daily[dateKey] = Math.max(prev, stars);
    save();
  }
  function recordEndless(score) {
    var x = extra(), rec = score > (x.endlessBest || 0);
    if (rec) { x.endlessBest = score; save(); }
    return rec;
  }

  FF.Storage = {
    load: load, save: save, levelResult: levelResult, recordWin: recordWin, isUnlocked: isUnlocked,
    mergeResult: mergeResult, extra: extra, recordDaily: recordDaily, recordEndless: recordEndless,
    totals: totals, nextLevelId: nextLevelId, setting: setting, reset: reset, KEY: KEY
  };

  /* ---------- Vibração (via native.js: Haptics no app, navigator.vibrate no navegador) ---------- */
  var PATTERNS = { tap: 25, warn: [40, 70, 40], fail: [90, 60, 140], win: [30, 50, 30, 50, 70] };
  function supported() { return !!(FF.Native && FF.Native.vibrationSupported()); }
  function buzz(kind) {
    if (!setting('vibration') || !supported()) return;
    FF.Native.vibrate(PATTERNS[kind] || 25);
  }
  FF.Haptics = { supported: supported, buzz: buzz };
})(globalThis.FF = globalThis.FF || {});
