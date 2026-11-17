/* Testes do motor de simulação (Node puro, sem dependências).
 * Uso: node tests/sim.test.js
 */
const load = require('../tools/load');
const FF = load();
const C = FF.CONFIG;
let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  ✔ ' + name); }
  catch (e) { failed++; console.log('  ✘ ' + name + '\n      ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n      ')); }
}
function assert(c, msg) { if (!c) throw new Error(msg || 'assert'); }

const src = (seq, extra) => Object.assign({ type: 'source', out: 'S', seq }, extra || {});
const bin = cat => ({ type: 'bin', cat });

function runAll(sim, onTick) { while (sim.status === 'running') { FF.Sim.step(sim); if (onTick) onTick(sim); } return sim; }
function hashState(sim) { return sim.tick + '|' + sim.items.map(i => [i.id, i.tile, i.half, i.ins, i.outs, i.p].join(',')).join(';'); }
function minDist(sim) {
  let m = Infinity; const p = {}, q = {};
  for (let i = 0; i < sim.items.length; i++) {
    FF.Geo.itemPos(sim.F, sim.items[i], p);
    for (let j = i + 1; j < sim.items.length; j++) {
      FF.Geo.itemPos(sim.F, sim.items[j], q);
      m = Math.min(m, Math.hypot(p.x - q.x, p.y - q.y));
    }
  }
  return m;
}

const L_DIV = {
  id: 't-div', name: 't', par: 9,
  map: ['..A..', '..v..', '..v..', '.vdv.', '.1.2.'],
  legend: { A: src('RRBBRB', { interval: 70 }), d: { type: 'diverter', outs: ['W', 'E'] }, 1: bin('R'), 2: bin('B') }
};

console.log('Motor de simulação');

test('objetos seguem a direção da esteira e entram no recipiente', () => {
  const L = { id: 't', map: ['A', 'v', 'v', '1'], legend: { A: src('RR'), 1: bin('R') } };
  const sim = FF.Sim.create(L); FF.Sim.start(sim);
  let lastY = -1;
  runAll(sim, s => { s.items.forEach(it => { const p = FF.Geo.itemPos(s.F, it); assert(p.y >= 0 && p.y <= 4); }); });
  assert(sim.status === 'won', 'deveria vencer: ' + sim.status);
  assert(sim.delivered === 2);
});

test('simulação determinística (mesmas ações = mesmo resultado)', () => {
  const play = () => {
    const sim = FF.Sim.create(L_DIV); FF.Sim.start(sim); const h = [];
    while (sim.status === 'running') {
      if (sim.tick % 37 === 0) FF.Sim.toggle(sim, 0);
      FF.Sim.step(sim); h.push(hashState(sim));
    }
    return h.join('\n') + sim.status;
  };
  assert(play() === play());
});

test('desviador: rota trava ao entrar no bloco; toque afeta o próximo', () => {
  const sim = FF.Sim.create(L_DIV); FF.Sim.start(sim);
  // avança até o primeiro objeto entrar no desviador
  const dTile = sim.F.devices[0].tile;
  while (!sim.items.some(i => i.tile === dTile)) FF.Sim.step(sim);
  const first = sim.items.find(i => i.tile === dTile);
  const lockedOut = first.outs;
  FF.Sim.toggle(sim, 0);
  assert(first.outs === lockedOut, 'objeto já travado não muda de rota');
  assert(sim.taps === 1, 'toque durante produção é contado');
});

test('recipiente errado = falha com motivo', () => {
  const L = { id: 't', map: ['A', 'v', '1'], legend: { A: src('B'), 1: bin('R') } };
  const sim = runAll((s => (FF.Sim.start(s), s))(FF.Sim.create(L)));
  assert(sim.status === 'failed' && sim.fail.reason === 'wrong' && sim.fail.cat === 'B');
});

test('pausa congela a simulação e retoma do mesmo ponto', () => {
  const sim = FF.Sim.create(L_DIV); FF.Sim.start(sim);
  for (let i = 0; i < 100; i++) FF.Sim.step(sim);
  const h = hashState(sim);
  FF.Sim.setPaused(sim, true);
  for (let i = 0; i < 50; i++) FF.Sim.step(sim);
  assert(hashState(sim) === h, 'nada muda pausado');
  FF.Sim.toggle(sim, 0);
  assert(sim.taps === 1, 'pode trocar desviador pausado');
  FF.Sim.setPaused(sim, false); FF.Sim.step(sim);
  assert(sim.tick === 101);
});

test('reinício recria a fase idêntica', () => {
  const a = FF.Sim.create(L_DIV); FF.Sim.start(a);
  for (let i = 0; i < 300; i++) FF.Sim.step(a);
  const b = FF.Sim.create(L_DIV);
  assert(b.tick === 0 && b.items.length === 0 && b.dev[0] === 0 && b.status === 'planning');
});

