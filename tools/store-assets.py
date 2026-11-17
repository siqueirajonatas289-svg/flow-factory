#!/usr/bin/env python3
"""Gera as imagens da ficha da Google Play com o próprio jogo (Playwright + Chrome).
Uso: npm run serve  (em outro terminal)  →  python3 tools/store-assets.py
Saída: resources/store/feature-graphic-1024x500.png e screenshot-*.png (1080×1920)."""
import sys, base64, pathlib
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
OUT = pathlib.Path(__file__).resolve().parent.parent / 'resources' / 'store'
OUT.mkdir(parents=True, exist_ok=True)
FONTS = pathlib.Path(__file__).resolve().parent.parent / 'www' / 'fonts'
f800 = base64.b64encode((FONTS / 'barlow-condensed-latin-800-normal.woff2').read_bytes()).decode()
f500 = base64.b64encode((FONTS / 'barlow-latin-500-normal.woff2').read_bytes()).decode()

def unlock_all(pg):
    pg.evaluate("FF.LEVELS.forEach((L,i) => { if (i < 18) FF.Storage.recordWin(L.id, i % 4 === 0 ? 2 : 3, L.par, 12); })")

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    import json, subprocess
    ref = {r['id']: r['info']['reference'] for r in json.loads(subprocess.check_output(['node', str(pathlib.Path(__file__).parent / 'validate.js'), '--json']))}
    pg.add_init_script('window.REF = ' + json.dumps(ref) + ';')
    pg.goto(URL); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(500)
    unlock_all(pg); pg.evaluate("FF.UI.show('menu')"); pg.wait_for_timeout(1200)
    pg.screenshot(path=str(OUT / 'screenshot-1-inicio.png'))
    for name, lid, ms in [('2-producao', '5-5', 6500), ('3-cruzamentos', '4-5', 7000), ('4-distribuidor', '6-3', 6000)]:
        pg.evaluate(f"FF.Game.openLevel('{lid}')"); pg.wait_for_timeout(300)
        # joga de verdade com a solução de referência do validador, em tempo real
        pg.evaluate("""(lid) => { const G = FF.Game; G.autoplay = REF[lid];
            REF[lid].init.forEach((st, d) => { const t = G.sim.F.devices[d].type;
              if (t !== 'gate') while (G.sim.dev[d] !== st) FF.Sim.toggle(G.sim, d); });
            G.sim.planTaps = 0; }""", lid)
        pg.click('#btn-main')
        pg.evaluate("""(lid) => { const G = FF.Game, by = {};
            REF[lid].schedule.forEach(s => (by[s.tick] = by[s.tick] || []).push(s.dev));
            const orig = FF.Sim.step;
            FF.Sim.step = function (sim) { (by[sim.tick + 1] || []).forEach(d => FF.Sim.toggle(sim, d)); return orig(sim); };
            G._restoreStep = () => { FF.Sim.step = orig; }; }""", lid)
        pg.wait_for_timeout(ms)
        pg.click('#btn-main'); pg.wait_for_timeout(250)
        pg.evaluate("FF.Game._restoreStep(); document.getElementById('status-chip').classList.remove('show')")
        pg.screenshot(path=str(OUT / f'screenshot-{name}.png'))
    pg.evaluate("FF.UI.closeModal(); FF.UI.show('chapters')"); pg.wait_for_timeout(500)
    pg.screenshot(path=str(OUT / 'screenshot-5-fases.png'))
    # gráfico de destaque 1024×500
    fg = b.new_page(viewport={'width': 1024, 'height': 500})
    icon = base64.b64encode((OUT / 'play-icon-512.png').read_bytes()).decode()
    fg.set_content(f"""<html><head><style>
      @font-face {{ font-family: BC; font-weight: 800; src: url(data:font/woff2;base64,{f800}); }}
      @font-face {{ font-family: B; font-weight: 500; src: url(data:font/woff2;base64,{f500}); }}
      body {{ margin: 0; width: 1024px; height: 500px; overflow: hidden;
        background: radial-gradient(120% 120% at 25% 0%, #16285a 0%, #0c1428 45%, #070c1a 80%); color: #f2f6ff; }}
      img {{ position: absolute; left: 70px; top: 90px; width: 320px; height: 320px; border-radius: 70px; box-shadow: 0 30px 80px rgba(0,0,0,.5); }}
      h1 {{ position: absolute; left: 450px; top: 92px; margin: 0; font: 800 132px/0.84 BC; letter-spacing: -1px; }}
      h1 span {{ display: block; color: transparent; -webkit-text-stroke: 3px #f2f6ff; }}
      p {{ position: absolute; left: 454px; top: 340px; margin: 0; font: 500 30px/1.3 B; color: #8a97b2; }}
    </style></head><body><img src="data:image/png;base64,{icon}"><h1>FLOW<span>FACTORY</span></h1>
    <p>Desvie, cruze e entregue.<br>Mantenha a fábrica fluindo.</p></body></html>""")
    fg.wait_for_timeout(400)
    fg.screenshot(path=str(OUT / 'feature-graphic-1024x500.png'))
    b.close()
print('ok', sorted(x.name for x in OUT.iterdir()))
