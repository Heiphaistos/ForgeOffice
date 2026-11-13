# -*- coding: utf-8 -*-
"""Pilote borne d'OnlyOffice Desktop : clics brefs DANS sa fenetre seulement, capture par PrintWindow.
Usage : python drive.py <motif titre> <dossier sortie> <nom:x:y> [<nom:x:y> ...]
 - x:y en coordonnees client ; un nom 'k_...' envoie la touche (ex. k_echap:0:0) ; 'wait' pause.
Garde-fou : avant chaque clic, la fenetre sous le point doit etre celle d'OnlyOffice (sinon arret)."""
import ctypes
import os
import sys
import time
from ctypes import wintypes

sys.path.insert(0, "D:/Projet/outils")
sys.path.insert(0, os.path.dirname(__file__))
import clic_reel as cr  # noqa: E402
import winshot  # noqa: E402

user32 = ctypes.WinDLL("user32", use_last_error=True)


def sous_le_point(hwnd, x, y):
    pt = wintypes.POINT(x, y)
    user32.ClientToScreen(hwnd, ctypes.byref(pt))
    h = user32.WindowFromPoint(pt)
    return user32.GetAncestor(h, 2) == hwnd  # GA_ROOT


def main():
    motif, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    hwnd = cr.resoudre(motif)
    cr.avant(hwnd)
    for spec in sys.argv[3:]:
        name, x, y = spec.split(":")
        x, y = int(x), int(y)
        if name.startswith("k_"):
            cr.touche(name[2:])
            time.sleep(0.8)
        elif name == "wait":
            time.sleep(x)
            continue
        elif name != "shot":
            if not sous_le_point(hwnd, x, y):
                sys.exit("garde-fou : le point %d,%d n'est pas dans la fenetre OnlyOffice" % (x, y))
            cr.clic(hwnd, x, y)
            time.sleep(1.0)
        winshot.shot(hwnd, os.path.join(out, name.replace("k_", "") + ".png"))
        print("ok", name)


if __name__ == "__main__":
    main()
