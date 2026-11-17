/* FLOW FACTORY — levels.js
 * Campanha. Cada fase é validada por `node tools/validate.js`.
 *
 * Mapa: '.' vazio | '^ > v <' esteira (direção da saída) | '+' cruzamento
 * Legenda:
 *   source  { out, seq, interval?, delay? }   seq = ordem de produção (R B Y G)
 *   bin     { cat }
 *   diverter{ outs: [A, B], state? }           toque alterna entre A e B
 * par: meta de intervenções durante a produção para a 3ª estrela
 *      (confirmada pelo validador como alcançável).
 * tutorial: passos curtos; `until` = start | toggle | deliver | win;
 *      `target` = start | pause | manifest | device:N | bin:N | source:N
 */
(function (FF) {
  'use strict';

  var S = function (out, seq, interval, delay) {
    var s = { type: 'source', out: out, seq: seq };
    if (interval) s.interval = interval;
    if (delay !== undefined) s.delay = delay;
    return s;
  };
  var BIN = function (cat) { return { type: 'bin', cat: cat }; };
  var DIV = function (a, b, state) { return { type: 'diverter', outs: [a, b], state: state || 0 }; };
  var DIST = function (outs, state) { return { type: 'distributor', outs: outs, state: state || 0 }; };
  var GATE = function (out) { return { type: 'gate', out: out }; };
  var SLOW = function (out) { return { type: 'slow', out: out }; };

  FF.CHAPTERS = [
    { id: 1, name: 'FIRST SHIFT', subtitle: 'Fundamentos da linha de produção' },
    { id: 2, name: 'NEW ROUTES', subtitle: 'Desvios em cascata, junções e cruzamentos' },
    { id: 3, name: 'OVERLOAD', subtitle: 'Gargalos, bloqueadores e distribuidores' },
    { id: 4, name: 'CROSSING LINES', subtitle: 'Linhas que se cruzam e disputam passagem' },
    { id: 5, name: 'FACTORY CHAOS', subtitle: 'Três linhas, quatro cores, nenhum descanso' },
    { id: 6, name: 'MASTER OPERATOR', subtitle: 'Tudo o que você aprendeu, ao mesmo tempo' }
  ];

  FF.LEVELS = [
    /* ───────────── CAPÍTULO 1 — FIRST SHIFT ───────────── */
    {
      id: '1-1', chapter: 1, name: 'Primeiro Turno', par: 0,
      map: [
        '.A...',
        '.v...',
        '.v...',
        '.>>v.',
        '...v.',
        '...1.'
      ],
      legend: { A: S('S', 'RRRR', 90, 20), 1: BIN('R') },
      tutorial: [
        { text: 'Toque em INICIAR para ligar a produção.', target: 'start', until: 'start' },
        { text: 'Cada objeto precisa chegar ao recipiente da mesma cor e forma.', target: 'bin:0', until: 'win' }
      ]
    },
    {
      id: '1-2', chapter: 1, name: 'O Desviador', par: 0, requiresAction: true,
      map: [
        '..A..',
        '..v..',
        '..v..',
        '.vdv.',
        '.v.v.',
        '.1.2.'
      ],
      legend: { A: S('S', 'BBBB', 90, 20), d: DIV('W', 'E'), 1: BIN('R'), 2: BIN('B') },
      tutorial: [
        { text: 'Isto é um desviador. Toque nele para trocar a saída.', target: 'device:0', until: 'toggle', lockStart: true },
        { text: 'A seta agora aponta para o recipiente azul. Toque em INICIAR.', target: 'start', until: 'start' }
      ]
    },
    {
      id: '1-3', chapter: 1, name: 'Troca de Turno', par: 1, requiresAction: true,
      map: [
        'A....',
        'v....',
        'v....',
        'd>>v.',
        'v..v.',
        '1..2.'
      ],
      legend: { A: S('S', 'RRRBBB', 100, 20), d: DIV('S', 'E'), 1: BIN('R'), 2: BIN('B') },
      tutorial: [
        { text: 'A fila no topo mostra a ordem de produção. Toque em INICIAR.', target: 'manifest', until: 'start' },
        { text: 'Quando chegarem os azuis, toque no desviador — antes que entrem nele.', target: 'device:0', until: 'toggle' }
      ]
    },
    {
      id: '1-4', chapter: 1, name: 'Alternância', par: 5, requiresAction: true,
      map: [
        '...A...',
        '...v...',
        '.v<d>v.',
        '.v...v.',
        '.v...v.',
        '.1...2.'
      ],
      legend: { A: S('S', 'YBBYBYYB', 110, 20), d: DIV('W', 'E'), 1: BIN('Y'), 2: BIN('B') },
      tutorial: [
        { text: 'A rota trava quando o objeto entra no desviador. Use ⏸ se precisar pensar.', target: 'pause', until: 'toggle' }
      ]
    },
    {
      id: '1-5', chapter: 1, name: 'Duas Linhas', par: 6, requiresAction: true,
      map: [
        '.A...B.',
        '.v...v.',
        '.v...v.',
        'vdv.vev',
        'v.v.v.v',
        '1.2.3.4'
      ],
      legend: {
        A: S('S', 'RBBRRB', 120, 20), B: S('S', 'YGYYGG', 120, 80),
        d: DIV('W', 'E'), e: DIV('W', 'E'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 4: BIN('G')
      },
      tutorial: [
        { text: 'Duas linhas ao mesmo tempo! Cada uma tem seu desviador.', target: 'manifest', until: 'start' }
      ]
    },

    /* ───────────── CAPÍTULO 2 — NEW ROUTES ───────────── */
    {
      id: '2-1', chapter: 2, name: 'Cascata', par: 5, requiresAction: true,
      map: [
        '..A...',
        '..v...',
        '.vd>v.',
        '.v.vev',
        '.1.2.3'
      ],
      legend: {
        A: S('S', 'RYBBYRY', 110, 20), d: DIV('W', 'E'), e: DIV('W', 'E', 1),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y')
      },
      tutorial: [
        { text: 'Desviadores em sequência: o primeiro escolhe o lado, o segundo escolhe o recipiente.', target: 'device:1', until: 'start' }
      ]
    },
    {
      id: '2-2', chapter: 2, name: 'Ponto de Encontro', par: 4, requiresAction: true,
      map: [
        'A.....B',
        'v.....v',
        '>>>v<<<',
        '...v...',
        '..vdv..',
        '..1.2..'
      ],
      legend: {
        A: S('S', 'RBRB', 120, 20), B: S('S', 'BRBR', 120, 140),
        d: DIV('W', 'E'), 1: BIN('R'), 2: BIN('B')
      },
      tutorial: [
        { text: 'As linhas se juntam. Na junção, quem chega primeiro passa primeiro.', target: 'manifest', until: 'start' }
      ]
    },
    {
      id: '2-3', chapter: 2, name: 'Recipiente Compartilhado', par: 7, requiresAction: true,
      map: [
        '.A...B.',
        '.v...v.',
        '.v...v.',
        'vd>v<ev',
        'v..v..v',
        '1..2..3'
      ],
      legend: {
        A: S('S', 'RBRRBB', 110, 20), B: S('S', 'YBYBBY', 120, 70),
        d: DIV('W', 'E'), e: DIV('E', 'W'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y')
      }
    },
    {
      id: '2-4', chapter: 2, name: 'Primeiro Cruzamento', par: 5, requiresAction: true,
      map: [
        '...A..1',
        '...v..^',
        'B>>+>>e',
        '...v..v',
        '...v..2',
        '..vdv..',
        '..3.4..'
      ],
      legend: {
        A: S('S', 'RBBRB', 110, 20), B: S('E', 'YGGYY', 110, 50),
        d: DIV('W', 'E'), e: DIV('N', 'S'),
        1: BIN('Y'), 2: BIN('G'), 3: BIN('R'), 4: BIN('B')
      },
      tutorial: [
        { text: 'Cruzamento: cada objeto segue reto. Se dois chegam juntos, o primeiro passa e o outro espera.', target: 'start', until: 'start' }
      ]
    },
    {
      id: '2-5', chapter: 2, name: 'Hora do Rush', par: 8, requiresAction: true,
      map: [
        '.1A....',
        '.^v....',
        '.^v....',
        '.e+<<<B',
        '.vv....',
        '.vdv...',
        '.2.3...'
      ],
      legend: {
        A: S('S', 'RBRBBR', 110, 20), B: S('W', 'YBYYBY', 120, 60),
        d: DIV('E', 'W'), e: DIV('N', 'S'),
        1: BIN('Y'), 2: BIN('B'), 3: BIN('R')
      }
    },

    /* ───────────── CAPÍTULO 3 — OVERLOAD ───────────── */
    {
      id: '3-1', chapter: 3, name: 'Esteira Lenta', par: 0, requiresAction: true,
      map: [
        '..A...',
        '..v...',
        '.vd>v.',
        '.s..v.',
        '.1..v.',
        '....v.',
        '....2.'
      ],
      legend: { A: S('S', 'RRRRRRRRRRRRRRRRRRRRRRRR', 26, 20), d: DIV('W', 'E'), s: SLOW('S'), 1: BIN('R'), 2: BIN('R') },
      tutorial: [
        { text: 'Divisas âmbar = esteira lenta: ela não dá conta deste ritmo. Os traços na fonte mostram o depósito enchendo.', target: 'device:0', until: 'start' }
      ]
    },
    {
      id: '3-2', chapter: 3, name: 'Bloqueador', par: 2, requiresAction: true, requiresHold: true,
      map: [
        'A.....B',
        'v.....v',
        'v.....g',
        '>>>v<<<',
        '...v...',
        '..vdv..',
        '..1.2..'
      ],
      legend: {
        A: S('S', 'RRR', 44, 20), B: S('S', 'BBB', 44, 60),
        g: GATE('S'), d: DIV('W', 'E'), 1: BIN('R'), 2: BIN('B')
      },
      tutorial: [
        { text: 'As linhas vão se misturar rápido demais. Toque no bloqueador para segurar a linha B por 2 segundos.', target: 'device:0', until: 'toggle' }
      ]
    },
    {
      id: '3-3', chapter: 3, name: 'Distribuidor', par: 0, requiresAction: true,
      map: [
        '..A..',
        '..v..',
        '.vDv.',
        '.v.v.',
        '.1.2.'
      ],
      legend: { A: S('S', 'RBRBRBRB', 60, 20), D: DIST(['W', 'E'], 1), 1: BIN('R'), 2: BIN('B') },
      tutorial: [
        { text: 'O distribuidor alterna sozinho: esquerda, direita, esquerda... O ponto cheio é a próxima saída. Toque para pular uma.', target: 'device:0', until: 'start' }
      ]
    },
    {
      id: '3-4', chapter: 3, name: 'Fora do Ritmo', par: 3, requiresAction: true,
      map: [
        '..A..',
        '..v..',
        '.vDv.',
        '.vvv.',
        '.123.'
      ],
      legend: { A: S('S', 'RYBRYBBRYRYBR', 80, 20), D: DIST(['W', 'S', 'E']), 1: BIN('R'), 2: BIN('Y'), 3: BIN('B') }
    },
    {
      id: '3-5', chapter: 3, name: 'Hora Extra', par: 8, requiresAction: true, requiresHold: true,
      map: [
        'A.....B',
        'v.....v',
        'D>>v..g',
        's..v..v',
        's..v<<<',
        's.vdv..',
        '1.2.3..'
      ],
      legend: {
        A: S('S', 'RBRBRBBR', 65, 20), B: S('S', 'YBYYB', 70, 150),
        D: DIST(['S', 'E']), d: DIV('W', 'E'), g: GATE('S'), s: SLOW('S'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y')
      }
    },

    /* ───────────── CAPÍTULO 4 — CROSSING LINES ───────────── */
    {
      id: '4-1', chapter: 4, name: 'Distribuição Cruzada', par: 2, requiresAction: true,
      map: [
        '...A...',
        '...v...',
        '..vDv..',
        '..v.v..',
        'B>+>+>1',
        '..v.v..',
        '..2.3..'
      ],
      legend: {
        A: S('S', 'RBRRBRBB', 60, 30), B: S('E', 'YYYYYY', 30, 30),
        D: DIST(['W', 'E']), 1: BIN('Y'), 2: BIN('R'), 3: BIN('B')
      }
    },
    {
      id: '4-2', chapter: 4, name: 'Troca de Faixa', par: 4, requiresAction: true,
      map: [
        'A.....B',
        'v.....v',
        'd>>>v.v',
        's...v.v',
        's.v<+<e',
        's.v.v.v',
        '1.2.3.4'
      ],
      legend: {
        A: S('S', 'RRRRRRRR', 36, 0), B: S('S', 'BYYBYB', 100, 0),
        d: DIV('S', 'E'), e: DIV('W', 'S'), s: SLOW('S'),
        1: BIN('R'), 2: BIN('Y'), 3: BIN('R'), 4: BIN('B')
      }
    },
    {
      id: '4-3', chapter: 4, name: 'Sinal Vermelho', par: 5, requiresAction: true,
      map: [
        '...A...',
        '...g...',
        'B>>+>>1',
        '...v...',
        '..vdv..',
        '..s.v..',
        '..2.3..'
      ],
      legend: {
        A: S('S', 'YYBYYB', 60, 30), B: S('E', 'RRRRRR', 30, 30),
        g: GATE('S'), d: DIV('W', 'E'), s: SLOW('S'),
        1: BIN('R'), 2: BIN('Y'), 3: BIN('B')
      }
    },
    {
      id: '4-4', chapter: 4, name: 'Duplo Cruzamento', par: 6, requiresAction: true,
      map: [
        '...A...',
        '...v...',
        'B>>+>>v',
        '...v..v',
        '...v..v',
        've<+<<<',
        'vvvdv..',
        '123.4..'
      ],
      legend: {
        A: S('S', 'RBRRB', 110, 60), B: S('E', 'YGYGG', 110, 20),
        d: DIV('W', 'E'), e: DIV('W', 'S'),
        1: BIN('Y'), 2: BIN('G'), 3: BIN('R'), 4: BIN('B')
      }
    },
    {
      id: '4-5', chapter: 4, name: 'Encruzilhada', par: 9, requiresAction: true,
      map: [
        '..A.B.5',
        '..v.v.^',
        '..v.v.^',
        'C>+>+>f',
        '..v.v.v',
        '.vdvevv',
        '.1.2.34'
      ],
      legend: {
        A: S('S', 'RBRBB', 130, 0), B: S('S', 'BYBYY', 110, 100), C: S('E', 'GRGGR', 110, 40),
        d: DIV('W', 'E'), e: DIV('W', 'E'), f: DIV('N', 'S'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 4: BIN('R'), 5: BIN('G')
      }
    },

    /* ───────────── CAPÍTULO 5 — FACTORY CHAOS ───────────── */
    {
      id: '5-1', chapter: 5, name: 'Pico de Produção', par: 5, requiresAction: true,
      map: [
        '...A...',
        '...v...',
        '..vDv..',
        '..vvv..',
        'B>+++>1',
        '..vvv..',
        '..234..'
      ],
      legend: {
        A: S('S', 'RBYBRYRBYYR', 70, 0), B: S('E', 'GGGGGG', 60, 0),
        D: DIST(['W', 'S', 'E']),
        1: BIN('G'), 2: BIN('R'), 3: BIN('B'), 4: BIN('Y')
      }
    },
    {
      id: '5-2', chapter: 5, name: 'Três Turnos', par: 9, requiresAction: true,
      map: [
        'A..B..C',
        'v..v..v',
        'd>vev<f',
        'v.v.v.v',
        '1.2.3.4'
      ],
      legend: {
        A: S('S', 'BRRBR', 100, 0), B: S('S', 'BYBY', 120, 60), C: S('S', 'GYGY', 100, 40),
        d: DIV('S', 'E'), e: DIV('W', 'E'), f: DIV('S', 'W'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 4: BIN('G')
      }
    },
    {
      id: '5-3', chapter: 5, name: 'Gargalo Central', par: 10, requiresAction: true,
      map: [
        'A..B..C',
        'v..v..v',
        '>>>v<<<',
        '...s...',
        '.vdDev.',
        '.vv.vv.',
        '.12.34.'
      ],
      legend: {
        A: S('S', 'RBRBR', 110, 30), B: S('S', 'YBBR', 130, 20), C: S('S', 'BYYB', 130, 40),
        s: SLOW('S'), D: DIST(['W', 'E']), d: DIV('W', 'S'), e: DIV('S', 'E'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('B'), 4: BIN('Y')
      }
    },
    {
      id: '5-4', chapter: 5, name: 'Linha de Montagem', par: 12, requiresAction: true,
      map: [
        'A..B..C',
        'v..g..v',
        '>>>v<<<',
        '...v...',
        '.vedfv.',
        '.vv.vv.',
        '.12.34.'
      ],
      legend: {
        A: S('S', 'BRRB', 160, 0), B: S('S', 'BG', 140, 250), C: S('S', 'YGYG', 190, 50),
        g: GATE('S'), d: DIV('W', 'E'), e: DIV('W', 'S'), f: DIV('S', 'E'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 4: BIN('G')
      }
    },
    {
      id: '5-5', chapter: 5, name: 'Caos Controlado', par: 8, requiresAction: true,
      map: [
        '..A.B.5',
        '..g.v.^',
        '..v.v.^',
        'C>+>+>f',
        '..v.s.v',
        '.vdvDvv',
        '.1.2.34'
      ],
      legend: {
        A: S('S', 'RRBRB', 90, 30), B: S('S', 'YBBY', 110, 60), C: S('E', 'GRGRG', 110, 40),
        g: GATE('S'), s: SLOW('S'), d: DIV('W', 'E'), D: DIST(['W', 'E']), f: DIV('N', 'S'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 4: BIN('R'), 5: BIN('G')
      }
    },

    /* ───────────── CAPÍTULO 6 — MASTER OPERATOR ───────────── */
    {
      id: '6-1', chapter: 6, name: 'Controle de Tráfego', par: 4, requiresAction: true, requiresHold: true,
      map: [
        'A.B.C.E',
        'v.g.v.h',
        '>>v.>>v',
        '1.v...v',
        'e<+<<<<',
        'vvdv...',
        '23.4...'
      ],
      legend: {
        A: S('S', 'RRR', 44, 0), B: S('S', 'BBB', 44, 200),
        C: S('S', 'YYY', 44, 200), E: S('S', 'GGG', 44, 400),
        g: GATE('S'), h: GATE('S'), d: DIV('W', 'E'), e: DIV('N', 'S'),
        1: BIN('Y'), 2: BIN('G'), 3: BIN('R'), 4: BIN('B')
      }
    },
    {
      id: '6-2', chapter: 6, name: 'Expresso Duplo', par: 5, requiresAction: true,
      map: [
        'A.....B',
        'v.....v',
        'd>>v<<e',
        's..v..s',
        'v.vfv.v',
        'v.v.v.v',
        '1.2.3.4'
      ],
      legend: {
        A: S('S', 'RRGRRG', 110, 0), B: S('S', 'GRGRGG', 110, 35),
        d: DIV('S', 'E'), e: DIV('S', 'W'), f: DIV('W', 'E'), s: SLOW('S'),
        1: BIN('R'), 2: BIN('R'), 3: BIN('G'), 4: BIN('G')
      }
    },
    {
      id: '6-3', chapter: 6, name: 'Relojoaria', par: 7, requiresAction: true,
      map: [
        '...A...',
        '...g...',
        '.v<D>v.',
        '.v...v.',
        'vEv.vFv',
        'v.v.v.v',
        '1.2.3.4'
      ],
      legend: {
        A: S('S', 'RYBGBRGYRYGB', 60, 0),
        g: GATE('S'), D: DIST(['W', 'E']), E: DIST(['W', 'E']), F: DIST(['W', 'E']),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 4: BIN('G')
      }
    },
    {
      id: '6-4', chapter: 6, name: 'Serpentina', par: 10, requiresAction: true,
      map: [
        'A>>>>>v',
        '2.B...v',
        'e<+<<<d',
        'v.v...v',
        '>>+>fv1',
        '..v.vv.',
        '..5.34.'
      ],
      legend: {
        A: S('E', 'GRBYYBRG', 90, 30), B: S('S', 'YYYYY', 80, 120),
        d: DIV('W', 'S'), e: DIV('S', 'N'), f: DIV('S', 'E'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 4: BIN('G'), 5: BIN('Y')
      }
    },
    {
      id: '6-5', chapter: 6, name: 'Mestre da Fábrica', par: 11, requiresAction: true,
      map: [
        'A..B..C',
        'v..g..v',
        'v..v..v',
        '>>>+>>v',
        '...v..s',
        'vd<+<<D',
        'vvvev.v',
        '123.4.5'
      ],
      legend: {
        A: S('S', 'GRRB', 130, 30), B: S('S', 'BYYB', 80, 70), C: S('S', 'GGRB', 90, 150),
        g: GATE('S'), s: SLOW('S'), D: DIST(['W', 'S']), d: DIV('W', 'S'), e: DIV('W', 'E'),
        1: BIN('R'), 2: BIN('B'), 3: BIN('Y'), 4: BIN('B'), 5: BIN('G')
      }
    }
];

  FF.levelById = function (id) {
    for (var i = 0; i < FF.LEVELS.length; i++) if (FF.LEVELS[i].id === id) return FF.LEVELS[i];
    return null;
  };
  FF.levelIndex = function (id) {
    for (var i = 0; i < FF.LEVELS.length; i++) if (FF.LEVELS[i].id === id) return i;
    return -1;
  };
})(globalThis.FF = globalThis.FF || {});
