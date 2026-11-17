#!/usr/bin/env python3
"""Recoloca/atualiza o espaço de calibração (`tune`) e trechos de uma fase.
Uso: python3 tools/set-tune.py <id> '<tune em JS>'"""
import sys, re, os
sys.path.insert(0, os.path.dirname(__file__))
from tunelib import strip_tunes
lid, tune = sys.argv[1], sys.argv[2]
for p in ('www/js/levels.js', 'www/js/levels2.js', 'www/js/levels3.js'):
    s = open(p).read()
    if ("id: '%s'" % lid) in s: break
i = s.index("id: '%s'" % lid)
j = s.find("\n    {\n      id: '", i); j = j if j > 0 else s.index('\n  ];', i)
b = s[i:j]
b = strip_tunes(b)
b = re.sub(r"(\n      legend: \{(?:.*\n)*?      \}|\n      legend: \{[^\n]*\}),?\n", lambda m: m.group(1) + ",\n      tune: " + tune + ",\n", b, count=1)
s = s[:i] + b + s[j:]
open(p, 'w').write(s)
print('ok', lid)
