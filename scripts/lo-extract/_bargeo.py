# -*- coding: utf-8 -*-
"""Geometrie exacte des barres d'outils de la VRAIE fenetre (releve UI Automation de uia_dump.py) -> bargeo.json, lu par gen.py.
  python _bargeo.py <dossier des uia_*.json> <sortie bargeo.json>
Fichiers attendus : uia_{l|o}{writer|calc|impress|draw}.json. Un element = [type, largeur] avec type b (bouton), s (bouton a liste), f (champ), | (filet)."""
import json, os, sys

APP = {'writer': 'word', 'calc': 'excel', 'impress': 'powerpoint', 'draw': 'publisher'}


def toolbars(d):
    """Barres horizontales de la zone haute (hors barre de formule de Calc et volet lateral) : liste de (y, x, enfants directs)."""
    out = []
    i = 0
    while i < len(d):
        e = d[i]
        if e['type'] == 'ToolBarControl' and e['d'] == 1 and 40 <= e['y'] <= 140 and e['x'] < 100 and not e['name'].startswith("Barre d'outils Formule"):
            kids = []
            j = i + 1
            while j < len(d) and d[j]['d'] > 1:
                if d[j]['d'] == 2:
                    kids.append(d[j])
                j += 1
            out.append((e['y'], e['x'], e['name'], kids))
            i = j
        else:
            i += 1
    return sorted(out, key=lambda t: (t[0], t[1]))


def item(k):
    t = k['type']
    if t == 'SeparatorControl':
        return ['|', k['w']]
    if t == 'SplitButtonControl':
        return ['s', k['w']]
    if t == 'ButtonControl':
        return ['b', k['w']]
    return ['f', k['w']]


def items_of(kids):
    """Elements dans l'ordre, filets deduits des ecarts (UIA ne les rapporte pas partout) : un ecart >= 6 px entre deux elements = un filet."""
    ks = [k for k in kids if k['type'] not in ('SeparatorControl', 'ToolBarControl') and k['w'] > 0]
    vertical = len(ks) > 3 and max(k['x'] for k in ks) - min(k['x'] for k in ks) < 20  # barre verticale : ecarts mesures en hauteur
    ks.sort(key=lambda k: k['y'] if vertical else k['x'])
    out = []
    for n, k in enumerate(ks):
        gap = (k['y'] - (ks[n - 1]['y'] + ks[n - 1]['h'])) if vertical and n else (k['x'] - (ks[n - 1]['x'] + ks[n - 1]['w'])) if n else 0
        if n and gap >= 6:
            out.append(['|', gap])
        out.append(item(k))
    return out


def main():
    src, dst = sys.argv[1:3]
    res = {}
    for kind, pre in (('lo', 'l'), ('oo', 'o')):
        for app, key in APP.items():
            p = os.path.join(src, 'uia_%s%s.json' % (pre, app))
            if not os.path.exists(p):
                continue
            d = json.load(open(p, encoding='utf8'))
            bars = toolbars(d)
            res.setdefault(kind, {})[key] = [{'name': n, 'y': y, 'x0': x, 'items': items_of(kids)} for y, x, n, kids in bars]
            print(kind, key, [(n, y, len(kids)) for y, x, n, kids in bars])
    json.dump(res, open(dst, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
