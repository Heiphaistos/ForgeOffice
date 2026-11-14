# Genere packages/ui/src/logic/suite/{libreoffice,openoffice}.generated.ts depuis les JSON de extract.py.
# Usage: python gen.py <lo.json> <oo.json> <dossier_sortie>
import json, sys
MODS = {'word': 'swriter', 'excel': 'scalc', 'powerpoint': 'simpress', 'publisher': 'sdraw'}
BARS = {
    'lo': {'swriter': ['standardbar', 'textobjectbar'], 'scalc': ['standardbar', 'formatobjectbar'], 'simpress': ['standardbar', 'toolbar'], 'sdraw': ['standardbar']},
    'oo': {'swriter': ['standardbar', 'textobjectbar'], 'scalc': ['standardbar', 'formatobjectbar'], 'simpress': ['standardbar+commontaskbar', 'drawingobjectbar'], 'sdraw': ['standardbar', 'drawingobjectbar']},
}
# Barre du bas (OpenOffice : la barre de dessin est ancree en bas de la fenetre, sous la zone de travail).
FOOT = {'oo': {'simpress': 'toolbar', 'sdraw': 'toolbar'}}
# Barre verticale a gauche de la zone de travail (LibreOffice Draw).
SIDE = {'lo': {'sdraw': 'toolbar'}}
HIDE = {'.uno:CheckOut', '.uno:CancelCheckOut', '.uno:CheckIn', '.uno:SendViaBluetooth'}
# Libelles courts tels que la vraie fenetre les montre (le menu en porte un plus long dans la configuration).
SHORT = {'.uno:OpenRemote': 'Ouvrir distant...', '.uno:SaveAsRemote': 'Enregistrer distant...'}
# Sous-menu « Nouveau » (genere dynamiquement par la vraie suite, releve sur la fenetre) : u = commande de l'hote ForgeOffice.
NEW_SUB = {
    'lo': [('NewWriter', 'Document texte', 't', 'Ctrl+N'), ('NewCalc', 'Classeur', 'C'), ('NewImpress', 'Présentation', 'P'), ('NewDraw', 'Dessin', 'D'), ('NewMath', 'Formule', 'F'), ('NewBase', 'Base de données', 'B'), None,
           ('NewHtml', 'Document HTML', 'H'), ('NewXForms', 'Formulaire XML', 'X'), None, ('NewLabels', 'Étiquettes', 'É'), ('NewCards', 'Cartes de visite', 'C'), None, ('NewGlobal', 'Document maître', 'm'), ('NewTemplate', 'Modèles...', 'M', 'Ctrl+Maj+N')],
    'oo': [('NewWriter', 'Document texte', 't', 'Ctrl+N'), ('NewCalc', 'Classeur', 'C'), ('NewImpress', 'Présentation', 'P'), ('NewDraw', 'Dessin', 'D'), ('NewBase', 'Base de données', 'B'), None,
           ('NewHtml', 'Document HTML', 'H'), ('NewXForms', 'Formulaire XML', 'X'), ('NewGlobal', 'Document maître', 'm'), None, ('NewMath', 'Formule', 'F'), ('NewLabels', 'Étiquettes', 'É'), ('NewCards', 'Cartes de visite', 'C'), None, ('NewTemplate', 'Modèles et documents', 'M')],
}
def new_sub(kind):
    out = []
    for e in NEW_SUB[kind]:
        if e is None: out.append({'sep': 1}); continue
        o = {'u': e[0], 'l': e[1], 'k': e[2]}
        if len(e) > 3: o['s'] = e[3]
        out.append(o)
    return out
def post(menu, kind):
    for m in menu:
        for i in m.get('i', []):
            if i.get('u') == 'AddDirect' and m.get('l') == 'Fichier': i['i'] = new_sub(kind); i.pop('s', None)
        if m.get('l') == 'Fenêtre' and m.get('i'): m['i'] += [{'sep': 1}, {'u': 'WindowList', 'l': '%WINDOW%'}]
        if m.get('l') == 'Aide' and m.get('i') and not any(i.get('u') == 'CheckUpdate' for i in m['i']):
            m['i'].insert(len(m['i']) - 1, {'u': 'CheckUpdate', 'l': 'Vérifier les mises à jour...'})
    return menu
