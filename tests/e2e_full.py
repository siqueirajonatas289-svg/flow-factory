"""Teste ponta a ponta no navegador (Playwright, viewport de celular).
Uso: python3 tests/e2e_full.py [URL] [arquivo-json-do-validador]
"""
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
VAL = json.load(open(sys.argv[2] if len(sys.argv) > 2 else '/tmp/val.json'))
OUT = '/tmp/shots'
errors, results = [], []

def check(name, cond, extra=''):
    results.append((name, bool(cond), extra))
    print(('  ✔ ' if cond else '  ✘ ') + name + (' ' + str(extra) if extra and not cond else ''))

def tap_device(pg, d):
    pos = pg.evaluate(f"""(() => {{ const G = FF.Game, t = G.sim.F.devices[{d}].tile, c = G.R.tileCenter(t);
        const r = G.R.cv.getBoundingClientRect(); return [r.left + c.x, r.top + c.y]; }})()""")
    pg.touchscreen.tap(pos[0], pos[1])

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.goto(URL); pg.wait_for_timeout(500)

    print('Fase 1-2: tutorial + toque real no desviador')
    pg.click('#btn-play'); pg.wait_for_timeout(300)
    check('Jogar abre a fase 1-1 num save novo', pg.inner_text('#hud-code') == '1-1')
    pg.evaluate("FF.Storage.recordWin('1-1', 3, 0, 10)")
    pg.evaluate("FF.Game.openLevel('1-2')"); pg.wait_for_timeout(300)
    check('Iniciar bloqueado até tocar no desviador (tutorial)', pg.is_disabled('#btn-main'))
    pg.screenshot(path=f'{OUT}/10-1-2-tutorial.png')
    tap_device(pg, 0); pg.wait_for_timeout(300)
    check('Toque no desviador troca o estado', pg.evaluate('FF.Game.sim.dev[0]') == 1)
    check('Toque no planejamento não conta como intervenção', pg.evaluate('FF.Game.sim.taps') == 0)
    check('Iniciar liberado após o toque', not pg.is_disabled('#btn-main'))
    pg.click('#btn-main'); pg.wait_for_timeout(1800)
    pg.screenshot(path=f'{OUT}/11-1-2-running.png')
    check('Produção rodando', pg.evaluate('FF.Game.sim.status') == 'running')
    pg.click('#btn-main'); pg.wait_for_timeout(300)
    t1 = pg.evaluate('FF.Game.sim.tick'); pg.wait_for_timeout(500); t2 = pg.evaluate('FF.Game.sim.tick')
    check('Botão principal pausa (tick congelado)', t1 == t2 and pg.evaluate('FF.Game.sim.status') == 'paused')
    pg.click('#btn-main')
    pg.wait_for_selector('.sheet.win', timeout=20000); pg.wait_for_timeout(1300)
    check('Vitória reconhecida na 1-2', pg.evaluate('FF.Game.sim.status') == 'won')
    check('3 estrelas exibidas', pg.locator('#big-stars .bst.on').count() == 3)
    pg.click('[data-act="next"]'); pg.wait_for_timeout(300)
    check('Próxima fase abre a 1-3', pg.inner_text('#hud-code') == '1-3')

    print('Fase 1-3: falha por recipiente errado + reinício')
    pg.click('#btn-main')
    pg.wait_for_selector('.sheet.fail', timeout=30000); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/12-fail-wrong.png')
    check('Falha reconhecida com motivo', 'Recipiente errado' in pg.inner_text('.sheet'))
    pg.click('[data-act="retry"]'); pg.wait_for_timeout(300)
    check('Reinício restaura a fase', pg.evaluate('[FF.Game.sim.status, FF.Game.sim.tick, FF.Game.sim.items.length, FF.Game.sim.dev[0]]') == ['planning', 0, 0, 0])

    print('Pausa e configurações')
    pg.click('#btn-main'); pg.wait_for_timeout(600)
    pg.click('#btn-pause'); pg.wait_for_timeout(300)
    check('Menu de pausa abre e pausa', pg.is_visible('.sheet.pause') and pg.evaluate('FF.Game.sim.status') == 'paused')
    pg.screenshot(path=f'{OUT}/13-pause.png')
    pg.click('[data-act="settings"]'); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/14-settings.png')
    pg.click('label.toggle:has(input[data-setting="music"])'); pg.wait_for_timeout(200)
    check('Música desligada e salva', pg.evaluate("JSON.parse(localStorage.getItem('flowfactory.save.v1')).settings.music") is False)
    pg.click('[data-act="settings-close"]'); pg.wait_for_timeout(200)
    check('Pronto volta ao menu de pausa', pg.is_visible('.sheet.pause'))
    pg.click('[data-act="resume"]'); pg.wait_for_timeout(300)
    check('Continuar retoma', pg.evaluate('FF.Game.sim.status') == 'running')

    print('Todas as fases: replay da solução de referência dentro do jogo')
    for rep in VAL:
        lid, ref = rep['id'], rep['info']['reference']
        pg.evaluate(f"FF.Game.openLevel('{lid}')"); pg.wait_for_timeout(250)
        pg.screenshot(path=f'{OUT}/20-{lid}-planning.png')
        status = pg.evaluate(f"""(() => {{
            const sim = FF.Game.sim, ref = {json.dumps(ref)};
            ref.init.forEach((st, d) => {{ while (sim.dev[d] !== st) FF.Sim.toggle(sim, d); }});
            FF.Sim.start(sim);
            const by = {{}}; ref.schedule.forEach(s => (by[s.tick] = by[s.tick] || []).push(s.dev));
            let guard = 0;
            while (sim.status === 'running' && guard++ < 40000) {{
              (by[sim.tick + 1] || []).forEach(d => FF.Sim.toggle(sim, d));
              FF.Sim.step(sim);
              if (sim.tick === 600) break;
            }}
            if (sim.status === 'running') sim.status = 'paused';
            return sim.status;
        }})()""")
        pg.wait_for_timeout(120)
        pg.screenshot(path=f'{OUT}/21-{lid}-mid.png')
        status = pg.evaluate(f"""(() => {{
            const sim = FF.Game.sim, ref = {json.dumps(ref)};
            const by = {{}}; ref.schedule.forEach(s => (by[s.tick] = by[s.tick] || []).push(s.dev));
            if (sim.status === 'paused') sim.status = 'running';
            let guard = 0;
            while (sim.status === 'running' && guard++ < 40000) {{
              (by[sim.tick + 1] || []).forEach(d => FF.Sim.toggle(sim, d));
              FF.Sim.step(sim);
            }}
            return sim.status;
        }})()""")
        pg.wait_for_selector('.sheet.win', timeout=5000)
        stars = pg.evaluate('FF.Storage.levelResult(%r).stars' % lid)
        check(f'{lid}: solução de referência vence no jogo com 3 estrelas', status == 'won' and stars == 3, (status, stars))
    pg.screenshot(path=f'{OUT}/22-last-win.png')

    print('Congestionamento: fase de teste com beco sem saída')
    pg.evaluate("""FF.LEVELS.push({ id: 'T-1', chapter: 99, name: 'Teste de sobrecarga', par: 0,
        map: ['.A.', '.v.', '.v.', '.v>'], legend: { A: { type: 'source', out: 'S', seq: 'RRRRRRRRRRRR', interval: 30 } } });
        FF.Game.openLevel('T-1'); FF.Sim.start(FF.Game.sim);""")
    pg.wait_for_function('FF.Game.sim.src[0].pressure >= 2', timeout=15000)
    pg.screenshot(path=f'{OUT}/30-congestion.png')
    check('Alerta de sobrecarga antes da falha', pg.evaluate("FF.Game.sim.status") == 'running')
    pg.wait_for_selector('.sheet.fail', timeout=15000); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/31-overload-fail.png')
    check('Falha por sobrecarga com explicação', 'sobrecarregada' in pg.inner_text('.sheet'))

    print('Bloqueador e distribuidor por toque real')
    pg.evaluate("FF.Game.openLevel('3-2')"); pg.wait_for_timeout(250)
    pg.click('#btn-main'); pg.wait_for_timeout(400)
    tap_device(pg, 0); pg.wait_for_timeout(100)
    until = pg.evaluate('FF.Game.sim.dev[0]'); now = pg.evaluate('FF.Game.sim.tick')
    check('Toque fecha o bloqueador por 2 s', until > 0 and 110 <= until - now <= 120, (until, now))
    pg.wait_for_function('FF.Game.sim.dev[0] === 0', timeout=6000)
    check('Bloqueador reabre sozinho no prazo', pg.evaluate('FF.Game.sim.gateOpened[0]') == until, (pg.evaluate('FF.Game.sim.gateOpened[0]'), until))
    pg.evaluate("FF.Game.openLevel('3-3')"); pg.wait_for_timeout(250)
    st0 = pg.evaluate('FF.Game.sim.dev[0]'); tap_device(pg, 0); pg.wait_for_timeout(100)
    check('Toque avança o distribuidor', pg.evaluate('FF.Game.sim.dev[0]') == (st0 + 1) % 2)

    print('Botão Voltar (mesma lógica do Android)')
    pg.click('#btn-main'); pg.wait_for_timeout(300)
    pg.evaluate('FF.Game.back()'); pg.wait_for_timeout(200)
    check('Voltar na fase abre a pausa', pg.is_visible('.sheet.pause') and pg.evaluate('FF.Game.sim.status') == 'paused')
    pg.evaluate('FF.Game.back()'); pg.wait_for_timeout(200)
    check('Voltar na pausa continua a produção', not pg.is_visible('.sheet.pause') and pg.evaluate('FF.Game.sim.status') == 'running')
    pg.evaluate("FF.UI.show('chapters')"); pg.evaluate('FF.Game.back()'); pg.wait_for_timeout(200)
    check('Voltar nas fases vai ao início', pg.is_visible('#scr-menu'))
    exited = pg.evaluate('(() => { let ex = false; FF.Game.back(() => { ex = true; }); return ex; })()')
    check('Voltar no início sai do app', exited)

    print('Persistência')
    pg.reload(); pg.wait_for_timeout(500)
    check('Progresso sobrevive ao recarregar', pg.evaluate("FF.Storage.totals().done") == len(VAL))
    pg.screenshot(path=f'{OUT}/40-menu-after.png')
    pg.click('#btn-levels'); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/41-chapters-after.png')

    print('Tela pequena (320x568)')
    small = b.new_context(viewport={'width': 320, 'height': 568}, device_scale_factor=2, is_mobile=True, has_touch=True)
    sp = small.new_page(); sp.on('pageerror', lambda e: errors.append('PAGEERROR small ' + str(e)))
    sp.goto(URL); sp.wait_for_timeout(300)
    sp.screenshot(path=f'{OUT}/50-small-menu.png')
    sp.evaluate("FF.Game.openLevel('2-5')"); sp.wait_for_timeout(300)
    sp.screenshot(path=f'{OUT}/51-small-2-5.png')
    ts = sp.evaluate('FF.Game.R.ts')
    check('Blocos com tamanho tocável em tela pequena (>= 36px)', ts >= 36, ts)
    over = sp.evaluate("document.querySelector('.controls').getBoundingClientRect().bottom <= innerHeight + 1")
    check('Controles visíveis sem rolar', over)
    b.close()

check('Sem erros no console', not errors, errors)
bad = [r for r in results if not r[1]]
print(f'\n{len(results) - len(bad)}/{len(results)} verificações passaram')
sys.exit(1 if bad else 0)
