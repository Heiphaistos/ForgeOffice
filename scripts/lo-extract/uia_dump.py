# -*- coding: utf-8 -*-
"""Releve LECTURE SEULE des rectangles de la vraie fenetre LO / OO par UI Automation (aucune souris, aucun clavier, aucune capture d'ecran).
  python uia_dump.py <soffice.exe> <profil> <sortie.json> [arg:--calc] [wait:s] [menu:N]
menu:N ouvre d'abord le menu N de la barre de menus par UIA (Invoke/Expand, pas de frappe) et inclut les entrees du popup.
Sortie : liste {type, name, x, y, w, h} en pixels relatifs a la fenetre principale du PID."""
import json, subprocess, sys, time, os
import uiautomation as auto

exe, prof, out = sys.argv[1:4]
extra = [a[4:] for a in sys.argv[4:] if a.startswith('arg:')]
wait = next((float(a[5:]) for a in sys.argv[4:] if a.startswith('wait:')), 16)
proc = subprocess.Popen([exe, '-env:UserInstallation=file:///' + prof.replace('\\', '/'), '--norestore', '--nologo'] + extra)
tag = os.path.basename(prof.rstrip('\\/'))
pid = None
for _ in range(60):
    r = subprocess.run(['powershell', '-NoProfile', '-Command', "(Get-CimInstance Win32_Process -Filter \"Name='soffice.bin'\" | Where-Object { $_.CommandLine -like '*%s*' } | Select-Object -First 1).ProcessId" % tag], capture_output=True, text=True)
    if r.stdout.strip().isdigit():
        pid = int(r.stdout.strip()); break
    time.sleep(1)
time.sleep(wait)
res = []
win = None
try:
    for w in auto.GetRootControl().GetChildren():
        if w.ProcessId == pid and w.BoundingRectangle.width() > 300:
            win = w; break
    if win is None:
        print('fenetre introuvable'); sys.exit(1)
    R = win.BoundingRectangle
    def walk(c, depth):
        if depth > 12: return
        try:
            kids = c.GetChildren()
        except Exception:
            return
        for k in kids:
            try:
                b = k.BoundingRectangle
                res.append({'type': k.ControlTypeName, 'name': k.Name, 'x': b.left - R.left, 'y': b.top - R.top, 'w': b.width(), 'h': b.height(), 'd': depth})
            except Exception:
                pass
            walk(k, depth + 1)
    walk(win, 0)
    json.dump(res, open(out, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
    print('items', len(res))
finally:
    try:
        import win32gui, win32con
        if win is not None: win32gui.PostMessage(win.NativeWindowHandle, win32con.WM_CLOSE, 0, 0)  # sortie propre, pas d'assistant de recuperation au lancement suivant
        time.sleep(4)
    except Exception:
        pass
    subprocess.run(['taskkill', '/F', '/PID', str(pid), '/T'], capture_output=True)
    proc.kill()
