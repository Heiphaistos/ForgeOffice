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
def build(path, kind):
    d = json.load(open(path, encoding='utf8')); res = {}
    for app, mod in MODS.items():
        m = d[mod]
        res[app] = {'menu': clean(m['menu']), 'bars': [bar(sum((m['toolbars'][n] if i == 0 else [{'sep': True}] + m['toolbars'][n] for i, n in enumerate(b.split('+'))), [])) for b in BARS[kind][mod]], 'status': [s['href'][5:] for s in m['status']]}
        f = FOOT.get(kind, {}).get(mod)
        if f: res[app]['foot'] = bar(m['toolbars'][f])
        sd = SIDE.get(kind, {}).get(mod)
        if sd: res[app]['side'] = bar(m['toolbars'][sd])
    return res
out = sys.argv[3]
for kind, path, name in (('lo', sys.argv[1], 'libreoffice'), ('oo', sys.argv[2], 'openoffice')):
    body = json.dumps(build(path, kind), ensure_ascii=False, separators=(',', ':'))
    ts = ("// GENERE par scripts/lo-extract/gen.py a partir de l'installation locale (structure des menus, barres d'outils et barre d'etat). Ne pas editer a la main.\n"
          "import type { SuiteData } from './types.ts';\n\n"
          f"export const {name.upper()}_DATA: Record<'word' | 'excel' | 'powerpoint' | 'publisher', SuiteData> = {body};\n")
    open(f'{out}/{name}.generated.ts', 'w', encoding='utf8').write(ts)
    print(name, len(ts))
