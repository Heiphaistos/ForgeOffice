# -*- coding: utf-8 -*-
"""Diff menu par menu entre la vraie fenetre (uia_menus.py) et ForgeOffice (apps/web/tests/e2e/_menutree.mjs).
  python _menucmp.py <reel.json> <mien.json> [--strict]
Compare : libelles, ordre, filets, sous-menus, et largeur de chaque popup (largeur des lignes). Sortie 1 si ecart de largeur > 3 px ou structure differente."""
import json, sys

TOL = 3
raw = json.load(open(sys.argv[1], encoding='utf8'))
real = raw['menus']
for m in real:  # la liste des documents ouverts n'est pas exposee par UIA : meme ajout que _menusync.py
    if m['name'] == 'Fenêtre' and m['items'] and m['items'][-1]['t'] == '-': m['items'].append({'t': 'i', 'name': raw.get('title') or 'Sans nom 1', 'w': 0})
mine = {m['name']: m for m in json.load(open(sys.argv[2], encoding='utf8'))['menus']}
bad = 0


def seq(items):
    return [('-' if i['t'] == '-' else i['name']) for i in items]


def width(items):
    ws = [i['w'] for i in items if i['t'] != '-' and i.get('w')]
    return max(ws) if ws else 0


def cmp(r, m, path):
    global bad
    a, b = seq(r), seq(m)
    if a != b:
        bad += 1
        print('STRUCT', path)
        for x in a:
            if x not in b: print('   manque chez nous :', x)
        for x in b:
            if x not in a: print('   en trop chez nous :', x)
        if sorted(a) == sorted(b): print('   (meme contenu, ordre different)')
    dw = width(m) - width(r)
    if width(r) and abs(dw) > TOL:
        bad += 1
        print('LARGEUR %+d  %s (reel %d, nous %d)' % (dw, path, width(r), width(m)))
    mi = {i['name']: i for i in m if i['t'] != '-'}
    for i in r:
        if i['t'] == 's' and i['name'] in mi and mi[i['name']].get('items') is not None:
            cmp(i.get('items', []), mi[i['name']]['items'], path + ' > ' + i['name'])
        elif i['t'] == 's' and i['name'] in mi and mi[i['name']]['t'] != 's':
            bad += 1; print('SOUS-MENU manquant', path, '>', i['name'])
        elif i['t'] == 'i' and i['name'] in mi and mi[i['name']]['t'] == 's':
            bad += 1; print('SOUS-MENU en trop', path, '>', i['name'])


for r in real:
    m = mine.get(r['name'])
    if not m:
        print('menu absent', r['name']); bad += 1; continue
    cmp(r['items'], m['items'], r['name'])
print('ECARTS', bad)
sys.exit(1 if bad else 0)
