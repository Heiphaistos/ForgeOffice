# -*- coding: utf-8 -*-
"""Applique les raccourcis lus sur la vraie fenetre (sortie --apply de _sccmp.py) aux donnees generees.
  python _scapply.py <app: word|excel|powerpoint|publisher> <ecarts.json> <fichier.generated.ts>"""
import json, sys
from _menusync import fold, load_ts

app, fx, ts = sys.argv[1:4]
diff = json.load(open(fx, encoding='utf8'))
head, data, tail = load_ts(ts)
n = 0
for path, rows in diff.items():
    parts = path.split('>')
    nodes = data[app]['menu']
    for p in parts:
        node = next((x for x in nodes if fold(x.get('l', '')) == fold(p)), None)
        if node is None: break
        nodes = node.get('i', [])
    else:
        for label, v in rows.items():
            it = next((x for x in nodes if fold(x.get('l', '')) == fold(label)), None)
            if it is None or 'i' in it: continue
            if v['real']: it['s'] = v['real']
            else: it.pop('s', None)
            n += 1
open(ts, 'w', encoding='utf8').write(head + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + tail)
print(n, 'raccourcis ecrits')
