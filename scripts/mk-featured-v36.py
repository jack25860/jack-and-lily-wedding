#!/usr/bin/env python3
"""Featured-only contact sheet: 3 columns (ZG/TG/P) x 6 rows, to verify couple shots."""
import os
from PIL import Image, ImageDraw

D = "images/album"
FEAT = {
    "ZG": ["zg1", "zg2", "zg3", "zg4", "n03", "n04"],
    "TG": ["tg1", "tg2", "tg3", "tg4", "n09", "n13"],
    "P":  ["p20", "p49", "p50", "p52", "p54", "p56"],
}
cols, rows, tw, th = 3, 6, 360, 300
sheet = Image.new("RGB", (cols*tw, rows*th), (18, 18, 18))
dr = ImageDraw.Draw(sheet)
for c, (theme, files) in enumerate(FEAT.items()):
    for r, f in enumerate(files):
        im = Image.open(os.path.join(D, f + ".jpg")).convert("RGB")
        im.thumbnail((tw-10, th-34))
        x = c*tw + 5
        y = r*th + 28
        sheet.paste(im, (x, y))
        dr.text((x+2, y-22), f"{theme}:{f}", fill=(255, 220, 120))
sheet.save("sheets/v36_featured18.jpg", quality=85)
print("saved sheets/v36_featured18.jpg")
