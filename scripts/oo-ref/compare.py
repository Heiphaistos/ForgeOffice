# -*- coding: utf-8 -*-
"""Planche de comparaison : reference (haut) et ForgeOffice (bas), meme zone. Usage : compare.py ref.png mien.png sortie.png [x0 y0 x1 y1]"""
import sys
from PIL import Image
a, b, out = sys.argv[1:4]
box = tuple(int(v) for v in sys.argv[4:8]) if len(sys.argv) >= 8 else (0, 0, 1440, 215)
A, B = Image.open(a).convert('RGB').crop(box), Image.open(b).convert('RGB').crop(box)
sheet = Image.new('RGB', (A.width, A.height * 2 + 6), (255, 0, 255))
sheet.paste(A, (0, 0)); sheet.paste(B, (0, A.height + 6)); sheet.save(out)
