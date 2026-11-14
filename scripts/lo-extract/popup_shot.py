# -*- coding: utf-8 -*-
"""Photographie (PrintWindow de la FENETRE du popup, jamais l'ecran) des popups de menu de la vraie fenetre LO / OO, ouverts par UI Automation (Expand, aucune souris ni frappe).
Sert a LIRE les raccourcis (colonne de droite) que UIA n'expose pas, et a deduire la largeur du texte de raccourci.
  python popup_shot.py <soffice.exe> <profil> <dossier> [arg:--calc] [wait:s] "Affichage" "Format>Texte" ...
Chemin = noms de menus separes par '>' (comparaison sans accents ni mnemoniques)."""
import os, subprocess, sys, time, unicodedata
import psutil
import uiautomation as auto
from capture import grab, pid_windows, u
from ctypes import wintypes
import ctypes

exe, prof, out = sys.argv[1:4]
extra = [a[4:] for a in sys.argv[4:] if a.startswith('arg:')]
wait = next((float(a[5:]) for a in sys.argv[4:] if a.startswith('wait:')), 22)
paths = [a for a in sys.argv[4:] if not a.startswith(('arg:', 'wait:'))]
os.makedirs(out, exist_ok=True)
tag = os.path.basename(prof.replace(chr(92), '/').rstrip('/'))
proc = subprocess.Popen([exe, '-env:UserInstallation=file:///' + prof.replace(chr(92), '/'), '--norestore', '--nologo'] + extra)
time.sleep(wait)
fold = lambda s: ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c)).lower().replace('...', '').strip()
pids = {q.pid for q in psutil.process_iter(['name', 'cmdline']) if q.info['name'] in ('soffice.bin', 'soffice.exe') and tag in ' '.join(q.info['cmdline'] or [])}
kids = lambda c: c.GetChildren()
win = next(w for w in auto.GetRootControl().GetChildren() if w.ProcessId in pids and w.BoundingRectangle.width() > 300)
try:
    for d in kids(win):  # assistant modal d'Impress
        if d.ControlTypeName == 'WindowControl':
            import win32gui, win32con
            win32gui.PostMessage(d.NativeWindowHandle, win32con.WM_CLOSE, 0, 0); time.sleep(2)
    for n, path in enumerate(paths):
        bar = next(m for m in kids(win) if m.ControlTypeName == 'MenuBarControl' and len(kids(m)) > 3)
        node, chain = bar, []
        for part in path.split('>'):
            node = next(k for k in kids(node) if k.ControlTypeName == 'MenuItemControl' and fold(k.Name) == fold(part))
            node.GetExpandCollapsePattern().Expand(); time.sleep(0.8); chain.append(node)
        first = None
        for _ in range(12):
            first = next((k for k in kids(node) if k.BoundingRectangle.width() > 10), None)
            if first: break
            time.sleep(0.4)
        if not first: print(path, 'entrees introuvables'); continue
        c = first.BoundingRectangle
        cx, cy = (c.left + c.right) // 2, (c.top + c.bottom) // 2
        best = None
        for h in sum(([x] for p in pids for x in pid_windows(p)), []):
            r = wintypes.RECT(); u.GetWindowRect(h, ctypes.byref(r))
            if r.left <= cx <= r.right and r.top <= cy <= r.bottom:
                a = (r.right - r.left) * (r.bottom - r.top)
                if best is None or a < best[0]: best = (a, h, r.right - r.left)
        if best:
            f = os.path.join(out, '%02d_%s.png' % (n, path.replace('>', '_').replace(' ', '')))
            grab(best[1], f); print(path, 'popup', best[2], 'px ->', f)
        else:
            print(path, 'popup introuvable')
        for nd in reversed(chain):
            try: nd.GetExpandCollapsePattern().Collapse()
            except Exception: pass
        time.sleep(0.4)
finally:
    try:
        import win32gui, win32con
        win32gui.PostMessage(win.NativeWindowHandle, win32con.WM_CLOSE, 0, 0); time.sleep(3)
    except Exception: pass
    for p in pids: subprocess.run(['taskkill', '/F', '/PID', str(p), '/T'], capture_output=True)
    proc.kill()
