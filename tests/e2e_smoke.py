import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
OUT = '/tmp/shots'
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.goto(URL); pg.wait_for_timeout(800)
    pg.screenshot(path=f'{OUT}/01-menu.png')
    pg.click('#btn-levels'); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/02-chapters.png')
    pg.click('[data-level="1-1"]'); pg.wait_for_timeout(500)
    pg.screenshot(path=f'{OUT}/03-game-planning.png')
    pg.click('#btn-main'); pg.wait_for_timeout(2500)
    pg.screenshot(path=f'{OUT}/04-game-running.png')
    pg.wait_for_selector('.sheet.win', timeout=20000); pg.wait_for_timeout(1200)
    pg.screenshot(path=f'{OUT}/05-win.png')
    print('save', pg.evaluate("localStorage.getItem('flowfactory.save.v1')"))
    b.close()
print('ERRORS', json.dumps(errors, ensure_ascii=False))
