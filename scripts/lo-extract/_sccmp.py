# -*- coding: utf-8 -*-
"""Compare les raccourcis LUS sur la vraie fenetre (ocr_shortcuts.py) a ceux de ForgeOffice (_menutree.mjs).
  python _sccmp.py <ocr.json> <chemins.txt> <mien.json> [--apply sortie.json]
Un ecart n'est signale que si l'OCR a lu un raccourci net (le texte absent peut etre un echec de lecture : liste « a verifier a l'oeil » a part).
Sortie --apply : {chemin: {libelle: raccourci reel}} pour les ecarts surs."""
import difflib, json, re, sys, unicodedata

fold = lambda s: re.sub(r'[^a-z0-9]', '', ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c)).lower())
ocr = json.load(open(sys.argv[1], encoding='utf8'))
paths = [l.strip() for l in open(sys.argv[2], encoding='utf8') if l.strip()]
mine = {m['name']: m for m in json.load(open(sys.argv[3], encoding='utf8'))['menus']}
sure, absent, extra, gone = {}, [], [], []
import os
VALID = set(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'valid_keys.json'), encoding='utf8'))['all']) if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'valid_keys.json')) else None
def fixcase(v):  # l/I/O confondus par l'OCR : lettre finale en majuscule
    return re.sub(r'\+([a-z])$', lambda m: '+' + m.group(1).upper(), v)
norm = lambda s: re.sub(r'\s+', '', s.replace('Maj', 'Shift').replace('Entrée', 'Enter')).lower()
for n, p in enumerate(paths):
    f = '%03d.png' % n
    if f not in ocr: continue
    cur = None
    parts = p.split('>')
    node = mine.get(parts[0])
    for part in parts[1:]:
        node = next((i for i in (node or {}).get('items', []) if i['t'] != '-' and fold(i['name']) == fold(part)), None)
    if not node: continue
    rows = ocr[f]['rows']; keys = list(rows)
    for it in node.get('items', []):
        if it['t'] == '-': continue
        best = max(keys, key=lambda k: difflib.SequenceMatcher(None, fold(k), fold(it['name'])).ratio(), default=None)
        if best is None or difflib.SequenceMatcher(None, fold(best), fold(it['name'])).ratio() < 0.75: continue
        real, ours = fixcase(rows[best] or ''), it.get('acc', '')
        unread = rows[best] is None  # encre a droite du libelle mais OCR muet : a regarder
        if real and VALID is not None and real not in VALID: real = ''  # OCR : touche qui n'existe dans aucun registre = bruit
        if '	' in it['name'] or it['name'] in ('Centre',) or fold(it['name']) == 'enregistrersous': continue  # libelle contenant deja le raccourci / lectures ambigues
        if real and norm(real) != norm(ours):
            if ours and sum(a != b for a, b in zip(norm(real), norm(ours))) <= 1 and len(norm(real)) == len(norm(ours)): continue  # une lettre de difference = confusion d'OCR (I/L, 1/]...)
            sure.setdefault(p, {})[it['name']] = {'real': real, 'ours': ours}
        elif not real and ours and not unread: gone.append((p, it['name'], ours))
        elif not real and ours: absent.append((p, it['name'], ours))
for p, k, o in gone: sure.setdefault(p, {})[k] = {'real': '', 'ours': o}
json.dump(sure, open(sys.argv[sys.argv.index('--apply') + 1], 'w', encoding='utf8'), ensure_ascii=False, indent=1) if '--apply' in sys.argv else None
print('ECARTS surs (OCR lit un raccourci different du notre) :', sum(len(v) for v in sure.values()))
for p, d in sure.items():
    for k, v in d.items(): print('  %-45s %-35s reel=%-18s nous=%s' % (p[:45], k[:35], v['real'], v['ours'] or '-'))
print('NOUS AVONS UN RACCOURCI, LA VRAIE LIGNE N EN A PAS (prouve par absence d encre) :', len(gone))
for p, k, o in gone: print('  %-45s %-35s nous=%s' % (p[:45], k[:35], o))
print('A VERIFIER A L OEIL (nous avons un raccourci, OCR n en lit pas) :', len(absent))
for p, k, o in absent: print('  %-45s %-35s nous=%s' % (p[:45], k[:35], o))
