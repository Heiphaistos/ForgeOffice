# -*- coding: utf-8 -*-
"""Reporte un changement de raccourcis (diff de deux extract.py : {module: {.uno:Commande: nouveau raccourci ou null}}) sur les donnees generees, sans les regenerer.
  python _scfix.py <changes.json> <fichier.generated.ts>"""
import json, sys
from _menusync import load_ts

APP = {'swriter': 'word', 'scalc': 'excel', 'simpress': 'powerpoint', 'sdraw': 'publisher'}
ch = json.load(open(sys.argv[1], encoding='utf8'))
head, data, tail = load_ts(sys.argv[2])
n = 0


def walk(x, cmds):
    global n
    if isinstance(x, dict):
        if x.get('u') in cmds and 'l' in x and 'i' not in x:
            if cmds[x['u']]: x['s'] = cmds[x['u']]
            else: x.pop('s', None)
            n += 1
        for v in x.values(): walk(v, cmds)
    elif isinstance(x, list):
        for v in x: walk(v, cmds)


for mod, cmds in ch.items():
    walk(data[APP[mod]]['menu'], {u.replace('.uno:', ''): s for u, s in cmds.items()})
open(sys.argv[2], 'w', encoding='utf8').write(head + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + tail)
print(n, 'raccourcis corriges')
