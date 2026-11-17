#!/usr/bin/env python3
"""Calibra várias fases em paralelo e aplica a melhor configuração de cada uma.
Uso: python3 tools/tune-batch.py 7-1 7-2 ...   (meta de dificuldade pela posição na campanha)"""
import sys, json, subprocess, concurrent.futures as cf
ids = sys.argv[1:]
order = json.loads(subprocess.check_output(['node', '-e',
  "const FF=require('./tools/load')(); console.log(JSON.stringify(FF.LEVELS.map(l=>l.id)))"]))
first = order.index('7-1')

def goal(lid):
    k = max(0, order.index(lid) - first)
    return round(6 + k * 0.22), max(0.65, round(1.15 - 0.01 * k, 2))

def run(lid):
    target, win = goal(lid)
    for w in (win, max(0.6, win - 0.2)):
        out = subprocess.run(['node', 'tools/tune.js', lid, '--json', '--target', str(target), '--win', str(w),
                              '--n', '70', '--secs', '420', '--min', '2'], capture_output=True, text=True)
        try: r = json.loads(out.stdout.strip().splitlines()[-1])
        except Exception: return lid, None, target, out.stderr[-400:]
        if r['results']: return lid, r['results'][0], target, r['tested']
    return lid, None, target, r['tested']

with cf.ThreadPoolExecutor(max_workers=2) as ex:
    for lid, best, target, info in ex.map(run, ids):
        if not best:
            print(f'FALHOU {lid} (meta {target}) {info}', flush=True); continue
        subprocess.run(['python3', 'tools/apply-tune.py', lid, json.dumps(best['choice']), str(best['taps'])], check=True, capture_output=True)
        print(f"{lid}: toques {best['taps']} (meta {target}) janela {best['win']}s {best['secs']}s sols={best['sols']}", flush=True)
