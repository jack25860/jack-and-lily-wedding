#!/usr/bin/env python3
"""Build labeled contact sheets for the v36 album re-classification."""
import os, math, sys
from PIL import Image, ImageDraw

D = "images/album"
OUT = "sheets"
os.makedirs(OUT, exist_ok=True)

def natkey(f):
    base = f.replace(".jpg", "")
    pre = "".join(c for c in base if c.isalpha())
    num = "".join(c for c in base if c.isdigit())
    return (pre, int(num) if num else 0)

files = sorted([f for f in os.listdir(D) if f.endswith(".jpg")], key=natkey)
print("total files:", len(files))

cols, rows, tw, th = 4, 4, 320, 420
per = cols * rows
n = math.ceil(len(files) / per)
for s in range(n):
    chunk = files[s*per:(s+1)*per]
    sheet = Image.new("RGB", (cols*tw, rows*th), (18, 18, 18))
    dr = ImageDraw.Draw(sheet)
    for i, f in enumerate(chunk):
        im = Image.open(os.path.join(D, f)).convert("RGB")
        im.thumbnail((tw-10, th-34))
        x = (i % cols)*tw + 5
        y = (i // cols)*th + 28
        sheet.paste(im, (x, y))
        dr.text((x+2, y-22), f.replace(".jpg", ""), fill=(255, 220, 120))
    p = f"{OUT}/v36_sheet_{s+1}.jpg"
    sheet.save(p, quality=82)
    print(p, "->", [c.replace('.jpg','') for c in chunk])