test('beco sem saída: objetos param, acumulam sem sobrepor e geram sobrecarga', () => {
  const L = { id: 't', map: ['A', 'v', 'v', '>'], legend: { A: src('RRRRRRRRRRRRRRRR', { interval: 20 }) } };
  // '>' na borda aponta para fora do mapa
  const sim = FF.Sim.create(L); FF.Sim.start(sim);
  let md = Infinity, sawWarn = false;
  runAll(sim, s => { md = Math.min(md, minDist(s)); if (s.events.some(e => e.type === 'warn')) sawWarn = true; s.events.length = 0; });
  assert(sim.status === 'failed' && sim.fail.reason === 'overload', 'falha por sobrecarga: ' + JSON.stringify(sim.fail));
  assert(sawWarn, 'alerta antes da falha');
  assert(md >= C.ITEM_SIZE - 1e-9, 'sem sobreposição: ' + md);
  assert(sim.items.length >= 6, 'acumulou ' + sim.items.length);
});

test('capacidade: no máximo 2 objetos por bloco reto', () => {
  const L = { id: 't', map: ['A', 'v', 'v', 'v', '>'], legend: { A: src('RRRRRRRRRRRR', { interval: 10 }) } };
  const sim = FF.Sim.create(L); FF.Sim.start(sim);
  let maxLoad = 0;
  runAll(sim, s => { for (let y = 1; y < 4; y++) maxLoad = Math.max(maxLoad, FF.Sim.tileLoad(s, y)); });
  assert(maxLoad <= 2, 'carga máxima ' + maxLoad);
});

test('junção em zíper: duas linhas cheias se alternam sem colisão', () => {
  const L = {
    id: 't', map: ['A...B', 'v...v', '>>v<<', '..v..', '..1..'],
    legend: { A: src('RRRRRRRR', { interval: 24 }), B: src('RRRRRRRR', { interval: 24 }), 1: bin('R') }
  };
  const sim = FF.Sim.create(L); FF.Sim.start(sim);
  let md = Infinity;
  runAll(sim, s => { md = Math.min(md, minDist(s)); });
  assert(md >= C.ITEM_SIZE - 1e-9, 'distância mínima ' + md);
  assert(sim.status === 'won' || sim.fail.reason === 'overload', sim.status);
});

test('cruzamento: linhas cruzam sem colisão e cada uma segue reto', () => {
  const L = {
    id: 't', map: ['..A..', '..v..', 'B>+>1', '..v..', '..2..'],
    legend: { A: src('BBBBBBBB', { interval: 30 }), B: { type: 'source', out: 'E', seq: 'RRRRRRRR', interval: 30 }, 1: bin('R'), 2: bin('B') }
  };
  const sim = FF.Sim.create(L); FF.Sim.start(sim);
  let md = Infinity;
  runAll(sim, s => { md = Math.min(md, minDist(s)); });
  assert(sim.status === 'won', 'vence: ' + JSON.stringify(sim.fail));
  assert(md >= C.ITEM_SIZE - 1e-9, 'distância mínima ' + md);
});

test('travamento total é detectado (nunca fica preso para sempre)', () => {
  const L = { id: 't', map: ['A', 'v', '>'], legend: { A: src('RR', { interval: 10 }) } };
  const sim = FF.Sim.create(L); FF.Sim.start(sim);
  runAll(sim);
  assert(sim.status === 'failed' && sim.fail.reason === 'gridlock', JSON.stringify(sim.fail));
});

test('estrelas: par e sobrecarga', () => {
  const sim = FF.Sim.create(L_DIV);
  const ev0 = FF.Sim.evaluate(sim);
  assert(ev0.stars === 0);
  sim.status = 'won'; sim.taps = 3; sim.peakPressure = 0;
  assert(FF.Sim.evaluate(sim).stars === 3);
  sim.peakPressure = C.HOPPER_WARN;
  assert(FF.Sim.evaluate(sim).stars === 2);
});

test('distribuidor alterna as saídas sozinho', () => {
  const L = { id: 't', map: ['.A.', '.v.', 'vDv', '1.2'],
    legend: { A: src('RRRRRR', { interval: 60 }), D: { type: 'distributor', outs: ['W', 'E'] }, 1: bin('R'), 2: bin('R') } };
  const sim = FF.Sim.create(L); FF.Sim.start(sim); runAll(sim);
  assert(sim.status === 'won', sim.status);
  assert(sim.binCount[0] === 3 && sim.binCount[1] === 3, 'divisão ' + sim.binCount);
});

test('distribuidor: toque pula para a próxima saída', () => {
  const L = { id: 't', map: ['.A.', '.v.', 'vDv', '1.2'],
    legend: { A: src('RRB', { interval: 90 }), D: { type: 'distributor', outs: ['W', 'E'] }, 1: bin('R'), 2: bin('B') } };
  const sim = FF.Sim.create(L); FF.Sim.start(sim);
  // R vai p/ W (auto -> E). 2º R precisa de W: toque antes de entrar. B então vai p/ E (auto).
  const dTile = sim.F.devices[0].tile;
  let entered = 0, tapped = false;
  while (sim.status === 'running') {
    FF.Sim.step(sim);
    const inside = sim.items.filter(i => i.tile === dTile).length;
    if (!tapped && sim.binCount[0] === 0 && sim.items.some(i => i.tile === dTile && i.half === 1)) { FF.Sim.toggle(sim, 0); tapped = true; }
  }
  assert(sim.status === 'won', JSON.stringify(sim.fail));
});