def clean(items):
    out = []
    for i in items:
        if i.get('uno') in HIDE: continue
        if i.get('sep'):
            if out and 'sep' not in out[-1]: out.append({'sep': 1})
            continue
        if not i.get('label'): continue
        o = {'u': i['uno'][5:] if i['uno'].startswith('.uno:') else i['uno'], 'l': SHORT.get(i['uno'], i['label'])}
        if i.get('key'): o['k'] = i['key']
        if i.get('sc'): o['s'] = i['sc']
        if 'items' in i: o['i'] = clean(i['items'])
        out.append(o)
    while out and 'sep' in out[-1]: out.pop()
    return out
def bar(items):
    out = []
    for i in items:
        if i.get('sep'):
            if out and 'sep' not in out[-1]: out.append({'sep': 1})
        elif i.get('uno'): out.append({'u': i['uno'][5:], 'l': i.get('label') or i.get('tip') or i['uno'][5:]})
    while out and 'sep' in out[-1]: out.pop()
    return out
# Geometrie exacte releve sur la vraie fenetre (_bargeo.py -> bargeo.json) : bouton a liste (d=1) et largeur des champs (w).
import os
GEO = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bargeo.json'), encoding='utf8')) if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bargeo.json')) else {}
def geo_items(g):
    out = []
    for t, w in g['items']:
        if t == '|' and (not out or out[-1][0] == '|'): continue
        out.append((t, w))
    while out and out[-1][0] == '|': out.pop()
    return out
def apply_geo(out, g, label, prefix=False):
    gi = geo_items(g)
    if prefix and len(gi) < len(out): out = out[:len(gi)]  # barre verticale tronquee par la hauteur de la fenetre reelle
    if len(gi) != len(out):
        print('GEO ecart', label, len(gi), len(out)); return
    for o, (t, w) in zip(out, gi):
        if (t == '|') != ('sep' in o): print('GEO type', label); return
    for o, (t, w) in zip(out, gi):
        if t != '|': o['t'] = t
        if t == 'f' or w != (33 if t == 'b' else 44): o['w'] = w
def build(path, kind):
    d = json.load(open(path, encoding='utf8')); res = {}
    for app, mod in MODS.items():
        m = d[mod]
        res[app] = {'menu': post(clean(m['menu']), kind), 'bars': [bar(sum((m['toolbars'][n] if i == 0 else [{'sep': True}] + m['toolbars'][n] for i, n in enumerate(b.split('+'))), [])) for b in BARS[kind][mod]], 'status': [s['href'][5:] for s in m['status']]}
        gb = GEO.get(kind, {}).get(app)
        if gb:
            for n, b in enumerate(res[app]['bars']):
                if n < len(gb): apply_geo(b, gb[n], '%s %s bar%d' % (kind, app, n))
        f = FOOT.get(kind, {}).get(mod)
        if f: res[app]['foot'] = bar(m['toolbars'][f])
        sd = SIDE.get(kind, {}).get(mod)
        if sd:
            res[app]['side'] = bar(m['toolbars'][sd])
            if gb and len(gb) > len(res[app]['bars']): apply_geo(res[app]['side'], gb[len(res[app]['bars'])], '%s %s side' % (kind, app), True)
    return res
out = sys.argv[3]
for kind, path, name in (('lo', sys.argv[1], 'libreoffice'), ('oo', sys.argv[2], 'openoffice')):
    body = json.dumps(build(path, kind), ensure_ascii=False, separators=(',', ':'))
    ts = ("// GENERE par scripts/lo-extract/gen.py a partir de l'installation locale (structure des menus, barres d'outils et barre d'etat). Ne pas editer a la main.\n"
          "import type { SuiteData } from './types.ts';\n\n"
          f"export const {name.upper()}_DATA: Record<'word' | 'excel' | 'powerpoint' | 'publisher', SuiteData> = {body};\n")
    open(f'{out}/{name}.generated.ts', 'w', encoding='utf8').write(ts)
    print(name, len(ts))
