# -*- coding: utf-8 -*-
"""Lit les raccourcis clavier (colonne de droite) sur les photos de popups prises par popup_shot.py, par OCR Windows (Windows.Media.Ocr, local).
  python ocr_shortcuts.py <dossier de png> <sortie.json>      sortie : {fichier.png: {libelle: raccourci}}
Image : niveaux de gris, inversee si sombre, agrandie x4 ; passes sur l'image entiere (libelles) et sur la moitie droite (raccourcis courts type F5)."""
import json, os, re, subprocess, sys, unicodedata
from PIL import Image, ImageOps

SC = re.compile(r'^(?:(?:Ctrl|Alt|Maj|Shift|Mod)\s*\+\s*)*(?:[A-Z0-9]|F\s?\d{1,2}|Suppr|Inser|Entrée|Espace|Échap|Tab|Début|Fin|Haut|Bas|Gauche|Droite|Pg\.? ?(?:préc|suiv)\.?|[\[\]\;,.=/\-]|Retour arrière|\+)$', re.I)
TAIL = re.compile(r'\s((?:(?:Ctrl|Alt|Maj)\s*\+\s*)+[A-Za-z0-9\[\]\.;,\-\+]{1,12}|F\s?\d{1,2})$')
FIX = {'FIO': 'F10', 'FII': 'F11', 'FI2': 'F12', 'F1O': 'F10', 'FI': 'F1', 'F1l': 'F11'}
fold = lambda s: re.sub(r'\s+', ' ', ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c)).lower().replace('...', '').replace('…', '')).strip()


def clean_sc(t):
    t = re.sub(r'\s*\+\s*', '+', t.strip())
    t = re.sub(r'\b(F)[IlO]([0-9O])\b', lambda m: m.group(1) + '1' + ('0' if m.group(2) == 'O' else m.group(2)), t)
    return FIX.get(t, t)


def prep(src, dst, half):
    im = Image.open(src).convert('L')
    if sum(im.resize((8, 8)).tobytes()) / 64 < 128: im = ImageOps.invert(im)
    if half: im = im.crop((im.width // 2, 0, im.width, im.height))
    im = im.resize((im.width * 4, im.height * 4), Image.LANCZOS)
    ImageOps.expand(im, 40, 255).save(dst)


def ocr(files):
    ps = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_ocr.ps1')
    r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps] + files, capture_output=True, text=True, encoding='utf-8')
    out = {}
    for ln in r.stdout.splitlines():
        p = ln.split('\t')
        if len(p) == 5: out.setdefault(p[0], []).append((int(p[1]) / 4, int(p[2]) / 4, p[4], int(p[3]) / 4))
    return out


def main(d, outp):
    pngs = sorted(f for f in os.listdir(d) if f.endswith('.png') and not f.startswith('_'))
    tmp = os.path.join(d, '_ocr'); os.makedirs(tmp, exist_ok=True)
    jobs = []
    tmp = os.path.abspath(tmp)
    names = {f: 'p%03d.png' % i for i, f in enumerate(pngs)}  # noms ASCII : les chemins accentues passent mal en ligne de commande PowerShell
    for f in pngs:
        a, b = os.path.join(tmp, 'a_' + names[f]), os.path.join(tmp, 'b_' + names[f])
        prep(os.path.join(d, f), a, False); prep(os.path.join(d, f), b, True); jobs += [a, b]
    res = ocr(jobs)
    final = {}
    for f in pngs:
        full = res.get(os.path.join(tmp, 'a_' + names[f]), []); half = res.get(os.path.join(tmp, 'b_' + names[f]), [])
        W = Image.open(os.path.join(d, f)).width
        scs = [(y, clean_sc(t)) for (y, x, t, xe) in half if SC.match(clean_sc(t))]
        scs += [(y, clean_sc(t)) for (y, x, t, xe) in full if x > W * 0.45 and SC.match(clean_sc(t)) and not any(abs(y - y2) < 6 for y2, _ in scs)]
        labels = []
        for (y, x, t, xe) in full:
            if x >= W * 0.35 or SC.match(clean_sc(t)): continue
            m = TAIL.search(t)  # la ligne OCR contient parfois libelle + raccourci d'un seul tenant
            if m and SC.match(clean_sc(m.group(1))): scs.append((y, clean_sc(m.group(1)))); t = t[:m.start()].strip()
            labels.append((y, t, xe))
        rows = {}
        im = Image.open(os.path.join(d, f)).convert('L')
        if sum(im.resize((8, 8)).tobytes()) / 64 < 128: im = ImageOps.invert(im)
        for y, t, xe in labels:
            m = [s for (y2, s) in scs if abs(y - y2) < 7]
            if m: rows[t] = m[0]; continue
            # aucune lecture : encre a droite du libelle ? sinon la vraie ligne n'a PAS de raccourci ('' = prouve vide, None = encre non lue)
            y, xe = y - 10, xe - 10  # marge de 40 px (10 px d'origine) ajoutee par prep()
            x0, x1 = int(min(W - 24, xe + 6)), W - 24
            band = im.crop((max(0, x0), max(0, int(y) - 7), max(x0 + 1, x1), max(int(y) + 7, 1))) if x1 > x0 else None
            bt = band.tobytes() if band is not None else b''
            bg = sorted(bt)[len(bt) // 2] if bt else 255  # fond = mediane de la bande (theme sombre inverse != blanc)
            ink = sum(1 for v in bt if abs(v - bg) > 28) > 6  # texte grise (entree desactivee) compris
            if re.search(r'(Maj|Ctrl|Alt|Echap|Entr|Suppr|F\d+)\w*$', t): ink = True  # le raccourci est reste colle au libelle dans la ligne OCR
            rows[t] = None if ink else ''
        labels = [(y, t) for (y, t, xe) in labels]
        final[f] = {'rows': rows, 'orphans': [s for (y2, s) in scs if not any(abs(y - y2) < 7 for y, _ in labels)]}
    json.dump(final, open(outp, 'w', encoding='utf8'), ensure_ascii=False, indent=1)


if __name__ == '__main__': main(sys.argv[1], sys.argv[2])
