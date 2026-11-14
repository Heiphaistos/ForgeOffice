# Extrait menus/barres d'outils/barre d'etat de LibreOffice (labels FR) vers un JSON de travail.
# Usage: python extract.py <racine_install> <sortie.json>  (donnees de structure uniquement, pas d'icones)
import sys, json, re
import xml.etree.ElementTree as ET
LO = sys.argv[1]
OOR = '{http://openoffice.org/2001/registry}'
def labels(path):
    out = {}  # category -> uno -> dict
    for ev, el in ET.iterparse(path, events=('end',)):
        pass
    root = ET.parse(path).getroot()
    def walk(n, cat):
        for c in n:
            name = c.get(OOR + 'name')
            if c.tag == 'node' and name and name.startswith(('.uno:', 'vnd.sun.star.findbar:')) or (c.tag=='node' and name and name.startswith('private:')):
                d = {}
                for p in c.findall('prop'):
                    v = p.find('value')
                    if v is not None and v.text: d[p.get(OOR + 'name')] = v.text
                out.setdefault(cat, {})[name] = d
            elif c.tag == 'node':
                walk(c, cat)
            elif c.tag == OOR + 'component-data':
                walk(c, name)
    walk(root, None)
    return out
fr = labels(LO + r'\share\registry\res\registry_fr.xcd')
MOD = {'swriter': 'WriterCommands', 'scalc': 'CalcCommands', 'simpress': 'ImpressCommands', 'sdraw': 'DrawCommands'}
def lab(mod, uno, key='Label'):
    for cat in (MOD[mod], 'DrawImpressCommands' if mod in ('simpress','sdraw') else None, 'GenericCommands'):
        d = fr.get(cat, {}).get(uno)
        if d and (d.get('ContextLabel') if key=='ContextLabel' and d.get('ContextLabel') else d.get(key)): return d.get(key) if not (key=='ContextLabel') else d['ContextLabel']
    for cat, m in fr.items():
        if uno in m and m[uno].get(key): return m[uno][key]
    return None
def clean(s): return re.sub(r'~(.)', r'\1', s) if s else s
def acc(s):
    if not s: return None
    m = re.search(r'~(.)', s); return m.group(1) if m else None
# Entrees dont la vraie fenetre (document neuf, rien de selectionne) affiche le libelle simple et non le ContextLabel / PopupLabel : releve en comparant
# les menus Edition et Insertion de Writer avec les captures de la fenetre reelle (LibreOffice 25.x).
SAME = {'.uno:InsertGraphic': '~Image...', '.uno:InsertAnnotation': 'Co~mmentaire', '.uno:InsertCaptionDialog': '~Légende...', '.uno:EditHyperlink': '~Hyperlien', '.uno:FieldDialog': 'C~hamps...'}
M = '{http://openoffice.org/2001/menu}'
def menu(el, mod):
    items = []
    for c in el:
        if c.tag == M + 'menuseparator': items.append({'sep': True})
        elif c.tag == M + 'menuitem':
            u = c.get(M + 'id'); l = SAME.get(u) or lab(mod, u, 'ContextLabel') or lab(mod, u, 'PopupLabel') or lab(mod, u); items.append({'uno': u, 'label': clean(l), 'key': acc(l), 'sc': sc(mod, u)})
        elif c.tag == M + 'menu':
            u = c.get(M + 'id'); l = lab(mod, u, 'ContextLabel') or lab(mod, u, 'Label'); pop = c.find(M + 'menupopup')
            items.append({'uno': u, 'label': clean(l), 'key': acc(l), 'items': menu(pop, mod) if pop is not None else []})
    return items
T = '{http://openoffice.org/2001/toolbar}'
def toolbar(path, mod):
    r = ET.parse(path).getroot(); out = []
    for c in r:
        if c.tag == T + 'toolbarseparator': out.append({'sep': True})
        elif c.tag == T + 'toolbaritem' and c.get(T + 'visible') != 'false':
            u = c.get('{http://www.w3.org/1999/xlink}href'); out.append({'uno': u, 'label': clean(lab(mod, u, 'ContextLabel') or lab(mod, u)), 'tip': clean(lab(mod, u, 'TooltipLabel'))})
        elif c.tag == T + 'toolbarbreak': out.append({'break': True})
    return out
S = '{http://openoffice.org/2001/statusbar}'
def status(path):
    r = ET.parse(path).getroot(); return [dict((k.split('}')[-1], v) for k, v in c.attrib.items()) for c in r]
KEYN = {'DELETE':'Suppr','INSERT':'Inser','RETURN':'Entrée','SPACE':'Espace','ESCAPE':'Échap','PAGEUP':'Pg. préc.','PAGEDOWN':'Pg. suiv.','HOME':'Début','END':'Fin','UP':'Haut','DOWN':'Bas','LEFT':'Gauche','RIGHT':'Droite','TAB':'Tab','BACKSPACE':'Retour arrière','ADD':'+','SUBTRACT':'-','MULTIPLY':'*','DIVIDE':'/','POINT':'.','COMMA':',','LESS':'<','GREATER':'>','EQUAL':'=','HASH':'#','QUOTELEFT':'`','BRACKETLEFT':'[','BRACKETRIGHT':']','SEMICOLON':';'}
def keytext(n):
    parts = n.split('_'); key = parts[0]; mods = parts[1:]
    out = (['Ctrl'] if 'MOD1' in mods else []) + (['Alt'] if 'MOD2' in mods else []) + (['Maj'] if 'SHIFT' in mods else [])
    if 'MOD3' in mods: out.append('Ctrl+Alt' if False else 'Mod3')
    return '+'.join(out + [KEYN.get(key, key)])
