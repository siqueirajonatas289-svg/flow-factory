#!/usr/bin/env python3
"""Aplica uma configuração do calibrador numa fase de www/js/levels.js.
Uso: python3 tools/apply-tune.py <id> '<json do campo choice>' <par>"""
import sys, json, re
lid, choice, par = sys.argv[1], json.loads(sys.argv[2]), int(sys.argv[3])
p = 'www/js/levels.js'
s = open(p).read()
start = s.index("id: '%s'" % lid)
nxt = s.find("\n    {\n      id: '", start)
end = nxt if nxt > 0 else s.index('\n  ];', start)
block = s[start:end]
block = re.sub(r"par: \d+", "par: %d" % par, block, count=1)
for k, c in choice.items():
    m = re.search(r"%s: S\('(\w)', '(\w+)', (\d+), (\d+)\)" % k, block)
    assert m, (lid, k)
    seq = c.get('seq', m.group(2)); iv = c.get('interval', int(m.group(3))); dl = c.get('delay', int(m.group(4)))
    block = block[:m.start()] + "%s: S('%s', '%s', %d, %d)" % (k, m.group(1), seq, iv, dl) + block[m.end():]
block = re.sub(r",\n      tune: \{\n(?:.*\n)*?      \}\n", "\n", block)
s = s[:start] + block + s[end:]
open(p, 'w').write(s)
print('ok', lid)
