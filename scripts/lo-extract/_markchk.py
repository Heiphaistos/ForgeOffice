# -*- coding: utf-8 -*-
"""Marque `c:1` (colonne de coche reservee : +29 px) sur une entree de chaque popup dont l'ecart de largeur mesure vaut -25..-45 px (popups a entrees cochables de la vraie fenetre).
  python _markchk.py <lo|oo> <app> <fixture.json> <mien.json> <fichier.generated.ts> [--dry]"""
import json, sys
from _menusync import fold, load_ts

kind, app, fx, mine_p, ts = sys.argv[1:6]
real = json.load(open(fx, encoding='utf8'))['menus']
mine = {m['name']: m for m in json.load(open(mine_p, encoding='utf8'))['menus']}
width = lambda items: max([i['w'] for i in items if i['t'] != '-' and i.get('w')] or [0])
todo = []


def cmp(r, m, p):
    wr, wm = width(r), width(m)
    if wr and wm and int(__import__("os").environ.get("CHK_LO", "-45")) <= wm - wr <= int(__import__("os").environ.get("CHK_HI", "-25")): todo.append(p)
    mi = {i['name']: i for i in m if i['t'] != '-'}
    for i in r:
        if i['t'] == 's' and i['name'] in mi and mi[i['name']].get('items'): cmp(i['items'], mi[i['name']]['items'], p + '>' + i['name'])


for x in real:
    if x['name'] in mine: cmp(x['items'], mine[x['name']]['items'], x['name'])
head, data, tail = load_ts(ts)
done = 0
for path in todo:
    nodes = data[app]['menu']
    for part in path.split('>'):
        node = next((x for x in nodes if fold(x.get('l', '')) == fold(part)), None)
        if node is None: break
        nodes = node.get('i', [])
    else:
        cand = [x for x in nodes if 'sep' not in x]
        leaf = next((x for x in cand if 'i' not in x), cand[0] if cand else None)
        if leaf is not None: leaf['c'] = 1; done += 1; print('c:1', path, '->', leaf.get('l'))
if '--dry' not in sys.argv: open(ts, 'w', encoding='utf8').write(head + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + tail)
print(done, '/', len(todo))
