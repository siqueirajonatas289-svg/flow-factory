/* FLOW FACTORY — factory.js
 * Converte a definição de uma fase (mapa ASCII + legenda) na estrutura
 * imutável da fábrica: blocos, fontes, recipientes, dispositivos,
 * conexões possíveis e geometria dos trajetos.
 *
 * Mapa:  '.' vazio | '^ > v <' esteira (direção de saída) | '+' cruzamento
 *        qualquer outro caractere precisa estar na legenda da fase.
 */
(function (FF) {
  'use strict';
  var C = FF.CONFIG, DX = FF.DX, DY = FF.DY, opp = FF.opp;
  var ARROWS = { '^': 0, '>': 1, 'v': 2, '<': 3 };

  function dirOf(v) {
    if (typeof v === 'number') return v;
    var d = FF.DIR_BY_NAME[v];
    if (d === undefined) throw new Error('Direção inválida: ' + v);
    return d;
  }

  function buildFactory(def) {
    var rows = def.map;
    var h = rows.length;
    var w = 0;
    for (var r = 0; r < h; r++) w = Math.max(w, rows[r].length);
    var tiles = new Array(w * h).fill(null);
    var sources = [], bins = [], devices = [], errors = [];

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var ch = rows[y][x] || '.';
        if (ch === '.' || ch === ' ') continue;
        var spec;
        if (ARROWS[ch] !== undefined) spec = { type: 'conveyor', out: ARROWS[ch] };
        else if (ch === '+') spec = { type: 'crossing' };
        else if (def.legend && def.legend[ch]) spec = def.legend[ch];
        else { errors.push('Caractere desconhecido "' + ch + '" em (' + x + ',' + y + ')'); continue; }

        var t = {
          i: y * w + x, x: x, y: y, ch: ch, type: spec.type,
          out: -1, outs: null, cat: null,
          speed: spec.speed || C.BASE_SPEED,
          accepts: [false, false, false, false],
          feeders: [false, false, false, false],
          exits: [], dev: -1, src: -1, bin: -1
        };
        switch (spec.type) {
          case 'conveyor':
            t.out = dirOf(spec.out); break;
          case 'slow':
            t.type = 'conveyor'; t.out = dirOf(spec.out); t.speed = C.SLOW_SPEED; t.slow = true; break;
          case 'gate':
            t.out = dirOf(spec.out);
            t.dev = devices.length;
            devices.push({ tile: t.i, type: 'gate', init: spec.closed ? 1 : 0 });
            break;
          case 'distributor':
            t.outs = spec.outs.map(dirOf);
            t.dev = devices.length;
            devices.push({ tile: t.i, type: 'distributor', init: spec.state || 0 });
            if (t.outs.length < 2 || t.outs.length > 3) errors.push('Distribuidor precisa de 2 ou 3 saídas');
            break;
          case 'source':
            t.out = dirOf(spec.out);
            t.src = sources.length;
            sources.push({
              tile: t.i,
              seq: String(spec.seq).replace(/\s+/g, '').split(''),
              interval: spec.interval || C.DEFAULT_INTERVAL,
              delay: spec.delay !== undefined ? spec.delay : C.FIRST_DELAY,
              label: spec.label || String.fromCharCode(65 + t.src)
            });
            break;
          case 'bin':
            t.cat = spec.cat; t.bin = bins.length;
            bins.push({ tile: t.i, cat: spec.cat });
            if (!FF.CATS[spec.cat]) errors.push('Categoria inválida no recipiente: ' + spec.cat);
            break;
          case 'diverter':
            t.outs = spec.outs.map(dirOf);
            t.dev = devices.length;
            devices.push({ tile: t.i, type: 'diverter', init: spec.state || 0 });
            break;
          case 'crossing':
            break;
          default:
            errors.push('Tipo desconhecido: ' + spec.type);
        }
        tiles[t.i] = t;
      }
    }

    function nb(t, s) {
      var nx = t.x + DX[s], ny = t.y + DY[s];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return null;
      return tiles[ny * w + nx];
    }

    // Quais lados aceitam entrada
    tiles.forEach(function (t) {
      if (!t) return;
      for (var s = 0; s < 4; s++) {
        switch (t.type) {
          case 'conveyor': case 'gate': t.accepts[s] = s !== t.out; break;
          case 'diverter': case 'distributor': t.accepts[s] = t.outs.indexOf(s) < 0; break;
          case 'crossing': t.accepts[s] = true; break;
          case 'bin': t.accepts[s] = true; break;
          default: t.accepts[s] = false;
        }
      }
    });

    // Saídas possíveis (cruzamentos dependem de quem os alimenta: ponto fixo)
    tiles.forEach(function (t) {
      if (!t) return;
      if (t.type === 'conveyor' || t.type === 'source' || t.type === 'gate') t.exits = [t.out];
      else if (t.type === 'diverter' || t.type === 'distributor') t.exits = t.outs.slice();
      else t.exits = [];
    });
    var changed = true, guard = 0;
    while (changed && guard++ < 64) {
      changed = false;
      tiles.forEach(function (t) {
        if (!t || t.type !== 'crossing') return;
        var ex = [];
        for (var s = 0; s < 4; s++) {
          var src = nb(t, opp(s)); // vizinho do lado oposto empurra na direção s
          if (src && src.exits.indexOf(s) >= 0) ex.push(s);
        }
        if (ex.join() !== t.exits.join()) { t.exits = ex; changed = true; }
      });
    }

    // Alimentadores reais de cada lado
    tiles.forEach(function (t) {
      if (!t) return;
      for (var s = 0; s < 4; s++) {
        var n = nb(t, s);
        t.feeders[s] = !!(n && t.accepts[s] && n.exits.indexOf(opp(s)) >= 0);
      }
    });

    return {
      w: w, h: h, tiles: tiles, sources: sources, bins: bins,
      devices: devices, errors: errors, nb: nb, def: def
    };
  }

  /* ---------- Geometria (em unidades de bloco; centro do bloco = x+0.5) ---------- */

  // Ponto num trajeto que entra pelo lado `ins` e sai pelo lado `outs`.
  // t ∈ [0,1]: 0 = borda de entrada, 0.5 = centro, 1 = borda de saída.
  // ins < 0: começa no centro (fonte). outs < 0: termina no centro (recipiente).
  function pathPoint(tx, ty, ins, outs, t, out) {
    var cx = tx + 0.5, cy = ty + 0.5;
    out = out || {};
    if (ins < 0) {
      var k = t - 0.5;
      out.x = cx + DX[outs] * k; out.y = cy + DY[outs] * k;
      out.a = Math.atan2(DY[outs], DX[outs]);
      return out;
    }
    if (outs < 0) {
      var k2 = 0.5 - t;
      out.x = cx + DX[ins] * k2; out.y = cy + DY[ins] * k2;
      out.a = Math.atan2(-DY[ins], -DX[ins]);
      return out;
    }
    if (outs === opp(ins)) {
      var k3 = 0.5 - t;
      out.x = cx + DX[ins] * k3; out.y = cy + DY[ins] * k3;
      out.a = Math.atan2(DY[outs], DX[outs]);
      return out;
    }
    // curva: quarto de círculo de raio 0.5 em torno do canto comum
    var kx = cx + (DX[ins] + DX[outs]) * 0.5, ky = cy + (DY[ins] + DY[outs]) * 0.5;
    var a0 = Math.atan2(-DY[outs], -DX[outs]);
    var a1 = Math.atan2(-DY[ins], -DX[ins]);
    var da = a1 - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    var a = a0 + da * t;
    out.x = kx + Math.cos(a) * 0.5; out.y = ky + Math.sin(a) * 0.5;
    out.a = a + (da > 0 ? Math.PI / 2 : -Math.PI / 2);
    return out;
  }

  function itemT(it) { return (it.half * C.HALF + it.p) / (2 * C.HALF); }

  function itemPos(F, it, out) {
    var t = F.tiles[it.tile];
    var ins = it.ins, outs = it.outs;
    return pathPoint(t.x, t.y, ins, outs, itemT(it), out);
  }

  FF.buildFactory = buildFactory;
  FF.Geo = { pathPoint: pathPoint, itemPos: itemPos, itemT: itemT };
})(globalThis.FF = globalThis.FF || {});
