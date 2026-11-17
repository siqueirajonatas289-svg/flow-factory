/* FLOW FACTORY — renderer.js
 * Desenho procedural em Canvas 2D. Não altera a simulação: apenas lê.
 * Camadas: chão -> trilhos -> esteiras -> divisas animadas -> placas de
 * dispositivos -> objetos -> máquinas/recipientes -> efeitos.
 */
(function (FF) {
  'use strict';
  var C = FF.CONFIG, P = FF.PALETTE, opp = FF.opp;
  var TAU = Math.PI * 2;
  var CHEV = 0.25; // espaçamento das divisas, em blocos

  /* ---------- Formas dos objetos (compartilhado com a UI) ---------- */
  function shapePath(ctx, shape, x, y, s) {
    ctx.beginPath();
    switch (shape) {
      case 'circle': ctx.arc(x, y, s * 0.5, 0, TAU); break;
      case 'square': roundRect(ctx, x - s * 0.43, y - s * 0.43, s * 0.86, s * 0.86, s * 0.14); break;
      case 'triangle': {
        var r = s * 0.6;
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * 0.866, y + r * 0.5);
        ctx.lineTo(x - r * 0.866, y + r * 0.5);
        ctx.closePath();
        break;
      }
      case 'diamond': {
        var d = s * 0.58;
        ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y); ctx.closePath();
        break;
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawItem(ctx, catKey, x, y, s, opts) {
    var cat = FF.CATS[catKey];
    opts = opts || {};
    var sc = opts.scale !== undefined ? opts.scale : 1;
    if (sc <= 0) return;
    s *= sc;
    if (!opts.noShadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.22, s * 0.5, s * 0.3, 0, 0, TAU);
      ctx.fill();
    }
    shapePath(ctx, cat.shape, x, y, s);
    ctx.fillStyle = cat.color;
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, s * 0.09);
    ctx.strokeStyle = cat.dark;
    ctx.stroke();
    // brilho
    ctx.save();
    ctx.globalAlpha = 0.45;
    shapePath(ctx, cat.shape, x - s * 0.08, y - s * 0.1, s * 0.42);
    ctx.fillStyle = cat.light;
    ctx.fill();
    ctx.restore();
  }

  /* ---------- Renderer ---------- */
  function Renderer(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1; this.W = 1; this.H = 1;
    this.ts = 40; this.ox = 0; this.oy = 0;
    this.sim = null;
    this.paths = [];
    this.fx = [];
    this.devAngle = [];
    this.binPulse = [];
    this.srcPulse = [];
    this.beltDist = 0;
    this.time = 0;
    this.coachTile = -1;
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  Renderer.prototype.resize = function (w, h) {
    this.dpr = Math.min(globalThis.devicePixelRatio || 1, 2.5);
    this.W = Math.max(1, w); this.H = Math.max(1, h);
    this.cv.width = Math.round(this.W * this.dpr);
    this.cv.height = Math.round(this.H * this.dpr);
    this.cv.style.width = this.W + 'px';
    this.cv.style.height = this.H + 'px';
    this.layout();
  };

  Renderer.prototype.layout = function () {
    if (!this.sim) return;
    var F = this.sim.F, padTop = 34; // faixa do chip de status
    var H = this.H - padTop;
    this.ts = Math.floor(Math.min(this.W / (F.w + 0.5), H / (F.h + 0.5), 96));
    this.ox = Math.round((this.W - F.w * this.ts) / 2);
    this.oy = Math.round(padTop + (H - F.h * this.ts) / 2);
  };

  Renderer.prototype.setSim = function (sim) {
    this.sim = sim;
    this.fx = [];
    this.binPulse = sim.F.bins.map(function () { return 0; });
    this.srcPulse = sim.F.sources.map(function () { return 0; });
    this.devAngle = sim.dev.map(function (st, d) {
      var t = sim.F.tiles[sim.F.devices[d].tile];
      return t.outs ? dirAngle(t.outs[st]) : 0;
    });
    this.gateAnim = sim.dev.map(function () { return 0; });
    this.buildPaths();
    this.layout();
  };

  function dirAngle(d) { return Math.atan2(FF.DY[d], FF.DX[d]); }

  // Trajetos visuais de cada bloco, em coordenadas locais (0..1)
  Renderer.prototype.buildPaths = function () {
    var F = this.sim.F, list = [];
    function add(t, ins, outs, role) {
      var pts = [], len = [0], N = (ins >= 0 && outs >= 0 && outs !== opp(ins)) ? 14 : 2;
      var t0 = ins < 0 ? 0.5 : 0, t1 = outs < 0 ? 0.5 : 1, tmp = {};
      for (var k = 0; k <= N; k++) {
        FF.Geo.pathPoint(0, 0, ins, outs, t0 + (t1 - t0) * k / N, tmp);
        pts.push([tmp.x, tmp.y]);
        if (k) len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      }
      // traço com leve sobreposição nas bordas do bloco (evita emendas visíveis)
      var E = 0.015, stroke = pts.map(function (q) { return q.slice(); });
      if (ins >= 0) { stroke[0][0] += FF.DX[ins] * E; stroke[0][1] += FF.DY[ins] * E; }
      if (outs >= 0) { var z = stroke.length - 1; stroke[z][0] += FF.DX[outs] * E; stroke[z][1] += FF.DY[outs] * E; }
      list.push({ tile: t, ins: ins, outs: outs, role: role, pts: pts, stroke: stroke, len: len, total: len[len.length - 1] });
    }
    F.tiles.forEach(function (t) {
      if (!t) return;
      var s, any = false;
      switch (t.type) {
        case 'conveyor': case 'gate':
          for (s = 0; s < 4; s++) if (t.feeders[s]) { add(t, s, t.out, 'belt'); any = true; }
          if (!any) add(t, opp(t.out), t.out, 'belt');
          break;
        case 'distributor':
          for (s = 0; s < 4; s++) if (t.feeders[s]) { any = true; t.outs.forEach(function (o) { add(t, s, o, 'dist'); }); }
          break;
        case 'diverter':
          for (s = 0; s < 4; s++) if (t.feeders[s]) { any = true; t.outs.forEach(function (o) { add(t, s, o, 'div'); }); }
          if (!any) t.outs.forEach(function (o) { add(t, opp(t.outs[0]) === o ? opp(t.outs[1]) : opp(t.outs[0]), o, 'div'); });
          break;
        case 'crossing':
          t.exits.forEach(function (e) { add(t, opp(e), e, 'belt'); });
          break;
        case 'source':
          add(t, -1, t.out, 'belt');
          break;
        case 'bin':
          for (s = 0; s < 4; s++) if (t.feeders[s]) add(t, s, -1, 'belt');
          break;
      }
    });
    // ordem: entradas inativas primeiro, para a rota ativa ficar por cima
    this.paths = list;
  };

  Renderer.prototype.tileAt = function (px, py) {
    if (!this.sim) return null;
    var x = Math.floor((px - this.ox) / this.ts), y = Math.floor((py - this.oy) / this.ts);
    var F = this.sim.F;
    if (x < 0 || y < 0 || x >= F.w || y >= F.h) return null;
    return F.tiles[y * F.w + x];
  };

  Renderer.prototype.tileCenter = function (i) {
    var F = this.sim.F, x = i % F.w, y = Math.floor(i / F.w);
    return { x: this.ox + (x + 0.5) * this.ts, y: this.oy + (y + 0.5) * this.ts, r: this.ts / 2 };
  };

  /* ---------- Eventos -> efeitos ---------- */
  Renderer.prototype.onEvent = function (ev) {
    var F = this.sim.F;
    var c = ev.tile !== undefined && ev.tile >= 0 ? this.tileCenter(ev.tile) : null;
    switch (ev.type) {
      case 'deliver':
        this.binPulse[ev.bin] = 1;
        this.burst(c.x, c.y, FF.CATS[ev.cat].color, 12, 1);
        break;
      case 'wrong':
        this.burst(c.x, c.y, P.danger, 18, 1.4);
        break;
      case 'toggle':
        this.fx.push({ kind: 'ring', x: c.x, y: c.y, life: 0, max: 0.35, color: P.cyan });
        break;
      case 'spawn':
        var t = F.tiles[ev.tile];
        if (t.src >= 0) this.srcPulse[t.src] = 1;
        break;
      case 'win':
        var self = this;
        F.bins.forEach(function (b) { var cc = self.tileCenter(b.tile); self.burst(cc.x, cc.y, FF.CATS[b.cat].color, 26, 2.2); });
        break;
    }
  };

  Renderer.prototype.burst = function (x, y, color, n, power) {
    if (this.reduced) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, v = (0.6 + Math.random() * 1.4) * this.ts * power;
      this.fx.push({
        kind: 'p', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - this.ts * 0.6,
        life: 0, max: 0.45 + Math.random() * 0.35, color: color, size: this.ts * (0.05 + Math.random() * 0.05)
      });
    }
  };

  /* ---------- Desenho ---------- */
  Renderer.prototype.draw = function (dt, alpha, running, speedMul) {
    var ctx = this.ctx, sim = this.sim;
    this.time += dt;
    if (running && !this.reduced) this.beltDist += dt * (C.BASE_SPEED * C.TICK_RATE / (2 * C.HALF)) * speedMul;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    if (!sim) return;
    var F = sim.F, ts = this.ts, ox = this.ox, oy = this.oy;

    this.drawFloor(ctx, F);
    var jam = this.jamTiles();

    // trilhos e lona das esteiras
    var self = this;
    // rotas inativas dos desviadores primeiro: a rota ativa fica por cima
    var notNext = function (p) { return (p.role === 'div' || p.role === 'dist') && p.outs !== p.tile.outs[sim.dev[p.tile.dev]]; };
    var ordered = this.paths.filter(notNext).concat(this.paths.filter(function (p) { return !notNext(p); }));
    ['rail', 'belt', 'chev'].forEach(function (layer) {
      for (var i = 0; i < ordered.length; i++) self.drawPath(ctx, ordered[i], layer, jam);
    });

    // placas de cruzamento e desviadores (abaixo dos objetos)
    F.tiles.forEach(function (t) {
      if (!t) return;
      if (t.type === 'crossing') self.drawCrossing(ctx, t);
      if (t.type === 'diverter') self.drawDiverter(ctx, t, dt);
      if (t.type === 'distributor') self.drawDistributor(ctx, t, dt);
    });

    // objetos
    var pos = {};
    var isz = ts * C.ITEM_SIZE;
    for (var k = 0; k < sim.items.length; k++) {
      var it = sim.items[k];
      var pBack = running ? it.p - it.adv * (1 - alpha) : it.p;
      var saveP = it.p;
      it.p = pBack < 0 ? 0 : pBack;
      FF.Geo.itemPos(F, it, pos);
      it.p = saveP;
      var age = (sim.tick - it.born + alpha) / 10;
      var sc = it.ins < 0 && it.half === 1 ? Math.min(1, 0.35 + age * 0.65) : 1;
      drawItem(ctx, it.cat, ox + pos.x * ts, oy + pos.y * ts, isz, { scale: sc });
    }

    // barreiras dos bloqueadores por cima dos objetos
    F.devices.forEach(function (d, i) { if (d.type === 'gate') self.drawGate(ctx, F.tiles[d.tile], i, dt); });

    // máquinas e recipientes por cima
    F.sources.forEach(function (S, i) { self.drawSource(ctx, F.tiles[S.tile], S, sim.src[i], i, dt); });
    F.bins.forEach(function (b, i) { self.drawBin(ctx, F.tiles[b.tile], i, dt); });

    // destaque do tutorial
    if (this.coachTile >= 0) {
      var cc = this.tileCenter(this.coachTile);
      var pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
      ctx.strokeStyle = P.cyan;
      ctx.globalAlpha = 0.5 + 0.5 * pulse;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cc.x, cc.y, ts * (0.62 + 0.08 * pulse), 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // falha: aponta o problema
    if (sim.status === 'failed' && sim.fail) {
      var marks = [sim.fail.tile];
      if (sim.fail.jamTile >= 0 && sim.fail.jamTile !== sim.fail.tile) marks.push(sim.fail.jamTile);
      marks.forEach(function (ti, n) {
        if (ti === undefined || ti < 0) return;
        var c = self.tileCenter(ti);
        var pu = 0.5 + 0.5 * Math.sin(self.time * 7 + n);
        ctx.strokeStyle = P.danger;
        ctx.lineWidth = 3.5;
        ctx.globalAlpha = 0.6 + 0.4 * pu;
        ctx.beginPath(); ctx.arc(c.x, c.y, ts * (0.6 + 0.1 * pu), 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }

    this.drawFx(ctx, dt);
  };

  Renderer.prototype.jamTiles = function () {
    var set = {}, sim = this.sim;
    for (var i = 0; i < sim.items.length; i++) if (sim.items[i].stall >= C.STALL_TICKS) set[sim.items[i].tile] = true;
    return set;
  };

  Renderer.prototype.drawFloor = function (ctx, F) {
    var ts = this.ts, ox = this.ox, oy = this.oy, pad = ts * 0.18;
    ctx.fillStyle = P.floor;
    ctx.beginPath();
    roundRect(ctx, ox - pad, oy - pad, F.w * ts + pad * 2, F.h * ts + pad * 2, ts * 0.28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,150,200,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 1; x < F.w; x++) { ctx.moveTo(ox + x * ts + 0.5, oy); ctx.lineTo(ox + x * ts + 0.5, oy + F.h * ts); }
    for (var y = 1; y < F.h; y++) { ctx.moveTo(ox, oy + y * ts + 0.5); ctx.lineTo(ox + F.w * ts, oy + y * ts + 0.5); }
    ctx.stroke();
    // parafusos nos cantos
    ctx.fillStyle = 'rgba(140,160,200,0.10)';
    for (var yy = 0; yy <= F.h; yy++) for (var xx = 0; xx <= F.w; xx++) {
      ctx.beginPath(); ctx.arc(ox + xx * ts, oy + yy * ts, Math.max(1, ts * 0.025), 0, TAU); ctx.fill();
    }
  };

  Renderer.prototype.drawPath = function (ctx, path, layer, jam) {
    var ts = this.ts, t = path.tile, bx = this.ox + t.x * ts, by = this.oy + t.y * ts, pts = path.pts, k;
    var inactive = false, active = false;
    if (path.role === 'div' || path.role === 'dist') {
      var cur = t.outs[this.sim.dev[t.dev]];
      active = path.outs === cur;
      inactive = !active && path.role === 'div'; // o distribuidor usa todas as saídas
    }
    if (layer === 'rail' || layer === 'belt') {
      var sp = path.stroke;
      ctx.beginPath();
      ctx.moveTo(bx + sp[0][0] * ts, by + sp[0][1] * ts);
      for (k = 1; k < sp.length; k++) ctx.lineTo(bx + sp[k][0] * ts, by + sp[k][1] * ts);
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';
      if (layer === 'rail') {
        ctx.lineWidth = ts * 0.66;
        ctx.strokeStyle = jam[t.i] ? P.warn : (inactive ? '#232c40' : (t.slow ? '#7a5a26' : P.rail));
        ctx.stroke();
      } else {
        ctx.lineWidth = ts * 0.54;
        ctx.strokeStyle = inactive ? '#0a0f1a' : P.belt;
        ctx.stroke();
      }
      return;
    }
    // divisas (chevrons) — só nas faixas ativas
    if (inactive || (path.role === 'dist' && !active)) {
      if (path.role !== 'dist') return;
    }
    var color = active ? 'rgba(47,230,230,0.55)' : (t.slow ? 'rgba(255,176,46,0.42)' : P.chevron);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, ts * 0.06);
    ctx.lineCap = 'round';
    var gapC = t.slow ? CHEV * 1.6 : CHEV;
    var start = (this.beltDist * (t.speed / C.BASE_SPEED)) % gapC;
    var w = ts * 0.13, seg = 0, tmpA;
    for (var d = start; d < path.total - 0.02; d += gapC) {
      if (d < 0.03) continue;
      while (seg < path.len.length - 2 && path.len[seg + 1] < d) seg++;
      var l0 = path.len[seg], l1 = path.len[seg + 1], f = (d - l0) / ((l1 - l0) || 1);
      var x = pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * f;
      var y = pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * f;
      tmpA = Math.atan2(pts[seg + 1][1] - pts[seg][1], pts[seg + 1][0] - pts[seg][0]);
      var cx = bx + x * ts, cy = by + y * ts, ca = Math.cos(tmpA), sa = Math.sin(tmpA);
      ctx.beginPath();
      ctx.moveTo(cx - ca * w * 0.5 - sa * w, cy - sa * w * 0.5 + ca * w);
      ctx.lineTo(cx + ca * w * 0.5, cy + sa * w * 0.5);
      ctx.lineTo(cx - ca * w * 0.5 + sa * w, cy - sa * w * 0.5 - ca * w);
      ctx.stroke();
    }
  };

  Renderer.prototype.drawCrossing = function (ctx, t) {
    var c = this.tileCenter(t.i), ts = this.ts, s = ts * 0.34;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = P.surface2;
    ctx.strokeStyle = '#56647f';
    ctx.lineWidth = Math.max(1, ts * 0.03);
    ctx.beginPath(); roundRect(ctx, -s / 2, -s / 2, s, s, ts * 0.05); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#7d8aa6';
    ctx.lineWidth = Math.max(1, ts * 0.035);
    var q = ts * 0.07;
    ctx.beginPath();
    ctx.moveTo(c.x - q, c.y); ctx.lineTo(c.x + q, c.y);
    ctx.moveTo(c.x, c.y - q); ctx.lineTo(c.x, c.y + q);
    ctx.stroke();
  };

  Renderer.prototype.drawDiverter = function (ctx, t, dt) {
    var sim = this.sim, ts = this.ts, c = this.tileCenter(t.i);
    var target = dirAngle(t.outs[sim.dev[t.dev]]);
    var a = this.devAngle[t.dev];
    var diff = target - a;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    a += diff * Math.min(1, dt * 18);
    this.devAngle[t.dev] = a;
    var r = ts * 0.24;
    // aura de interação no planejamento
    if (sim.status === 'planning') {
      var pu = 0.5 + 0.5 * Math.sin(this.time * 3 + t.dev);
      ctx.fillStyle = 'rgba(47,230,230,' + (0.06 + 0.08 * pu).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(c.x, c.y, r * 1.9, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#0b1220';
    ctx.strokeStyle = P.cyan;
    ctx.lineWidth = Math.max(2, ts * 0.055);
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fill(); ctx.stroke();
    // seta
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(a);
    ctx.fillStyle = P.cyan;
    ctx.beginPath();
    ctx.moveTo(r * 0.78, 0);
    ctx.lineTo(-r * 0.2, -r * 0.52);
    ctx.lineTo(-r * 0.02, 0);
    ctx.lineTo(-r * 0.2, r * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  Renderer.prototype.drawDistributor = function (ctx, t, dt) {
    var sim = this.sim, ts = this.ts, c = this.tileCenter(t.i);
    var target = dirAngle(t.outs[sim.dev[t.dev]]);
    var a = this.devAngle[t.dev], diff = target - a;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    a += diff * Math.min(1, dt * 14);
    this.devAngle[t.dev] = a;
    var r = ts * 0.27, k;
    if (sim.status === 'planning') {
      var pu = 0.5 + 0.5 * Math.sin(this.time * 3 + t.dev);
      ctx.fillStyle = 'rgba(47,230,230,' + (0.06 + 0.08 * pu).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(c.x, c.y, r * 1.8, 0, TAU); ctx.fill();
    }
    // placa hexagonal
    ctx.beginPath();
    for (k = 0; k < 6; k++) {
      var ang = Math.PI / 6 + k * Math.PI / 3;
      ctx[k ? 'lineTo' : 'moveTo'](c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#0b1220'; ctx.fill();
    ctx.strokeStyle = P.cyan; ctx.lineWidth = Math.max(2, ts * 0.05); ctx.stroke();
    // marcadores de cada saída: cheio = próxima
    var cur = t.outs[sim.dev[t.dev]];
    t.outs.forEach(function (o) {
      var px = c.x + FF.DX[o] * ts * 0.38, py = c.y + FF.DY[o] * ts * 0.38;
      ctx.beginPath(); ctx.arc(px, py, ts * 0.055, 0, TAU);
      if (o === cur) { ctx.fillStyle = P.cyan; ctx.fill(); }
      else { ctx.strokeStyle = P.cyan; ctx.lineWidth = Math.max(1.2, ts * 0.025); ctx.stroke(); }
    });
    // seta curta + anel de giro
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(a);
    ctx.fillStyle = P.cyan;
    ctx.beginPath(); ctx.moveTo(r * 0.62, 0); ctx.lineTo(-r * 0.05, -r * 0.4); ctx.lineTo(-r * 0.05, r * 0.4); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(47,230,230,0.55)'; ctx.lineWidth = Math.max(1, ts * 0.02);
    ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.5, a + 0.9, a + TAU - 0.9); ctx.stroke();
  };

  Renderer.prototype.drawGate = function (ctx, t, d, dt) {
    var sim = this.sim, ts = this.ts, c = this.tileCenter(t.i);
    var ins = -1;
    for (var s = 0; s < 4; s++) if (t.feeders[s]) { ins = s; break; }
    if (ins < 0) ins = opp(t.out);
    var closed = sim.dev[d] > 0;
    this.gateAnim[d] += ((closed ? 1 : 0) - this.gateAnim[d]) * Math.min(1, dt * 16);
    var k = this.gateAnim[d];
    var off = C.GATE_STOP / (2 * C.HALF);
    var gx = c.x + FF.DX[ins] * off * ts, gy = c.y + FF.DY[ins] * off * ts;
    var px = -FF.DY[ins], py = FF.DX[ins]; // perpendicular à faixa
    var half = ts * 0.36;
    // postes
    ctx.fillStyle = closed ? P.warn : P.cyan;
    [-1, 1].forEach(function (sg) {
      ctx.beginPath(); ctx.arc(gx + px * half * sg, gy + py * half * sg, ts * 0.07, 0, TAU); ctx.fill();
    });
    // barra (desliza para fora quando abre)
    var len = half * k;
    if (k > 0.02) {
      ctx.strokeStyle = P.warn; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(3, ts * 0.1);
      ctx.beginPath();
      ctx.moveTo(gx - px * half, gy - py * half); ctx.lineTo(gx - px * (half - len), gy - py * (half - len));
      ctx.moveTo(gx + px * half, gy + py * half); ctx.lineTo(gx + px * (half - len), gy + py * (half - len));
      ctx.stroke();
      // listras de atenção
      ctx.strokeStyle = 'rgba(20,14,0,0.55)'; ctx.lineWidth = Math.max(1, ts * 0.025);
      for (var q = -0.8; q <= 0.8; q += 0.4) {
        if (Math.abs(q) * half > len + 0.01 && k < 0.98) continue;
        var qx = gx + px * half * q, qy = gy + py * half * q;
        ctx.beginPath(); ctx.moveTo(qx - FF.DX[ins] * ts * 0.04, qy - FF.DY[ins] * ts * 0.04); ctx.lineTo(qx + FF.DX[ins] * ts * 0.04, qy + FF.DY[ins] * ts * 0.04); ctx.stroke();
      }
    } else {
      // aberto: guias ciano curtas indicando que é tocável
      ctx.strokeStyle = 'rgba(47,230,230,0.7)'; ctx.lineWidth = Math.max(2, ts * 0.04); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(gx - px * half, gy - py * half); ctx.lineTo(gx - px * half * 0.75, gy - py * half * 0.75);
      ctx.moveTo(gx + px * half, gy + py * half); ctx.lineTo(gx + px * half * 0.75, gy + py * half * 0.75);
      ctx.stroke();
    }
    // contagem regressiva
    if (closed && sim.status !== 'planning') {
      var left = Math.max(0, (sim.dev[d] - sim.tick) / C.GATE_TICKS);
      ctx.strokeStyle = P.warn; ctx.lineWidth = Math.max(2, ts * 0.045); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(c.x - FF.DX[ins] * ts * 0.1, c.y - FF.DY[ins] * ts * 0.1, ts * 0.13, -Math.PI / 2, -Math.PI / 2 + TAU * left); ctx.stroke();
    } else if (closed) {
      ctx.fillStyle = P.warn;
      ctx.font = '800 ' + Math.round(ts * 0.2) + 'px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('2s', c.x - FF.DX[ins] * ts * 0.12, c.y - FF.DY[ins] * ts * 0.12);
    }
    if (sim.status === 'planning' && !closed) {
      var pu = 0.5 + 0.5 * Math.sin(this.time * 3 + d);
      ctx.strokeStyle = 'rgba(47,230,230,' + (0.15 + 0.2 * pu).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(gx, gy, half * 1.15, 0, TAU); ctx.stroke();
    }
  };

  Renderer.prototype.drawSource = function (ctx, t, S, st, i, dt) {
    var ts = this.ts, c = this.tileCenter(t.i), s = ts * 0.84;
    this.srcPulse[i] = Math.max(0, this.srcPulse[i] - dt * 4);
    var ox = FF.DX[t.out] * ts * 0.06, oy = FF.DY[t.out] * ts * 0.06;
    var x0 = c.x - s / 2 - ox, y0 = c.y - s / 2 - oy;
    var g = ctx.createLinearGradient(0, y0, 0, y0 + s);
    g.addColorStop(0, '#34405a'); g.addColorStop(1, '#1f2839');
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); roundRect(ctx, x0 + ts * 0.03, y0 + ts * 0.06, s, s, ts * 0.16); ctx.fill();
    ctx.fillStyle = g;
    ctx.strokeStyle = '#4b5a78';
    ctx.lineWidth = Math.max(1, ts * 0.03);
    ctx.beginPath(); roundRect(ctx, x0, y0, s, s, ts * 0.16); ctx.fill(); ctx.stroke();
    // escotilha
    var hx = c.x - ox * 0.5, hy = c.y - oy * 0.5, hr = ts * 0.2;
    ctx.fillStyle = '#0a101c';
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
    var remaining = S.seq.length - st.idx;
    if (remaining > 0) {
      drawItem(ctx, S.seq[st.idx], hx, hy, ts * 0.22, { noShadow: true, scale: 1 - this.srcPulse[i] * 0.6 });
    } else {
      ctx.strokeStyle = P.muted; ctx.lineWidth = Math.max(1.5, ts * 0.04);
      ctx.beginPath(); ctx.moveTo(hx - hr * 0.45, hy); ctx.lineTo(hx - hr * 0.1, hy + hr * 0.35); ctx.lineTo(hx + hr * 0.5, hy - hr * 0.35); ctx.stroke();
    }
    // letra da linha
    ctx.fillStyle = P.white;
    ctx.font = '800 ' + Math.round(ts * 0.24) + 'px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(S.label, x0 + ts * 0.08, y0 + ts * 0.04);
    // depósito: objetos esperando para sair
    var pipW = ts * 0.1, pipG = ts * 0.04, n = C.HOPPER_MAX;
    var px0 = c.x - ox - ((pipW + pipG) * n - pipG) / 2, py0 = y0 + s - ts * 0.16;
    for (var q = 0; q < n; q++) {
      var full = q < st.pressure;
      ctx.fillStyle = full ? (st.pressure >= C.HOPPER_WARN ? P.danger : P.warn) : 'rgba(10,16,28,0.9)';
      ctx.fillRect(px0 + q * (pipW + pipG), py0, pipW, ts * 0.06);
    }
    // pressão (congestionamento)
    if (st.pressure > 0) {
      var ratio = Math.min(1, st.pressure / C.HOPPER_MAX);
      var hot = st.pressure >= C.HOPPER_WARN;
      var pu = hot ? 0.6 + 0.4 * Math.sin(this.time * 12) : 1;
      ctx.strokeStyle = hot ? P.danger : P.warn;
      ctx.globalAlpha = pu;
      ctx.lineWidth = Math.max(2.5, ts * 0.07);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(c.x, c.y, s * 0.62, -Math.PI / 2, -Math.PI / 2 + TAU * ratio); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };

  Renderer.prototype.drawBin = function (ctx, t, i, dt) {
    var ts = this.ts, c = this.tileCenter(t.i), cat = FF.CATS[t.cat];
    this.binPulse[i] = Math.max(0, this.binPulse[i] - dt * 3.5);
    var pu = this.binPulse[i];
    var s = ts * (0.84 + 0.08 * pu);
    var x0 = c.x - s / 2, y0 = c.y - s / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); roundRect(ctx, x0 + ts * 0.03, y0 + ts * 0.06, s, s, ts * 0.2); ctx.fill();
    ctx.fillStyle = '#0d1424';
    ctx.strokeStyle = cat.color;
    ctx.lineWidth = Math.max(2, ts * 0.075);
    ctx.beginPath(); roundRect(ctx, x0, y0, s, s, ts * 0.2); ctx.fill(); ctx.stroke();
    if (pu > 0) {
      ctx.fillStyle = cat.color;
      ctx.globalAlpha = pu * 0.35;
      ctx.beginPath(); roundRect(ctx, x0, y0, s, s, ts * 0.2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // forma da categoria
    shapePath(ctx, cat.shape, c.x, c.y - ts * 0.06, ts * 0.36);
    ctx.lineWidth = Math.max(1.5, ts * 0.05);
    ctx.strokeStyle = cat.color;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // contador
    var sim = this.sim, need = 0;
    sim.F.sources.forEach(function (S) { S.seq.forEach(function (k) { if (k === t.cat) need++; }); });
    var sameCat = sim.F.bins.filter(function (b) { return b.cat === t.cat; }).length;
    ctx.fillStyle = P.white;
    ctx.font = '600 ' + Math.max(9, Math.round(ts * 0.19)) + 'px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    var label = sameCat === 1 ? sim.binCount[i] + '/' + need : String(sim.binCount[i]);
    ctx.fillText(label, c.x, y0 + s - ts * 0.07);
  };

  Renderer.prototype.drawFx = function (ctx, dt) {
    var out = [];
    for (var i = 0; i < this.fx.length; i++) {
      var f = this.fx[i];
      f.life += dt;
      if (f.life >= f.max) continue;
      var k = f.life / f.max;
      if (f.kind === 'p') {
        f.vy += this.ts * 4 * dt;
        f.x += f.vx * dt; f.y += f.vy * dt;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.size * (1 - k * 0.5), 0, TAU); ctx.fill();
      } else if (f.kind === 'ring') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(f.x, f.y, this.ts * (0.3 + 0.45 * k), 0, TAU); ctx.stroke();
      }
      out.push(f);
    }
    ctx.globalAlpha = 1;
    this.fx = out;
  };

  FF.Renderer = Renderer;
  FF.Draw = { item: drawItem, shapePath: shapePath, roundRect: roundRect };
})(globalThis.FF = globalThis.FF || {});
