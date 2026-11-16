# -*- coding: utf-8 -*-
"""Ecarts de largeur de chaque popup : vraie fenetre (fixture menus/*.json) vs ForgeOffice (_menutree.mjs).  python _widths.py <fixture.json> <mien.json> [tol=3]
Sortie : une ligne par popup hors tolerance ; en fin, la part des popups dans la tolerance."""
import json, sys
sys.stdout.reconfigure(encoding='utf8')
tol = int(sys.argv[3]) if len(sys.argv) > 3 else 3
real = json.load(open(sys.argv[1], encoding='utf8'))['menus']
mine = {m['name']: m for m in json.load(open(sys.argv[2], encoding='utf8'))['menus']}
width = lambda items: max([i['w'] for i in items if i['t'] != '-' and i.get('w')] or [0])
rows = []


def cmp(r, m, p):
    if width(r) and width(m): rows.append((width(m) - width(r), p, width(r), any(i.get('ct') for i in r)))
    mi = {i['name']: i for i in m if i['t'] != '-'}
    for i in r:
        if i['t'] == 's' and i['name'] in mi and mi[i['name']].get('items'): cmp(i['items'], mi[i['name']]['items'], p + '>' + i['name'])


for x in real:
    if x['name'] in mine: cmp(x['items'], mine[x['name']]['items'], x['name'])
bad = [r for r in rows if abs(r[0]) > tol]
for d, p, w, ct in sorted(bad): print('%+4d  %s  (reel %d)' % (d, p, w))
print('%d popups, %d dans +-%d px (%.0f %%)' % (len(rows), len(rows) - len(bad), tol, 100 * (len(rows) - len(bad)) / max(1, len(rows))))
