/* FLOW FACTORY — levels3.js — capítulos 11 a 16. */
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
  var MIX = function (a, b, c) { return [a, b, c].filter(Boolean); };

  FF.CHAPTERS.push(
    { id: 11, name: 'FULL HOUSE', subtitle: 'Recipientes com capacidade: quando enchem, fecham' },
    { id: 12, name: 'HEAVY PRESS', subtitle: 'Prensas: um objeto de cada vez' },
    { id: 13, name: 'TWO-WAY', subtitle: 'Esteiras reversíveis: ida e volta pelo mesmo caminho' },
    { id: 14, name: 'WILD & DEFECTS', subtitle: 'Curingas que servem em qualquer lugar e peças com defeito' },
    { id: 15, name: 'BLUEPRINT', subtitle: 'Monte você mesmo a parte que falta da fábrica' },
    { id: 16, name: 'GRAND FACTORY', subtitle: 'Todas as máquinas, todas as linhas, uma fábrica só' }
  );

  var L = [
    /* ───────────── CAPÍTULO 11 — FULL HOUSE ───────────── */
    {
      id: '11-1', chapter: 11, name: 'Lotação', par: 8, requiresAction: true,
      map: ['...A...', '...v...', '.v<d>v.', '.v...v.', 'vev.vfv', 'v.v.v.v', '1.2.3.4'],
      legend: {
        A: S('S', 'RBRRBBRBRBBR', 85, 20), d: DIV('W', 'E'), e: DIV('W', 'E'), f: DIV('W', 'E'),
        1: BINC('R', 3), 2: BINC('B', 3), 3: BINC('R', 3), 4: BINC('B', 3)
      },
      tutorial: [{ text: 'Cada recipiente só cabe 3. Quando enche, fecha com cadeado e a fila para na frente dele.', target: 'bin:0', until: 'start' }]
    },
    {
      id: '11-2', chapter: 11, name: 'Transbordo', par: 7, requiresAction: true,
      map: ['A.....B', 'v.....v', 'd>>v<<e', 'v..v..v', 'v.vfv.v', '1.2.3.4'],
      legend: {
        A: S('S', 'YRRRYR', 60, 30), B: S('S', 'YRYYRY', 80, 80), d: DIV('S', 'E'), e: DIV('S', 'W'), f: DIV('W', 'E'),
        1: BINC('R', 3), 2: BIN('R'), 3: BIN('Y'), 4: BINC('Y', 3)
      },
    },
    {
      id: '11-3', chapter: 11, name: 'Estoque Limitado', par: 5, requiresAction: true,
      map: ['...A.', '...v.', '.v<F.', '.v.v.', 'vdvev', '9.812'],
      legend: {
        A: S('S', 'RXBXRBXBRX', 75, 20), F: FILT('W', 'S', 'X'), d: DIV('W', 'E'), e: DIV('S', 'E'),
        9: BINC('X', 2), 8: BINC('X', 2), 1: BIN('R'), 2: BIN('B')
      },
    },
    {
      id: '11-4', chapter: 11, name: 'Reserva', par: 10, requiresAction: true,
      map: ['A.....B', 'v.....v', 'd>p>v<<', 'v...v..', 'v..vev.', '1..2.3.'],
      legend: {
        A: S('S', 'RRRRRR', 90, 30), B: S('S', 'BYBBY', 120, 100), d: DIV('S', 'E'), p: PAINT('E', 'Y'), e: DIV('W', 'E'),
        1: BINC('R', 3), 2: BINC('Y', 5), 3: BIN('B')
      },
    },
    {
      id: '11-5', chapter: 11, name: 'Casa Cheia', par: 9, requiresAction: true,
      map: ['..A.B.5', '..v.g.^', 'C>+>+>e', '..v.v.v', '.vDvdvv', '.1.2.34'],
      legend: {
        A: S('S', 'RRBBRB', 80, 0), B: S('S', 'BYBYY', 65, 60), C: S('E', 'GRGRG', 80, 50),
        g: GATE('S'), e: DIV('N', 'S'), D: DIST(['W', 'E']), d: DIV('W', 'E'),
        1: BINC('R', 3), 2: BINC('B', 5), 3: BINC('Y', 3), 4: BIN('G'), 5: BIN('R')
      },
    },

    /* ───────────── CAPÍTULO 12 — HEAVY PRESS ───────────── */
    {
      id: '12-1', chapter: 12, name: 'Prensa', par: 6, requiresAction: true,
      map: ['...A..', '...v..', '..vd>v', '..v..v', '.vDv.v', '.v.v.v', '.1.2.3'],
      legend: {
        A: S('S', 'RRBRRBRRBR', 55, 20), d: DIV('W', 'E'), D: DIST(['W', 'E']),
        1: PRESS('R', 110), 2: PRESS('R', 110), 3: BIN('B')
      },
      tutorial: [{ text: 'Prensa: aceita um objeto e fica fechada até o pistão subir. Divida a linha entre as duas.', target: 'bin:0', until: 'start' }]
    },
    {
      id: '12-2', chapter: 12, name: 'Linha de Prensas', par: 4, requiresAction: true,
      map: ['Adefgv.', '.1234v.', '.....5.'],
      legend: {
        A: S('E', 'RRRRBRRRRBRR', 52, 20), d: DIV('E', 'S'), e: DIV('E', 'S'), f: DIV('E', 'S'), g: DIV('E', 'S'),
        1: PRESS('R', 150), 2: PRESS('R', 150), 3: PRESS('R', 150), 4: PRESS('R', 150), 5: BIN('B')
      },
    },
    {
      id: '12-3', chapter: 12, name: 'Fila da Prensa', par: 2, requiresAction: true,
      map: ['...A...', 'B>>+>>1', '...v...', '..vdv..', '..2.3..'],
      legend: {
        A: S('S', 'RRRRRRRRRR', 50, 20), B: S('E', 'YYYYYYYYYY', 60, 60), d: DIV('W', 'E'),
        1: BIN('Y'), 2: { type: 'bin', cat: 'R', press: 80, cap: 5 }, 3: { type: 'bin', cat: 'R', press: 80, cap: 5 }
      },
      tutorial: [{ text: 'Cada prensa aceita só 5 e demora para prensar. Reveze sem deixar a fila travar o cruzamento.', target: 'device:0', until: 'start' }]
    },
    {
      id: '12-4', chapter: 12, name: 'Prensa e Pintura', par: 4, requiresAction: true,
      map: ['A.....B', 'v.....v', 'd>p>v<e', 'v...v.v', 'v...v.v', '1...2.3'],
      legend: {
        A: S('S', 'RBBRBR', 70, 30), B: S('S', 'YRYYRY', 90, 80), d: DIV('S', 'E'), p: PAINT('E', 'R'), e: DIV('S', 'W'),
        1: BIN('R'), 2: PRESS('R', 90), 3: BIN('Y')
      },
    },
    {
      id: '12-5', chapter: 12, name: 'Linha Pesada', par: 9, requiresAction: true,
      map: ['..A.B.5', '..g.v.^', 'C>k>+>d', '..v.v.v', '.vDvev6', '.1.2.3.'],
      legend: {
        A: S('S', 'RRBBRB', 85, 0), B: S('S', 'YBYBY', 70, 20), C: S('E', 'RGGRG', 85, 10),
        g: GATE('S'), k: BRIDGE, d: DIV('N', 'S'), D: DIST(['W', 'E']), e: DIV('W', 'E'),
        1: PRESS('R', 100), 2: PRESS('B', 100), 3: BIN('Y'), 5: BIN('G'), 6: BIN('R')
      },
    },

    /* ───────────── CAPÍTULO 13 — TWO-WAY ───────────── */
    {
      id: '13-1', chapter: 13, name: 'Mão Dupla', par: 2, requiresAction: true,
      map: ['.A.B.', '.v.v.', 'vrrrv', 'v...v', '1...2'],
      legend: { A: S('S', 'BB___RR___BB', 65, 0), B: S('S', 'B___RRR___BB', 65, 60), r: REV('H'), 1: BIN('R'), 2: BIN('B') },
      tutorial: [{ text: 'Esteira reversível: toque para inverter o sentido. Ela só inverte vazia; com carga, recusa.', target: 'tile:2,2', until: 'start' }]
    },
    {
      id: '13-2', chapter: 13, name: 'Corredor Duplo', par: 4, requiresAction: true,
      map: ['...A...', '...v...', 'vrrrrrv', 'v.....v', 'v..C..v', 'v..v..v', 'vqqqqqv', 'v.....v', '1.....2'],
      legend: {
        A: S('S', 'RRR___BB___R', 55, 0), C: S('S', 'RR___BB___RR', 45, 60),
        r: REV('H'), q: REV('H', 1), 1: BIN('R'), 2: BIN('B')
      },
    },
    {
      id: '13-3', chapter: 13, name: 'Câmbio', par: 7, requiresAction: true,
      map: ['..A.B..', '..v.v..', 'vrrrrrv', 'v.....v', 'dv...ve', '12...34'],
      legend: {
        A: S('S', 'RBRB', 65, 0), B: S('S', 'YGYG', 80, 450), r: REV('H'), d: DIV('S', 'E'), e: DIV('S', 'W'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 4: BIN('G')
      },
    },
    {
      id: '13-4', chapter: 13, name: 'Retorno com Prensa', par: 9, requiresAction: true, requiresHold: true,
      map: ['..A..', '..g..', '..v..', 'vrrrv', 'v...v', 'v...v', 'v...v', '1...2'],
      legend: { A: S('S', 'RBBRRBBR', 100, 0), g: GATE('S'), r: REV('H'), 1: PRESS('R', 70), 2: PRESS('B', 70) },
      tutorial: [{ text: 'A reversível só inverte vazia. Segure o bloqueador até o trecho esvaziar, inverta e solte.', target: 'tile:2,1', until: 'start' }]
    },
    {
      id: '13-5', chapter: 13, name: 'Duas Mãos', par: 14, requiresAction: true,
      map: ['...A...', '...g...', '...v...', '.vrrrv.', '.v...v.', '.v.C.v.', '.v.v.v.', '.vqqqv.', '.v...v.', 'vd...ev', '12...34'],
      legend: {
        A: S('S', 'GBBGYRRY', 70, 0), C: S('S', 'YR___GB___RY', 60, 400), g: GATE('S'), r: REV('H'), q: REV('H', 1),
        d: DIV('S', 'W'), e: DIV('S', 'E'), 1: BIN('R'), 2: BIN('Y'), 3: BIN('G'), 4: BIN('B')
      },
    },

    /* ───────────── CAPÍTULO 14 — WILD & DEFECTS ───────────── */
    {
      id: '14-1', chapter: 14, name: 'Curinga', par: 5, requiresAction: true,
      map: ['..A..', '..v..', '.vdv.', '.v.v.', '.1.2.'],
      legend: { A: S('S', 'WBRBRWBW', 85, 20), d: DIV('W', 'E'), 1: BINC('R', 4), 2: BINC('B', 4) },
      tutorial: [{ text: 'Estrela dourada = curinga: vale em qualquer recipiente. Use para completar o que faltar.', target: 'manifest', until: 'start' }]
    },
    {
      id: '14-2', chapter: 14, name: 'Controle de Qualidade', par: 7, requiresAction: true,
      map: ['...A...', '...v..9', 'B>>+>>d', '...v..v', '..vev.3', '..1.2..'],
      legend: {
        A: S('S', 'RBWRBB', 90, 0), B: S('E', 'YXYXXY', 90, 10), d: DIV('N', 'S'), e: DIV('W', 'E'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 9: BIN('X')
      },
    },
    {
      id: '14-3', chapter: 14, name: 'Sorte Grande', par: 3, requiresAction: true,
      map: ['...A...', '...v...', '.v<d>v.', '.p...v.', '.v...v.', 'vev.vfv', '1.2.3.4'],
      legend: {
        A: S('S', 'RWBWYGWR', 85, 20), d: DIV('W', 'E'), p: PAINT('S', 'G'), e: DIV('W', 'E'), f: DIV('W', 'E'),
        1: BINC('G', 3), 2: BINC('G', 3), 3: BINC('B', 2), 4: BINC('Y', 2)
      },
    },
    {
      id: '14-4', chapter: 14, name: 'Refugo', par: 8, requiresAction: true,
      map: ['A.....B', 'v.....h', '>>>v<<<', '...v...', '..vdv..', '..v.F>9', '..1.v..', '....2..'],
      legend: {
        A: S('S', 'WRXRXR', 90, 20), B: S('S', 'BXWBXB', 90, 90), h: GATE('S'), d: DIV('W', 'E'), F: FILT('E', 'S', 'X'),
        1: BIN('R'), 2: BIN('B'), 9: BINC('X', 4)
      },
    },
    {
      id: '14-5', chapter: 14, name: 'Inspeção Final', par: 11, requiresAction: true,
      map: ['..A.B.9', '..v.g.^', 'C>k>+>e', '..v.v.v', '.vfvdvv', '.1.2.34'],
      legend: {
        A: S('S', 'RBWBR', 60, 30), B: S('S', 'WYBYB', 60, 20), C: S('E', 'WGXGXG', 90, 10),
        k: BRIDGE, g: GATE('S'), e: DIV('N', 'S'), f: FILT('W', 'E', 'RW'), d: DIV('W', 'E'),
        1: BIN('R'), 2: BINC('B', 4), 3: BIN('Y'), 4: BIN('G'), 9: BIN('X')
      },
    },

    /* ───────────── CAPÍTULO 15 — BLUEPRINT ───────────── */
    {
      id: '15-1', chapter: 15, name: 'Primeira Planta', par: 4, requiresAction: true, build: { pieces: 2 },
      map: ['..A..', '..v..', '.vd#.', '.v.#.', '.1.2.'],
      legend: { A: S('S', 'BRBRRB', 100, 20), d: DIV('W', 'E'), 1: BIN('R'), 2: BIN('B') },
      tutorial: [
        { text: 'Vagas tracejadas: toque para colocar uma esteira, toque de novo para girar. Você tem 2 peças.', target: 'tile:3,2', until: 'place', lockStart: true },
        { text: 'Monte o caminho até o recipiente azul e inicie.', target: 'start', until: 'start' }
      ]
    },
    {
      id: '15-2', chapter: 15, name: 'Ligação', par: 4, requiresAction: true, build: { pieces: 3 },
      map: ['A.....B', 'v.....v', 'v.....v', '>###..v', '...v..v', '..vdv.2', '..1.3..'],
      legend: {
        A: S('S', 'YRYRY', 110, 0), B: S('S', 'BBBBB', 70, 70), d: DIV('W', 'E'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y')
      },
    },
    {
      id: '15-3', chapter: 15, name: 'Atalho', par: 7, requiresAction: true, build: { pieces: 3 },
      map: ['..A....', '..v....', '.vdgv..', '.s.#v..', '.s.#v..', '.s.#v..', '.>>v<..', '..vev..', '..1.2..'],
      legend: {
        A: S('S', 'RBRBRBRB', 50, 20), d: DIV('W', 'E'), g: DIV('E', 'S'), s: SLOW('S'), e: DIV('W', 'E'), 1: BIN('R'), 2: BIN('B')
      },
    },
    {
      id: '15-4', chapter: 15, name: 'Engenheiro', par: 4, requiresAction: true, build: { pieces: 4 },
      map: ['...A...', '...v...', 'B>>+>>1', '...v...', '..#d#..', '..#.#..', '..3.4..'],
      legend: {
        A: S('S', 'BRBRRB', 85, 0), B: S('E', 'YYYYYY', 45, 0), d: DIV('W', 'E'),
        1: BIN('Y'), 3: BIN('R'), 4: BIN('B')
      },
    },
    {
      id: '15-5', chapter: 15, name: 'Arquiteto', par: 13, requiresAction: true, build: { pieces: 3 },
      map: ['A.....B', 'v.....v', 'd#>v<#e', 'v..v..v', 'v..#..v', 'v..v..v', '1.vfv.4', '..2.3..'],
      legend: {
        A: S('S', 'RBRYRB', 90, 0), B: S('S', 'GBGYGY', 110, 30), d: DIV('S', 'E'), e: DIV('S', 'W'), f: DIV('W', 'E'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 4: BIN('G')
      },
    },

    /* ───────────── CAPÍTULO 16 — GRAND FACTORY ───────────── */
    {
      id: '16-1', chapter: 16, name: 'Fábrica Colorida', par: 7, requiresAction: true,
      map: ['A.....B', 'v.....v', 'c>>v<<f', 'p..v..v', 'v.vdv.v', 'v.v.v.v', '1.2.3.4'],
      legend: {
        A: S('S', 'BRYRBG', 110, 30), B: S('S', 'YBGYBG', 95, 20), c: DIV('S', 'E'), p: PAINT('S', 'R'), f: FILT('S', 'W', 'G'),
        d: DIV('W', 'E'), 1: BINC('R', 4), 2: BIN('B'), 3: BIN('Y'), 4: BIN('G')
      },
    },
    {
      id: '16-2', chapter: 16, name: 'Hora do Pico', par: 7, requiresAction: true,
      map: ['...A...', '...g...', '..vDv..', '..f.s..', '..f.s..', '..>v<..', '...v...', '.v<d>v.', '.1...2.'],
      legend: {
        A: S('S', 'BRRBBRRBRB', 34, 20), g: GATE('S'), D: DIST(['W', 'E']), f: FAST('S'), s: SLOW('S'),
        d: DIV('W', 'E'), 1: PRESS('R', 70), 2: PRESS('B', 70)
      },
    },
    {
      id: '16-3', chapter: 16, name: 'Rodovia', par: 11, requiresAction: true,
      map: ['...A...', '...g...', '...v...', '.vrrrv.', '.f...f.', '.f...f.', 'vd...ev', '12...34'],
      legend: {
        A: S('S', 'BGGBRYYR', 90, 0), g: GATE('S'), r: REV('H'), f: FAST('S'), d: DIV('S', 'W'), e: DIV('S', 'E'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 4: BIN('G')
      },
    },
    {
      id: '16-4', chapter: 16, name: 'Controle Total', par: 13, requiresAction: true,
      map: ['A..B..C', 'v..h..v', '>>>v<<<', '...F>>9', '.v<f>v.', '.v...v.', 'vdv.vev', '1.2.3.4'],
      legend: {
        A: S('S', 'XRBWR', 120, 0), B: S('S', 'YGXWY', 120, 30), C: S('S', 'BGXRG', 85, 60),
        h: GATE('S'), F: FILT('E', 'S', 'X'), f: FILT('W', 'E', 'RB'), d: DIV('W', 'E'), e: DIV('W', 'E'),
        9: BIN('X'), 1: BINC('R', 3), 2: BINC('B', 3), 3: BIN('Y'), 4: BIN('G')
      },
    },
    {
      id: '16-5', chapter: 16, name: 'A Grande Fábrica', par: 9, requiresAction: true, build: { pieces: 2 },
      map: ['A..B..C', 'v..g..f', 'p>>+##v', '...v..v', '.v<F>v1', '.v...v.', 'vdv.vev', '2.3.4.5'],
      legend: {
        A: S('S', 'RBGRWBGR', 80, 0), B: S('S', 'YXGBYXGY', 85, 40), C: S('S', 'BBBBB', 70, 60),
        p: PAINT('E', 'B'), g: GATE('S'), f: FAST('S'), F: FILT('W', 'E', 'BX'), d: DIV('W', 'E'), e: DIV('W', 'E'),
        1: PRESS('B', 100), 2: BINC('B', 4), 3: BIN('X'), 4: BIN('Y'), 5: BIN('G')
      },
    }
  ];

  L.forEach(function (lv) { FF.LEVELS.push(lv); });
})(globalThis.FF = globalThis.FF || {});
