# -*- coding: utf-8 -*-
"""Ecart (px) icone par icone entre les barres d'outils de ForgeOffice (lo-bars.mjs) et la vraie fenetre (uia_dump.py).
  python _barcmp.py <mine.json> <uia.json> [dx]   (dx = decalage du cadre de la vraie fenetre : 8 px)"""
import json, sys
from _bargeo import toolbars, items_of

mine = json.load(open(sys.argv[1], encoding='utf8'))
uia = json.load(open(sys.argv[2], encoding='utf8'))
dx = int(sys.argv[3]) if len(sys.argv) > 3 else 8
worst = 0
for n, (y, x, name, kids) in enumerate(toolbars(uia)):
    if n >= len(mine):
        print('barre reelle sans equivalent :', name); continue
    real = sorted([k for k in kids if k['type'] not in ('SeparatorControl', 'ToolBarControl') and k['w'] > 0], key=lambda k: k['x'])
    mi = [i for i in mine[n]['items'] if 'sep' not in i[4]]
    print('barre %d %s : reel y=%d (%d elements) ; mien y=%s h=%s (%d elements)' % (n, name, y, len(real), mine[n]['y'], mine[n]['h'], len(mi)))
    if len(real) != len(mi):
        print('  nombre different'); continue
    for r, m in zip(real, mi):
        d = m[0] - (r['x'] - dx)
        w = m[1] - r['w']
        worst = max(worst, abs(d))
        if abs(d) > 0.6 or abs(w) > 0.6:
            print('  %-34s reel x=%d w=%d | mien x=%.1f w=%.1f | dx=%+.1f dw=%+.1f' % (r['name'][:34], r['x'] - dx, r['w'], m[0], m[1], d, w))
print('ecart max', worst)
