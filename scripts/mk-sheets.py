from PIL import Image, ImageDraw
import os, math

d = "images/album"
out = "sheets"
os.makedirs(out, exist_ok=True)

def key(f):
    p = f[0]
    order = {"z": 0, "t": 1, "p": 2, "n": 3}
    return (order.get(p, 9), int("".join(c for c in f if c.isdigit()) or 0))

files = sorted([f for f in os.listdir(d) if f.endswith(".jpg")], key=key)
print("total", len(files))

cols, rows, tw, th = 4, 4, 360, 300
per = cols * rows
for s in range(math.ceil(len(files) / per)):
    chunk = files[s * per:(s + 1) * per]
    sheet = Image.new("RGB", (cols * tw, rows * th), (18, 18, 18))
    dr = ImageDraw.Draw(sheet)
    for i, f in enumerate(chunk):
        im = Image.open(os.path.join(d, f)).convert("RGB")
        im.thumbnail((tw - 10, th - 34))
        x = (i % cols) * tw + 5
        y = (i // cols) * th + 26
        sheet.paste(im, (x, y))
        dr.rectangle([x - 3, y - 24, x + im.width + 3, y - 2], fill=(0, 0, 0))
        dr.text((x, y - 20), f.replace(".jpg", "").upper(), fill=(255, 214, 90))
    p = os.path.join(out, "sheet_%d.jpg" % (s + 1))
    sheet.save(p, quality=82)
    print(p, len(chunk), chunk[0], "->", chunk[-1])
