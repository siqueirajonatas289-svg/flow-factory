/* FLOW FACTORY — transfer.js
 * Código de transferência de progresso: funciona offline e sem conta.
 *
 * Conteúdo (bytes): versão | identificador do jogador (2) | nº de fases | estrelas (2 bits por fase, na ordem da campanha)
 *                   | recorde do modo infinito (16 bits) | desafios diários concluídos (16 bits) | CRC-16
 * Texto: Base32 Crockford (sem I, L, O, U: não confunde 0/O nem 1/I), em grupos: FF-XXXX-XXXX-...
 * Colar mescla com o progresso atual (fica sempre o melhor de cada fase): nunca apaga nada.
 */
(function (FF) {
  'use strict';
  var ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  var VERSION = 1;

  function crc16(bytes) {
    var crc = 0xffff;
    for (var i = 0; i < bytes.length; i++) {
      crc ^= bytes[i] << 8;
      for (var b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc;
  }

  function toBase32(bytes) {
    var out = '', buf = 0, bits = 0;
    for (var i = 0; i < bytes.length; i++) {
      buf = (buf << 8) | bytes[i]; bits += 8;
      while (bits >= 5) { out += ALPHA[(buf >>> (bits - 5)) & 31]; bits -= 5; }
      buf &= (1 << bits) - 1;
    }
    if (bits > 0) out += ALPHA[(buf << (5 - bits)) & 31];
    return out;
  }

  function fromBase32(text) {
    var bytes = [], buf = 0, bits = 0;
    for (var i = 0; i < text.length; i++) {
      var v = ALPHA.indexOf(text[i]);
      if (v < 0) return null;
      buf = (buf << 5) | v; bits += 5;
      if (bits >= 8) { bytes.push((buf >>> (bits - 8)) & 255); bits -= 8; buf &= (1 << bits) - 1; }
    }
    return bytes;
  }

  // Embaralha os bytes com um fluxo derivado do identificador do jogador:
  // cada pessoa tem um código com cara própria (não é criptografia, só evita códigos "iguais").
  function scramble(bytes, salt) {
    var x = (salt * 2654435761) >>> 0 || 1;
    return bytes.map(function (b) { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return b ^ (x & 255); });
  }

  function snapshot() {
    var levels = FF.LEVELS.map(function (L) {
      var r = FF.Storage.levelResult(L.id);
      return r && r.done ? Math.max(1, Math.min(3, r.stars)) : 0;
    });
    var x = FF.Storage.extra();
    if (!x.playerId) { x.playerId = 1 + Math.floor(Math.random() * 65534); FF.Storage.save(); }
    return { levels: levels, endlessBest: x.endlessBest || 0, dailyCount: x.dailyCount || 0, playerId: x.playerId };
  }

  function encode(snap) {
    snap = snap || snapshot();
    var n = snap.levels.length, pid = (snap.playerId || 1) & 0xffff, bytes = [n & 255];
    for (var i = 0; i < n; i += 4) {
      var b = 0;
      for (var k = 0; k < 4; k++) b |= ((snap.levels[i + k] || 0) & 3) << (6 - 2 * k);
      bytes.push(b);
    }
    var eb = Math.min(65535, snap.endlessBest | 0), dc = Math.min(65535, snap.dailyCount | 0);
    bytes.push(eb >> 8, eb & 255, dc >> 8, dc & 255);
    var c = crc16([VERSION, pid >> 8, pid & 255].concat(bytes));
    bytes.push(c >> 8, c & 255);
    var body = toBase32([VERSION, pid >> 8, pid & 255].concat(scramble(bytes, pid)));
    return 'FF-' + body.match(/.{1,4}/g).join('-');
  }

  // Normaliza o que a pessoa colou: maiúsculas, sem espaços/traços, troca O→0 e I/L→1.
  function clean(text) {
    var t = String(text || '').toUpperCase().replace(/\s+/g, '');
    t = t.replace(/^FF-?/, '').replace(/[-_.]/g, '');
    return t.replace(/O/g, '0').replace(/[IL]/g, '1');
  }

  function decode(text) {
    var t = clean(text);
    if (t.length < 8) return { ok: false, error: 'Código muito curto. Confira se copiou ele inteiro.' };
    var raw = fromBase32(t);
    if (!raw) return { ok: false, error: 'O código tem caracteres inválidos.' };
    if (raw[0] !== VERSION || raw.length < 4) return { ok: false, error: 'Este código não é do FLOW FACTORY ou é de outra versão.' };
    var pid = (raw[1] << 8) | raw[2];
    var bytes = scramble(raw.slice(3), pid);
    var n = bytes[0], lb = Math.ceil(n / 4), need = 1 + lb + 4 + 2;
    if (bytes.length < need) return { ok: false, error: 'Código incompleto. Confira se copiou ele inteiro.' };
    var crc = (bytes[need - 2] << 8) | bytes[need - 1];
    if (crc16([VERSION, raw[1], raw[2]].concat(bytes.slice(0, need - 2))) !== crc) return { ok: false, error: 'Código com erro de digitação. Copie de novo o código original.' };
    var levels = [];
    for (var i = 0; i < n; i++) levels.push((bytes[1 + (i >> 2)] >> (6 - 2 * (i & 3))) & 3);
    var o = 1 + lb;
    return {
      ok: true, playerId: pid,
      levels: levels,
      endlessBest: (bytes[o] << 8) | bytes[o + 1],
      dailyCount: (bytes[o + 2] << 8) | bytes[o + 3]
    };
  }

  // Aplica um código decodificado: mescla, ficando com o melhor de cada fase.
  function apply(d) {
    var gained = 0, stars = 0, done = 0;
    d.levels.forEach(function (st, i) {
      var L = FF.LEVELS[i];
      if (!L || !st) return;
      var cur = FF.Storage.levelResult(L.id);
      if (!cur || !cur.done || cur.stars < st) gained++;
      FF.Storage.mergeResult(L.id, st);
    });
    FF.LEVELS.forEach(function (L) { var r = FF.Storage.levelResult(L.id); if (r && r.done) { done++; stars += r.stars; } });
    var x = FF.Storage.extra();
    x.endlessBest = Math.max(x.endlessBest || 0, d.endlessBest);
    x.dailyCount = Math.max(x.dailyCount || 0, d.dailyCount);
    if (d.playerId) x.playerId = d.playerId; // o jogador continua sendo "ele" no aparelho novo
    FF.Storage.save();
    return { improved: gained, done: done, stars: stars };
  }

  FF.Transfer = { encode: encode, decode: decode, apply: apply, snapshot: snapshot, _crc16: crc16 };
})(globalThis.FF = globalThis.FF || {});