test('bloqueador fechado segura a fila e reabre sozinho em 2 s', () => {
  const L = { id: 't', map: ['A', 'v', 'g', 'v', '1'],
    legend: { A: src('RRRR', { interval: 40 }), g: { type: 'gate', out: 'S' }, 1: bin('R') } };
  const sim = FF.Sim.create(L);
  FF.Sim.toggle(sim, 0); // fecha no planejamento
  assert(sim.dev[0] === C.GATE_TICKS && sim.planTaps === 1);
  FF.Sim.start(sim);
  let md = Infinity, passedWhileClosed = false, openedAt = -1;
  const gTile = sim.F.devices[0].tile;
  runAll(sim, s => {
    md = Math.min(md, minDist(s));
    if (s.dev[0] > 0 && s.items.some(i => i.tile === gTile && i.half === 1)) passedWhileClosed = true;
    if (openedAt < 0 && s.dev[0] === 0) openedAt = s.tick;
  });
  assert(!passedWhileClosed, 'nada passa com o bloqueador fechado');
  assert(openedAt === C.GATE_TICKS, 'reabre no tick ' + openedAt);
  assert(sim.status === 'won' && md >= C.ITEM_SIZE - 1e-9);
});

test('bloqueador: toque com ele fechado reabre na hora', () => {
  const L = { id: 't', map: ['A', 'v', 'g', '1'], legend: { A: src('RR'), g: { type: 'gate', out: 'S' }, 1: bin('R') } };
  const sim = FF.Sim.create(L); FF.Sim.start(sim);
  for (let i = 0; i < 10; i++) FF.Sim.step(sim);
  FF.Sim.toggle(sim, 0); assert(sim.dev[0] > 0);
  FF.Sim.toggle(sim, 0); assert(sim.dev[0] === 0 && sim.taps === 2);
});

test('esteira lenta tem metade da vazão e gera congestionamento', () => {
  const L = { id: 't', map: ['A', 's', 's', 's', '1'],
    legend: { A: src('RRRRRRRRRRRRRRRR', { interval: 26 }), s: { type: 'slow', out: 'S' }, 1: bin('R') } };
  const sim = FF.Sim.create(L); FF.Sim.start(sim); runAll(sim);
  assert(sim.status === 'failed' && sim.fail.reason === 'overload', 'deveria sobrecarregar: ' + sim.status);
  const L2 = JSON.parse(JSON.stringify(L)); L2.legend.A.interval = 60;
  const ok = FF.Sim.create(L2); FF.Sim.start(ok); runAll(ok);
  assert(ok.status === 'won', 'ritmo menor passa');
});

test('validador: solução com bloqueador e com distribuidor é reproduzida', () => {
  const { solve, replay } = require('../tools/solver');
  const L = { id: 't', par: 9, map: ['A...B', 'v...v', 'v...g', '>>v<<', '..v..', '.vdv.', '.1.2.'],
    legend: { A: src('RRR', { interval: 44 }), B: src('BBB', { interval: 44, delay: 60 }),
      g: { type: 'gate', out: 'S' }, d: { type: 'diverter', outs: ['W', 'E'] }, 1: bin('R'), 2: bin('B') } };
  const r = solve(L);
  assert(r.bestClean, 'tem solução');
  const sim = replay(L, r.bestClean);
  assert(sim.status === 'won', 'replay ' + sim.status);
  const noGate = solve(L, { maxHolds: 0 });
  assert(!noGate.bestClean, 'sem o bloqueador não há solução limpa');
});

test('fuzz: toques aleatórios em todas as fases nunca quebram nem sobrepõem', () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (const L of FF.LEVELS) {
    for (let run = 0; run < 25; run++) {
      const sim = FF.Sim.create(L); FF.Sim.start(sim);
      let md = Infinity;
      while (sim.status === 'running') {
        if (sim.F.devices.length && rnd() < 0.02) FF.Sim.toggle(sim, Math.floor(rnd() * sim.F.devices.length));
        if (rnd() < 0.002) { FF.Sim.setPaused(sim, true); FF.Sim.setPaused(sim, false); }
        FF.Sim.step(sim);
        if (sim.tick % 3 === 0) md = Math.min(md, minDist(sim));
      }
      assert(sim.status === 'won' || sim.status === 'failed', L.id + ' terminou em ' + sim.status);
      assert(md >= C.ITEM_SIZE - 1e-9, L.id + ' sobreposição ' + md);
    }
  }
});

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
