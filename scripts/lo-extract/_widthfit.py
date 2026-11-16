# -*- coding: utf-8 -*-
"""Ajuste le modele de largeur des popups : W = 40 + max(Lsimple + A, Lsc + Ssc + B, Lfleche + C) (+ D si colonne de coche) sur la vraie fenetre.
  python _widthfit.py <fixture1.json,...> <mesure1.json,...>   (mesure = _menutree.mjs avec lw/sw/chk)"""
import json, sys, itertools
sys.stdout.reconfigure(encoding='utf8')
real_files = sys.argv[1].split(','); mine_files = sys.argv[2].split(',')
width = lambda items: max([i['w'] for i in items if i['t'] != '-' and i.get('w')] or [0])
pop = []


def cmp(r, m, p):
    wr = width(r)
    rows = [i for i in m if i['t'] != '-']
    if wr and rows:
        ls = [i['lw'] for i in rows if i['t'] != 's' and not i.get('acc')]
        sc = [i['lw'] + i['sw'] for i in rows if i['t'] != 's' and i.get('acc')]
        ch = [i['lw'] for i in rows if i['t'] == 's']
        pop.append((wr, max(ls or [0]), max(sc or [0]), max(ch or [0]), rows[0].get('chk', False), p))
    mi = {i['name']: i for i in m if i['t'] != '-'}
    for i in r:
        if i['t'] == 's' and i['name'] in mi and mi[i['name']].get('items'): cmp(i['items'], mi[i['name']]['items'], p + '>' + i['name'])


for rf, mf in zip(real_files, mine_files):
    mine = {m['name']: m for m in json.load(open(mf, encoding='utf8'))['menus']}
    for x in json.load(open(rf, encoding='utf8'))['menus']:
        if x['name'] in mine: cmp(x['items'], mine[x['name']]['items'], x['name'])


S = 1.0
def pred(p, A, B, C, D): return 40 + max(S * p[1] + A, S * p[2] + B if p[2] else 0, S * p[3] + C if p[3] else 0) + (D if p[4] else 0)


def err(A, B, C, D): return sum(abs(pred(p, A, B, C, D) - p[0]) for p in pop)


A, B, C, D = 20, 20, 30, 29
bestS = None
best = err(A, B, C, D)
for _ in range(6):
    for name in 'ABCD':
        for v in range(0, 90):
            a = dict(A=A, B=B, C=C, D=D); a[name] = v
            e = err(**a)
            if e < best or (e == best and abs(v - 30) < abs(a[name] - 30) and False): best = e; A, B, C, D = a['A'], a['B'], a['C'], a['D']
import itertools
for sv in [0.9 + 0.01 * k for k in range(0, 25)]:
    S = sv
    b = err(A, B, C, D)
    if bestS is None or b < bestS[0]: bestS = (b, sv)
print('echelle des libelles optimale', bestS)
S = bestS[1]
best = err(A, B, C, D)
for _ in range(4):
    for name in 'ABCD':
        for v in range(0, 90):
            a = dict(A=A, B=B, C=C, D=D); a[name] = v
            e = err(**a)
            if e < best: best = e; A, B, C, D = a['A'], a['B'], a['C'], a['D']
ok = sum(abs(pred(p, A, B, C, D) - p[0]) <= 3 for p in pop)
print('popups', len(pop), 'A', A, 'B', B, 'C', C, 'D', D, 'erreur totale', best, 'dans +-3 px', ok, '(%.0f %%)' % (100 * ok / len(pop)))
for p in pop:
    d = pred(p, A, B, C, D) - p[0]
    if abs(d) > 3: print('%+4d %s (reel %d, chk=%s)' % (d, p[5], p[0], p[4]))