def accel(path):
    # parcours textuel : sections Global/Writer/Calc/Impress/Draw dans l'ordre du fichier
    out = {}; sec = None; sec2 = {}; kind = 'PrimaryKeys'
    t = open(path, encoding='utf8').read()
    for m in re.finditer(r'<node oor:name="(Global|Writer|Calc|Impress|Draw|Common|SecondaryKeys|PrimaryKeys)"(?: oor:op="\w+")?>|<node oor:name="([A-Z0-9_]+)"(?: oor:op="\w+")?><prop oor:name="Command">(?:<value xml:lang="[^"]*">([^<]+)</value>)?', t):
        if m.group(1) in ('PrimaryKeys', 'SecondaryKeys'): kind = m.group(1)
        elif m.group(1): sec = m.group(1) if m.group(1) in ('Global', 'Writer', 'Calc', 'Impress', 'Draw') else sec
        elif m.group(3) and sec: (out if kind == 'PrimaryKeys' else sec2).setdefault(sec, {}).setdefault(m.group(3), []).append(m.group(2))
    for k, d in sec2.items():  # la touche secondaire ne sert que si la commande n'a pas de touche principale (LibreOffice affiche la principale)
        for u, v in d.items(): out.setdefault(k, {}).setdefault(u, v)
    # plusieurs touches pour une commande (Redo : Z_SHIFT_MOD1 et Y_MOD1) : LibreOffice affiche une touche lettre/chiffre, la derniere declaree
    best = lambda ks: keytext([k for k in ks if len(k.split('_')[0]) == 1][-1] if any(len(k.split('_')[0]) == 1 for k in ks) else ks[-1])
    return {k: {u: best(v) for u, v in d.items()} for k, d in out.items()}
ACC = {}
for f in ('main', 'writer', 'calc', 'impress', 'draw'):
    try:
        for sec, d in accel(LO + '/share/registry/%s.xcd' % f).items():
            for u, k in d.items(): ACC.setdefault(sec, {}).setdefault(u, k)
    except Exception as e: print('acc', f, e)
# Touches propres a chaque module (nodes Modules/com.sun.star.* du registre) : la vraie fenetre les prefere aux touches globales
# (ex. Calc affiche « Tout selectionner Ctrl+Maj+Espace », pas Ctrl+A).
MODNODE = {'com.sun.star.sheet.SpreadsheetDocument': 'scalc', 'com.sun.star.drawing.DrawingDocument': 'sdraw', 'com.sun.star.presentation.PresentationDocument': 'simpress', 'com.sun.star.text.TextDocument': 'swriter'}
MODACC = {}
def module_keys(path):
    root = ET.parse(path).getroot()
    def keys(n, mod, kind):
        for k in n:
            if k.tag != 'node': continue
            p = k.find("prop[@%sname='Command']" % OOR); v = p.find('value') if p is not None else None
            if v is not None and v.text: MODACC.setdefault(mod, {}).setdefault(kind, {}).setdefault(v.text, []).append(k.get(OOR + 'name'))
    def walk(n):
        for c in n:
            name = c.get(OOR + 'name')
            if c.tag == 'node' and name in ('PrimaryKeys', 'SecondaryKeys'):
                kind = 'P' if name == 'PrimaryKeys' else 'S'
                for s in c:
                    if s.get(OOR + 'name') == 'Modules':
                        for m in s:
                            if m.get(OOR + 'name') in MODNODE: keys(m, MODNODE[m.get(OOR + 'name')], kind)
            elif c.tag == 'node' or c.tag == OOR + 'component-data' or c.tag == 'component-data': walk(c)
    walk(root)
try: module_keys(LO + '/share/registry/main.xcd')
except Exception as e: print('modkeys', e)
def modkey(mod, uno):
    d = MODACC.get(mod, {}); ks = d.get('P', {}).get(uno) or d.get('S', {}).get(uno)
    if not ks: return None
    ks = [k for k in ks if len(k.split('_')[0]) == 1 or k.split('_')[0] in KEYN or re.fullmatch(r'F\d+', k.split('_')[0])]  # touches nommees inconnues (REPEAT...) : ignorees
    if not ks: return None
    return keytext([k for k in ks if len(k.split('_')[0]) == 1][-1] if any(len(k.split('_')[0]) == 1 for k in ks) else ks[-1])
SEC = {'swriter': 'Writer', 'scalc': 'Calc', 'simpress': 'Impress', 'sdraw': 'Draw'}
def sc(mod, uno): return modkey(mod, uno) or ACC.get(SEC[mod], {}).get(uno) or ACC.get('Global', {}).get(uno)
res = {}
for mod in MOD:
    base = LO + '/share/config/soffice.cfg/modules/' + mod
    try:
        mb = ET.parse(base + '/menubar/menubar.xml').getroot()
    except Exception: continue
    res[mod] = {'menu': menu(mb, mod), 'toolbars': {}}
    import os
    for f in sorted(os.listdir(base + '/toolbar')):
        res[mod]['toolbars'][f[:-4]] = toolbar(base + '/toolbar/' + f, mod)
    try: res[mod]['status'] = status(base + '/statusbar/statusbar.xml')
    except Exception as e: res[mod]['status'] = []
json.dump(res, open(sys.argv[2], 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for m in res: print(m, len(res[m]['menu']), [x.get('label') for x in res[m]['menu']])
