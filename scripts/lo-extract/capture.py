# -*- coding: utf-8 -*-
"""Photographie la VRAIE fenetre LibreOffice / OpenOffice (PrintWindow par PID, jamais l'ecran) apres des frappes reelles bornees.

  python capture.py <soffice.exe> <profil> <dossier> <etape>...
Etapes : wait:<s> | key:<combo> (ex. key:alt+o, key:ctrl+f12, key:enter) | text:<abc> | shot:<nom> | kill
Chaque frappe verifie d'abord que le premier plan appartient bien au PID lance ; sinon arret. Les fenetres du PID (principale, menus, dialogues) sont toutes capturees par shot.
"""
import ctypes, os, subprocess, sys, time
from ctypes import wintypes
from PIL import Image

u = ctypes.WinDLL('user32', use_last_error=True)
g = ctypes.WinDLL('gdi32', use_last_error=True)
VK = {'enter': 0x0D, 'esc': 0x1B, 'tab': 0x09, 'alt': 0x12, 'ctrl': 0x11, 'shift': 0x10, 'down': 0x28, 'up': 0x26, 'right': 0x27, 'left': 0x25, 'space': 0x20, 'f1': 0x70, 'f7': 0x76, 'f11': 0x7A, 'f12': 0x7B, 'home': 0x24, 'pgdn': 0x22}


class KI(ctypes.Structure):
    _fields_ = [('wVk', wintypes.WORD), ('wScan', wintypes.WORD), ('dwFlags', wintypes.DWORD), ('time', wintypes.DWORD), ('x', ctypes.c_void_p)]


class MI(ctypes.Structure):
    _fields_ = [('dx', wintypes.LONG), ('dy', wintypes.LONG), ('d', wintypes.DWORD), ('f', wintypes.DWORD), ('t', wintypes.DWORD), ('x', ctypes.c_void_p)]


class U(ctypes.Union):
    _fields_ = [('ki', KI), ('mi', MI)]


class IN(ctypes.Structure):
    _anonymous_ = ('u',)
    _fields_ = [('type', wintypes.DWORD), ('u', U)]


def send(*ev):
    arr = (IN * len(ev))(*ev)
    u.SendInput(len(ev), arr, ctypes.sizeof(IN))


def kev(vk, up=False, uni=None):
    if uni is not None:
        return IN(type=1, ki=KI(0, ord(uni), 4 | (2 if up else 0), 0, None))
    return IN(type=1, ki=KI(vk, 0, 2 if up else 0, 0, None))


def vk_of(n):
    return VK[n] if n in VK else ord(n.upper())


def pid_windows(pid):
    out = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def cb(h, _):
        p = wintypes.DWORD()
        u.GetWindowThreadProcessId(h, ctypes.byref(p))
        if p.value == pid and u.IsWindowVisible(h):
            r = wintypes.RECT()
            u.GetWindowRect(h, ctypes.byref(r))
            if r.right - r.left > 20 and r.bottom - r.top > 10:
                out.append(h)
        return True
    u.EnumWindows(cb, 0)
    return out


def grab(h, path):
    r = wintypes.RECT()
    u.GetWindowRect(h, ctypes.byref(r))
    w, hh = r.right - r.left, r.bottom - r.top
    dc = u.GetWindowDC(h)
    mdc = g.CreateCompatibleDC(dc)
    bmp = g.CreateCompatibleBitmap(dc, w, hh)
    g.SelectObject(mdc, bmp)
    u.PrintWindow(h, mdc, 2)

    class BH(ctypes.Structure):
        _fields_ = [('s', wintypes.DWORD), ('w', wintypes.LONG), ('h', wintypes.LONG), ('p', wintypes.WORD), ('b', wintypes.WORD), ('c', wintypes.DWORD), ('si', wintypes.DWORD), ('x', wintypes.LONG), ('y', wintypes.LONG), ('u', wintypes.DWORD), ('i', wintypes.DWORD)]
    bi = BH(40, w, -hh, 1, 32, 0, 0, 0, 0, 0, 0)
    buf = ctypes.create_string_buffer(w * hh * 4)
    g.GetDIBits(mdc, bmp, 0, hh, buf, ctypes.byref(bi), 0)
    Image.frombuffer('RGBA', (w, hh), buf, 'raw', 'BGRA', 0, 1).convert('RGB').save(path)
    g.DeleteObject(bmp); g.DeleteDC(mdc); u.ReleaseDC(h, dc)


