# -*- coding: utf-8 -*-
"""Capture d'UNE fenetre (PrintWindow, jamais l'ecran entier). Usage :
  python winshot.py liste                      fenetres visibles (titre, classe, pid)
  python winshot.py <motif titre> <sortie.png>  capture la fenetre dont le titre contient le motif
La capture ne touche ni a la souris ni au premier plan."""
import ctypes
import sys
from ctypes import wintypes

from PIL import Image

user32 = ctypes.WinDLL("user32", use_last_error=True)
gdi32 = ctypes.WinDLL("gdi32", use_last_error=True)
user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]


def windows():
    out = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def cb(h, _):
        if user32.IsWindowVisible(h):
            t = ctypes.create_unicode_buffer(256)
            c = ctypes.create_unicode_buffer(256)
            user32.GetWindowTextW(h, t, 256)
            user32.GetClassNameW(h, c, 256)
            pid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(h, ctypes.byref(pid))
            out.append((h, t.value, c.value, pid.value))
        return True

    user32.EnumWindows(cb, 0)
    return out


def shot(hwnd, path):
    r = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(r))
    w, h = r.right - r.left, r.bottom - r.top
    dc = user32.GetWindowDC(hwnd)
    mem = gdi32.CreateCompatibleDC(dc)
    bmp = gdi32.CreateCompatibleBitmap(dc, w, h)
    gdi32.SelectObject(mem, bmp)
    user32.PrintWindow(hwnd, mem, 2)  # PW_RENDERFULLCONTENT

    class BIH(ctypes.Structure):
        _fields_ = [("s", wintypes.DWORD), ("w", wintypes.LONG), ("h", wintypes.LONG), ("p", wintypes.WORD), ("b", wintypes.WORD),
                    ("c", wintypes.DWORD), ("i", wintypes.DWORD), ("x", wintypes.LONG), ("y", wintypes.LONG), ("u", wintypes.DWORD), ("m", wintypes.DWORD)]

    bih = BIH(ctypes.sizeof(BIH), w, -h, 1, 32, 0, 0, 0, 0, 0, 0)
    buf = ctypes.create_string_buffer(w * h * 4)
    gdi32.GetDIBits(mem, bmp, 0, h, buf, ctypes.byref(bih), 0)
    Image.frombuffer("RGBA", (w, h), buf, "raw", "BGRA", 0, 1).convert("RGB").save(path)
    gdi32.DeleteObject(bmp)
    gdi32.DeleteDC(mem)
    user32.ReleaseDC(hwnd, dc)
    return w, h


if __name__ == "__main__":
    if sys.argv[1] == "liste":
        for h, t, c, p in windows():
            if t:
                print(h, repr(t), c, p)
    else:
        motif = sys.argv[1].lower()
        hit = [x for x in windows() if motif in x[1].lower()]
        if not hit:
            sys.exit("fenetre introuvable")
        print(shot(hit[0][0], sys.argv[2]))
