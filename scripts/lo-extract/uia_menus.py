# -*- coding: utf-8 -*-
"""Releve LECTURE SEULE (UI Automation, aucune souris ni frappe) de TOUS les menus et sous-menus de la vraie fenetre LO / OO.
  python uia_menus.py <soffice.exe> <profil> <sortie.json> [arg:--impress] [wait:s]
Sortie : {menus:[{name, x, y, w, h, items:[...]}]} ; item = {t:'i'|'s', name, acc, x, y, w, h, en, items?}. Rectangles relatifs a la fenetre."""
import json, os, subprocess, sys, time
import psutil
import uiautomation as auto

exe, prof, out = sys.argv[1:4]
extra = [a[4:] for a in sys.argv[4:] if a.startswith('arg:')]
wait = next((float(a[5:]) for a in sys.argv[4:] if a.startswith('wait:')), 20)
tag = os.path.basename(prof.replace(chr(92), '/').rstrip('/'))
proc = subprocess.Popen([exe, '-env:UserInstallation=file:///' + prof.replace(chr(92), '/'), '--norestore', '--nologo'] + extra)
time.sleep(wait)


def pid_of(w):
    try: return w.ProcessId
    except Exception: return -1


pids = {q.pid for q in psutil.process_iter(['name', 'cmdline']) if q.info['name'] in ('soffice.bin', 'soffice.exe') and tag in ' '.join(q.info['cmdline'] or [])}


def kids(c):
    try: return c.GetChildren()
    except Exception: return []


def find(c, t, d=0):
    for k in kids(c):
        try:
            if k.ControlTypeName == t: yield k
        except Exception:
            continue
        if d < 6: yield from find(k, t, d + 1)


def rect(k, R):
    b = k.BoundingRectangle
    return {'x': b.left - R.left, 'y': b.top - R.top, 'w': b.width(), 'h': b.height()}


def one(k, R, depth):
    if k.ControlTypeName == 'SeparatorControl':
        return {'t': '-', **rect(k, R)}
    # Les entrees radio (Affichage > Normal/Web/Brouillon, Alignement...) sont exposees en CustomControl / RadioButtonControl : on les garde aussi.
    if k.ControlTypeName not in ('MenuItemControl', 'RadioButtonControl', 'CheckBoxControl') and not (k.ControlTypeName == 'CustomControl' and k.Name):
        return None
    e = {'t': 'i', 'name': k.Name, 'k': (k.AccessKey or '').strip(), 'en': k.IsEnabled, **rect(k, R)}
    try: tg = k.GetTogglePattern().ToggleState
    except Exception: tg = None
    if tg is not None: e['chk'] = tg
    try:
        if k.GetExpandCollapsePattern().ExpandCollapseState != 3 and depth < 3:  # 3 = LeafNode
            e['t'] = 's'; e['items'] = read(k, R, depth + 1)
    except Exception:
        pass
    return e


def read(item, R, depth):
    """Ouvre `item` (Expand) et lit ses enfants ; recursif sur les sous-menus."""
    try: item.GetExpandCollapsePattern().Expand()
    except Exception as ex:
        print('expand fail', item.Name, ex); return []
    for _ in range(12):
        time.sleep(0.25)
        ks = kids(item)
        if ks: break
    res = []
    for k in ks:
        try:
            e = one(k, R, depth)
        except Exception:
            continue
        if e: res.append(e)
    try: item.GetExpandCollapsePattern().Collapse()
    except Exception: pass
    return res


def dismiss_wizard():
    """OpenOffice Impress ouvre d'abord « Assistant Presentation » (fenetre de premier niveau, contenu non expose par UIA) : clic sur « Creer » (en bas a droite), seulement si le premier plan est bien cette fenetre du PID lance et le point dans la fenetre."""
    import ctypes, win32gui
    from capture import send, IN, MI, u
    for w in auto.GetRootControl().GetChildren():
        if pid_of(w) in pids and w.Name.startswith('Assistant'):
            h = w.NativeWindowHandle
            for _ in range(5):
                win32gui.ShowWindow(h, 9)
                try: win32gui.SetForegroundWindow(h)
                except Exception: pass
                time.sleep(0.5)
                if win32gui.GetForegroundWindow() == h: break
            if win32gui.GetForegroundWindow() == h:
                l, t, r, b = win32gui.GetWindowRect(h)
                u.SetCursorPos(r - 63, b - 28); time.sleep(0.3)
                send(IN(type=0, mi=MI(0, 0, 0, 2, 0, None)), IN(type=0, mi=MI(0, 0, 0, 4, 0, None))); time.sleep(6)


dismiss_wizard()
try:
    win = next(w for w in auto.GetRootControl().GetChildren() if pid_of(w) in pids and w.BoundingRectangle.width() > 300)
    for d in kids(win):  # assistant « Selectionner un modele » d'Impress : modal, il bloque les menus
        if d.ControlTypeName == 'WindowControl':
            import win32gui, win32con
            win32gui.PostMessage(d.NativeWindowHandle, win32con.WM_CLOSE, 0, 0); time.sleep(2)
    R = win.BoundingRectangle
    def fresh_bar():
        for _ in range(20):  # la barre de menus peut mettre du temps a reapparaitre ; les references des entrees sont invalidees a chaque ouverture
            m = next((m for m in find(win, 'MenuBarControl') if len(kids(m)) > 3), None)
            if m: return m
            time.sleep(1)
        raise SystemExit('barre de menus introuvable')
    count = len(kids(fresh_bar()))
    menus = []
    for n in range(count):
        e = None
        for attempt in range(5):
            try:
                it = kids(fresh_bar())[n]
                e = {'name': it.Name, **rect(it, R)}
                e['items'] = read(it, R, 0)
            except Exception:
                e = {'name': (e or {}).get('name', '?'), 'items': []}
            if e['items']: break
            time.sleep(1.5 * (attempt + 1))
        time.sleep(0.6)
        menus.append(e)
    json.dump({'title': win.Name, 'menus': menus}, open(out, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
    print('menus', len(menus), 'items', sum(len(m['items']) for m in menus))
finally:
    try:
        import win32gui, win32con
        win32gui.PostMessage(win.NativeWindowHandle, win32con.WM_CLOSE, 0, 0); time.sleep(3)
    except Exception: pass
    for p in pids: subprocess.run(['taskkill', '/F', '/PID', str(p), '/T'], capture_output=True)
    proc.kill()