def find_pid(tag, proc):
    """soffice.exe relance soffice.bin : on retrouve le vrai PID par la ligne de commande (profil unique)."""
    for _ in range(60):
        r = subprocess.run(['powershell', '-NoProfile', '-Command', "(Get-CimInstance Win32_Process -Filter \"Name='soffice.bin'\" | Where-Object { $_.CommandLine -like '*%s*' } | Select-Object -First 1).ProcessId" % tag], capture_output=True, text=True)
        if r.stdout.strip().isdigit():
            return int(r.stdout.strip())
        time.sleep(1)
    return proc.pid


def main():
    exe, prof, out = sys.argv[1:4]
    os.makedirs(out, exist_ok=True)
    args = [exe, '-env:UserInstallation=file:///' + prof.replace('\\', '/'), '--norestore', '--nologo']
    extra = [a[4:] for a in sys.argv[4:] if a.startswith('arg:')]
    proc = subprocess.Popen(args + extra)
    pid = find_pid(os.path.basename(prof.rstrip('\\/')), proc)
    print('pid', pid)
    try:
        for step in [s for s in sys.argv[4:] if not s.startswith('arg:')]:
            k, _, v = step.partition(':')
            if k == 'wait':
                time.sleep(float(v))
            elif k == 'shot':
                for i, h in enumerate(pid_windows(pid)):
                    grab(h, os.path.join(out, '%s_%d.png' % (v, i)))
                print('shot', v, len(pid_windows(pid)))
            elif k in ('key', 'text'):
                fg = u.GetForegroundWindow()
                p = wintypes.DWORD()
                u.GetWindowThreadProcessId(fg, ctypes.byref(p))
                for _ in range(8):
                    if p.value == pid:
                        break
                    time.sleep(0.5)
                    ws = pid_windows(pid)
                    if ws:
                        u.ShowWindow(ws[-1], 9); u.SetForegroundWindow(ws[-1])
                    u.GetWindowThreadProcessId(u.GetForegroundWindow(), ctypes.byref(p))
                if True:
                    if p.value != pid:
                        print('premier plan != LO, arret'); break
                if k == 'text':
                    for c in v:
                        send(kev(0, uni=c), kev(0, True, c)); time.sleep(0.02)
                else:
                    keys = [vk_of(x) for x in v.split('+')]
                    send(*[kev(x) for x in keys], *[kev(x, True) for x in reversed(keys)])
                time.sleep(0.5)
            elif k == 'click':  # click:x,y = pixels de la capture (fenetre principale du PID) ; refuse tout point hors de cette fenetre
                x, y = (int(n) for n in v.split(','))
                ws = pid_windows(pid)
                r = wintypes.RECT(); u.GetWindowRect(ws[-1], ctypes.byref(r))
                if not (0 <= x < r.right - r.left and 0 <= y < r.bottom - r.top):
                    print('clic hors fenetre, arret'); break
                u.ShowWindow(ws[-1], 9); u.SetForegroundWindow(ws[-1]); time.sleep(0.3)
                sx, sy = r.left + x, r.top + y
                cx, cy = u.GetSystemMetrics(0), u.GetSystemMetrics(1)
                u.SetCursorPos(sx, sy); time.sleep(0.2)
                send(IN(type=0, mi=MI(0, 0, 0, 2, 0, None)), IN(type=0, mi=MI(0, 0, 0, 4, 0, None))); time.sleep(0.8)
            elif k == 'kill':
                break
    finally:
        try:  # sortie propre (evite l'assistant de recuperation au lancement suivant)
            send(kev(0x11), kev(0x51), kev(0x51, True), kev(0x11, True)); time.sleep(3)
        except OSError:
            pass
        proc.kill()
        subprocess.run(['taskkill', '/F', '/PID', str(pid), '/T'], capture_output=True)


if __name__ == '__main__':
    main()
