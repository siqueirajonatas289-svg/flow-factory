/* FLOW FACTORY — levels2.js
 * Capítulos 7 a 16: uma mecânica nova por capítulo, sempre combinada com as anteriores.
 * Todas as fases passam por `node tools/validate.js`.
 */
(function (FF) {
  'use strict';
  var S = function (out, seq, interval, delay) { return { type: 'source', out: out, seq: seq, interval: interval, delay: delay }; };
  var BIN = function (cat) { return { type: 'bin', cat: cat }; };
  var BINC = function (cat, cap) { return { type: 'bin', cat: cat, cap: cap }; };
  var PRESS = function (cat, ticks) { return { type: 'bin', cat: cat, press: ticks }; };
  var DIV = function (a, b, st) { return { type: 'diverter', outs: [a, b], state: st || 0 }; };
  var DIST = function (outs, st) { return { type: 'distributor', outs: outs, state: st || 0 }; };
  var GATE = function (out) { return { type: 'gate', out: out }; };
  var SLOW = function (out) { return { type: 'slow', out: out }; };
  var FAST = function (out) { return { type: 'fast', out: out }; };
  var PAINT = function (out, color) { return { type: 'paint', out: out, color: color }; };
  var FILT = function (match, rest, colors, st) { return { type: 'filter', outs: [match, rest], colors: colors, state: st || 0 }; };
  var BRIDGE = { type: 'bridge' };
  var REV = function (axis, st) { return { type: 'rev', axis: axis, state: st || 0 }; };

  FF.CHAPTERS.push(
    { id: 7, name: 'PAINT SHOP', subtitle: 'O pintor muda a cor de quem passa' },
    { id: 8, name: 'COLOR FILTER', subtitle: 'Filtros que separam uma cor sozinhos' },
    { id: 9, name: 'EXPRESS', subtitle: 'Esteiras expressas: rápido demais para pensar' },
    { id: 10, name: 'OVERPASS', subtitle: 'Pontes: um eixo passa por cima do outro' }
  );

  var L = [
    /* ───────────── CAPÍTULO 7 — PAINT SHOP ───────────── */
    {
      id: '7-1', chapter: 7, name: 'Banho de Tinta', par: 6, requiresAction: true,
      map: ['..A..', '..v..', '.vdv.', '.p.v.', '.v.v.', '.1.2.'],
      legend: { A: S('S', 'RYRGRYGR', 90, 20), d: DIV('W', 'E', 1), p: PAINT('S', 'B'), 1: BINC('B', 4), 2: BIN('R') },
      tutorial: [{ text: 'O pintor muda a cor de quem passa por ele. Amarelos e verdes não têm recipiente: pinte-os de azul.', target: 'tile:1,3', until: 'start' }]
    },
    {
      id: '7-2', chapter: 7, name: 'Retoque', par: 6, requiresAction: true,
      map: ['A.....B', 'v.....v', 'd>>v<<e', 'v..p..v', 'v..v..v', '1..2..3'],
      legend: {
        A: S('S', 'RBRRBG', 120, 30), B: S('S', 'YRYBYG', 120, 60),
        d: DIV('S', 'E'), e: DIV('S', 'W'), p: PAINT('S', 'G'), 1: BIN('R'), 2: BINC('G', 7), 3: BIN('Y')
      },
    },
    {
      id: '7-3', chapter: 7, name: 'Dupla Demão', par: 6, requiresAction: true,
      map: ['..A..', '..v..', '.vdv.', '.y.v.', '.s.v.', '.>v<.', '.vev.', '.v.v.', '.1.2.'],
      legend: {
        A: S('S', 'GGRRRBYR', 120, 20), d: DIV('E', 'W'), e: DIV('W', 'E'),
        y: PAINT('S', 'Y'), s: SLOW('S'), 1: BIN('R'), 2: BINC('Y', 4)
      },
      tutorial: [{ text: 'O amarelo só cabe 4. Pinte de amarelo só o que não é vermelho. A tinta é lenta: a ordem muda!', target: 'tile:2,2', until: 'start' }]
    },
    {
      id: '7-4', chapter: 7, name: 'Arco-Íris', par: 4, requiresAction: true,
      map: ['..A..', '..v..', '.vDv.', '.bvy.', '.vvv.', '.123.'],
      legend: {
        A: S('S', 'RGRRRGRRRRGR', 70, 20), D: DIST(['W', 'S', 'E']), b: PAINT('S', 'B'), y: PAINT('S', 'Y'),
        1: BINC('B', 6), 2: BINC('R', 3), 3: BINC('Y', 3)
      },
    },
    {
      id: '7-5', chapter: 7, name: 'Oficina Completa', par: 7, requiresAction: true,
      map: ['...A..1', '...g..^', '...v..^', 'Bp>+>>e', '...v..v', '..vdv.2', '..3.4..'],
      legend: {
        A: S('S', 'RRBBRB', 110, 0), B: S('E', 'RXGXBR', 110, 80),
        g: GATE('S'), p: PAINT('E', 'Y'), d: DIV('W', 'E'), e: DIV('N', 'S'),
        1: BIN('Y'), 2: BIN('X'), 3: BIN('R'), 4: BIN('B')
      },
      tutorial: [{ text: 'Hexágono cinza = defeituoso. O pintor não consegue pintá-lo: ele só pode ir para o descarte.', target: 'bin:1', until: 'start' }]
    },

    /* ───────────── CAPÍTULO 8 — COLOR FILTER ───────────── */
    {
      id: '8-1', chapter: 8, name: 'Peneira', par: 7, requiresAction: true,
      map: ['...A...', '...v...', '.v<f>v.', '.v...v.', 'vgv.vdv', 'v.v.v.v', '1.2.3.4'],
      legend: {
        A: S('S', 'YGRBBRGY', 100, 20), f: FILT('W', 'E', 'RG'), g: DIV('W', 'E'), d: DIV('W', 'E'),
        1: BIN('R'), 2: BIN('G'), 3: BIN('B'), 4: BIN('Y')
      },
      tutorial: [{ text: 'Filtro: a cor mostrada sai pelo ponto colorido; todas as outras saem pelo outro lado. Toque para trocar a cor.', target: 'device:0', until: 'start' }]
    },
    {
      id: '8-2', chapter: 8, name: 'Detector de Defeitos', par: 4, requiresAction: true,
      map: ['A.....B', 'v.....v', '>>>v<<<', '...f>>9', '...v...', '..vdv..', '..1.2..'],
      legend: {
        A: S('S', 'RBXRBX', 120, 0), B: S('S', 'BXRBXR', 120, 90),
        f: FILT('E', 'S', 'X'), d: DIV('W', 'E'), 9: BIN('X'), 1: BIN('R'), 2: BIN('B')
      },
      tutorial: [{ text: 'Este filtro cinza é automático: manda todo defeituoso para o descarte sozinho.', target: 'tile:3,3', until: 'start' }]
    },
    {
      id: '8-3', chapter: 8, name: 'Pintura Seletiva', par: 4, requiresAction: true,
      map: ['..A..', '..v..', '.vf..', '.pv..', '.vdv.', '.123.'],
      legend: {
        A: S('S', 'BRYBRBYR', 95, 20), f: FILT('W', 'S', 'RB'), p: PAINT('S', 'G'), d: DIV('S', 'E'),
        1: BINC('G', 5), 2: BINC('R', 3), 3: BIN('Y')
      },
    },
    {
      id: '8-4', chapter: 8, name: 'Filtro e Barreira', par: 8, requiresAction: true,
      map: ['A.....B', 'v.....h', '>>>v<<<', '.v<f>v.', '.v...v.', 'vgv.vdv', '1.2.3.4'],
      legend: {
        A: S('S', 'RBYGR', 90, 0), B: S('S', 'GYBRB', 130, 80),
        h: GATE('S'), f: FILT('W', 'E', 'RY'), g: DIV('W', 'E'), d: DIV('W', 'E'),
        1: BIN('R'), 2: BIN('Y'), 3: BIN('B'), 4: BIN('G')
      },
    },
    {
      id: '8-5', chapter: 8, name: 'Central de Triagem', par: 8, requiresAction: true,
      map: ['A..B..C', 'v..v..v', '>>>v<<<', '...F>>9', '...v...', '.v<f>v.', 'vgv.vdv', '1.2.3.4'],
      legend: {
        A: S('S', 'BGXG', 140, 0), B: S('S', 'RYXR', 120, 30), C: S('S', 'YGBX', 120, 60),
        F: FILT('E', 'S', 'X'), f: FILT('W', 'E', 'BG'), g: DIV('W', 'E'), d: DIV('W', 'E'),
        9: BIN('X'), 1: BIN('B'), 2: BIN('G'), 3: BIN('R'), 4: BIN('Y')
      },
    },

    /* ───────────── CAPÍTULO 9 — EXPRESS ───────────── */
    {
      id: '9-1', chapter: 9, name: 'Via Expressa', par: 7, requiresAction: true,
      map: ['..A....', '..v....', '.vd>>v.', '.f...v.', '.f...v.', '.f...v.', '.>>v<<.', '..vev..', '..1.2..'],
      legend: {
        A: S('S', 'RBRBRBRB', 60, 20), d: DIV('W', 'E'), f: FAST('S'), e: DIV('W', 'E'), 1: BIN('R'), 2: BIN('B')
      },
      tutorial: [{ text: 'Esteira índigo = expressa, o dobro da velocidade. Quem vai por ela ultrapassa os outros: use isso para agrupar as cores.', target: 'tile:1,4', until: 'start' }]
    },
    {
      id: '9-2', chapter: 9, name: 'Ultrapassagem', par: 8, requiresAction: true,
      map: ['A.....B', 'f.....s', 'f.....s', '>>>v<<<', '...y>>3', '..vdv..', '..1.2..'],
      legend: {
        A: S('S', 'RBRYBYRB', 45, 30), B: S('S', 'BRYBRYBR', 75, 40),
        f: FAST('S'), s: SLOW('S'), y: FILT('E', 'S', 'Y'), d: DIV('W', 'E'), 1: BIN('R'), 2: BIN('B'), 3: BIN('Y')
      },
    },
    {
      id: '9-3', chapter: 9, name: 'Ritmo Duplo', par: 6, requiresAction: true,
      map: ['...A...', '...v...', '..vDv..', '..f.s..', '..f.s..', '..>v<..', '...v...', '..vdv..', '..1.2..'],
      legend: { A: S('S', 'RRBBRBRBBRRB', 46, 20), D: DIST(['W', 'E']), f: FAST('S'), s: SLOW('S'), d: DIV('W', 'E'), 1: BIN('R'), 2: BIN('B') },
    },
    {
      id: '9-4', chapter: 9, name: 'Contra o Relógio', par: 9, requiresAction: true,
      map: ['Afffffv', '2.....v', 'e<ggg<d', 'v.....1', '>ffffh3', '.....4.'],
      legend: {
        A: S('E', 'BRGYRYBG', 85, 20), f: FAST('E'), g: FAST('W'),
        d: DIV('W', 'S'), e: DIV('S', 'N'), h: DIV('E', 'S'), 1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 4: BIN('G')
      },
    },
    {
      id: '9-5', chapter: 9, name: 'Expresso Noturno', par: 6, requiresAction: true,
      map: ['..A.B.5', '..f.h.^', '..f.v.^', 'C>+>+>d', '..v.v.v', '.vFvevv', '.1.2.34'],
      legend: {
        A: S('S', 'RBRRBB', 55, 0), B: S('S', 'YBYYB', 120, 30), C: S('E', 'GRGGR', 120, 100),
        f: FAST('S'), h: GATE('S'), F: FILT('W', 'E', 'RB'), e: DIV('W', 'E'), d: DIV('N', 'S'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 4: BIN('R'), 5: BIN('G')
      },
    },

    /* ───────────── CAPÍTULO 10 — OVERPASS ───────────── */
    {
      id: '10-1', chapter: 10, name: 'Viaduto', par: 10, requiresAction: true,
      map: ['...A..1', '...v..^', 'B>>k>>e', '...v..v', '..vdv.2', '..3.4..'],
      legend: {
        A: S('S', 'RBBRRBRB', 60, 0), B: S('E', 'YGGYYGYG', 60, 10),
        k: BRIDGE, d: DIV('W', 'E'), e: DIV('N', 'S'), 1: BIN('Y'), 2: BIN('G'), 3: BIN('R'), 4: BIN('B')
      },
      tutorial: [{ text: 'Ponte: a linha vertical passa por cima. Ninguém espera ninguém, mesmo com as duas linhas cheias.', target: 'tile:3,2', until: 'start' }]
    },
    {
      id: '10-2', chapter: 10, name: 'Dois Andares', par: 6, requiresAction: true,
      map: ['A....B.', 'v....v.', 'dsss>kv', 'v....vv', '>>>>>+v', '.....vv', '....ve1', '....23.'],
      legend: {
        A: S('S', 'RRRRRRRR', 28, 20), B: S('S', 'BYBYYBYB', 75, 60),
        d: DIV('S', 'E'), s: SLOW('E'), k: BRIDGE, e: DIV('W', 'S'), 1: BIN('R'), 2: BIN('Y'), 3: BIN('B')
      },
    },
    {
      id: '10-3', chapter: 10, name: 'Trevo Elevado', par: 9, requiresAction: true,
      map: ['..A.B.5', '..v.v.^', '..v.v.^', 'C>k>+>d', '..v.v.v', '.vevfvv', '.1.2.34'],
      legend: {
        A: S('S', 'RBRBB', 65, 30), B: S('S', 'YBYYB', 65, 80), C: S('E', 'RGGRG', 80, 40),
        k: BRIDGE, e: DIV('W', 'E'), f: DIV('W', 'E'), d: DIV('N', 'S'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 4: BIN('R'), 5: BIN('G')
      },
    },
    {
      id: '10-4', chapter: 10, name: 'Passagem Superior', par: 8, requiresAction: true,
      map: ['...A..1', '...v..^', 'B>>k>>e', '...v..v', '..vdv.2', '..p.v..', '..3.4..'],
      legend: {
        A: S('S', 'RBGRBG', 75, 0), B: S('E', 'YYXYXY', 65, 40),
        k: BRIDGE, d: DIV('W', 'E'), e: DIV('N', 'S'), p: PAINT('S', 'R'),
        1: BIN('Y'), 2: BIN('X'), 3: BINC('R', 4), 4: BIN('B')
      },
    },
    {
      id: '10-5', chapter: 10, name: 'Complexo Viário', par: 9, requiresAction: true,
      map: ['..A.B..', '..g.v.3', 'C>k>+>e', '..v.v.v', 'E>+>k>v', '..v.v.v', '.vd.fv6', '.vv.vv.', '.12.45.'],
      legend: {
        A: S('S', 'BRBR', 90, 30), B: S('S', 'YGYG', 90, 20), C: S('E', 'YBYB', 90, 10), E: S('E', 'BBBB', 65, 30),
        g: GATE('S'), k: BRIDGE, e: DIV('N', 'S'), d: DIV('W', 'S'), f: DIV('S', 'E'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 4: BIN('Y'), 5: BIN('G'), 6: BIN('B')
      },
    }
  ];

  L.forEach(function (lv) { FF.LEVELS.push(lv); });
})(globalThis.FF = globalThis.FF || {});
