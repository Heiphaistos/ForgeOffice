# -*- coding: utf-8 -*-
"""Aligne les menus de libreoffice.generated.ts / openoffice.generated.ts sur la VRAIE fenetre (releves uia_menus.py).
  python _menusync.py reduce <uia_menus.json> <fixture.json>         releve brut -> fixture versionnee (noms, mnemoniques, filets, sous-menus, largeurs)
  python _menusync.py apply <lo|oo> <word|excel|powerpoint|publisher> <fixture.json> <fichier.generated.ts>
Pour chaque niveau : alignement difflib sur les libelles ; une entree reconnue garde sa commande (u) ; une entree renommee garde la commande
mais perd son raccourci (la vraie fenetre ne l'affiche plus) ; une entree nouvelle recoit une commande 'X_<libelle>' (grisee, sans equivalent)."""
import difflib, json, re, sys, unicodedata


def fold(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r'\s+', ' ', re.sub(r'\.\.\.|…|&', '', s)).strip(' .:')


def reduce_item(i):
    if i['t'] == '-': return {'t': '-'}
    o = {'t': i['t'], 'name': i['name'], 'w': i['w']}
    if i.get('k'): o['k'] = i['k'].strip('\n ')[:1]
    if i.get('en') is False: o['en'] = False
    if i['t'] == 's': o['items'] = [reduce_item(x) for x in i.get('items', [])]
    return o


def is_window(name, menu):
    return menu == 'Fenêtre' and re.match(r'^(Sans nom|Presentation|Untitled)\s*\d+', name)


def key(i, menu=''):
    if i['t'] == '-': return '-'
    return '%WINDOW%' if is_window(i['name'], menu) else fold(i['name'])


def slug(s):
    return 'X_' + re.sub(r'[^A-Za-z0-9]+', '', unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().title())[:40]


def fresh(r, menu):
    if r['t'] == '-': return {'sep': 1}
    if is_window(r['name'], menu): return {'u': 'WindowList', 'l': '%WINDOW%'}
    o = {'u': slug(r['name']), 'l': r['name']}
    if r.get('k'): o['k'] = r['k']
    if r['t'] == 's': o['i'] = [fresh(x, menu) for x in r.get('items', [])] or [{'u': 'X_Empty', 'l': 'Aucun'}]
    return o


def merge_item(o, r, menu, keep_sc):
    n = dict(o)
    n['l'] = o['l'] if n.get('u') == 'WindowList' else r['name']
    if r.get('k'): n['k'] = r['k']
    else: n.pop('k', None)
    if not keep_sc: n.pop('s', None)
    if r['t'] == 's':
        n['i'] = merge(o.get('i', []), r['items'], menu)
        n.pop('s', None)
    else:
        n.pop('i', None)
    return n


def merge(old, real, menu):
    ok = [('-' if 'sep' in o else ('%WINDOW%' if o.get('u') == 'WindowList' else fold(o.get('l', '')))) for o in old]
    rk = [key(r, menu) for r in real]
    out = []
    for tag, a0, a1, b0, b1 in difflib.SequenceMatcher(None, ok, rk, autojunk=False).get_opcodes():
        if tag == 'equal':
            for o, r in zip(old[a0:a1], real[b0:b1]):
                out.append({'sep': 1} if r['t'] == '-' else merge_item(o, r, menu, True))
            continue
        olds = [o for o in old[a0:a1] if 'sep' not in o]
        for r in real[b0:b1]:
            if r['t'] == '-': out.append({'sep': 1}); continue
            if olds and not r.get('_done'):
                out.append(merge_item(olds.pop(0), r, menu, False)) if (b1 - b0) == (a1 - a0) else out.append(fresh(r, menu))
            else:
                out.append(fresh(r, menu))
    return out


def load_ts(path):
    s = open(path, encoding='utf8').read()
    a = s.index('= {') + 2
    return s[:a], json.loads(s[a:s.rindex(';')]), s[s.rindex(';'):]


def main():
    if sys.argv[1] == 'reduce':
        d = json.load(open(sys.argv[2], encoding='utf8'))
        menus = [{'name': m['name'], 'items': [reduce_item(i) for i in m['items']]} for m in d['menus']]
        for m in menus:  # la liste des documents ouverts (dernier filet puis « Sans nom 1 ») n'est pas exposee par UIA : on la rajoute
            if m['name'] == 'Fenêtre' and m['items'] and m['items'][-1]['t'] == '-': m['items'].append({'t': 'i', 'name': d.get('title') or 'Sans nom 1', 'w': 0})
        json.dump({'title': d.get('title', ''), 'menus': menus},
                  open(sys.argv[3], 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    else:
        kind, app, fx, ts = sys.argv[2:6]
        real = json.load(open(fx, encoding='utf8'))['menus']
        head, data, tail = load_ts(ts)
        menu = data[app]['menu']
        top = {fold(m.get('l', '')): m for m in menu}
        for rm in real:
            m = top.get(fold(rm['name']))
            if m is None: print('menu absent des donnees', rm['name']); continue
            m['i'] = merge(m.get('i', []), rm['items'], rm['name'])
            while m['i'] and 'sep' in m['i'][-1]: m['i'].pop()
        # ordre des menus de premier niveau = celui de la vraie fenetre
        order = {fold(rm['name']): n for n, rm in enumerate(real)}
        data[app]['menu'] = sorted(menu, key=lambda m: order.get(fold(m.get('l', '')), 99))
        open(ts, 'w', encoding='utf8').write(head + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + tail)


if __name__ == '__main__':
    main()
