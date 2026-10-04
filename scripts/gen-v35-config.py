# -*- coding: utf-8 -*-
"""v35: rebuild GALLERY_THEMES (戰國/唐代/明朝) + ECARD_PHOTO_POOL (all photos) in js/config.js"""
import os, io, sys

V = "webpages/jack-and-lily-wedding-v35"
CFG = os.path.join(V, "js", "config.js")
ALB = os.path.join(V, "images", "album")

names = sorted(os.listdir(ALB))
def grp(pref): return [n for n in names if n.startswith(pref)]

zg = grp("zg")                 # 戰國 originals
tg = grp("tg")                 # 唐代 originals
p  = grp("p")                  # 明朝 originals
n  = grp("n")

def num(f): return int("".join(c for c in f if c.isdigit()))

# v35 classification from vision pass: n01-n08 = 戰國, n09-n49 = 唐代, n50-n74 = 明朝
war  = [f for f in n if 1  <= num(f) <= 8]
tang = [f for f in n if 9  <= num(f) <= 49]
ming = [f for f in n if 50 <= num(f) <= 74]

ZG_ALL   = zg + war                     # 6 + 8 = 14
TANG_ALL = tg + tang                    # 6 + 41 = 47
MING_ALL = p + ming                     # 56 + 25 = 81
assert len(ZG_ALL) == 14 and len(TANG_ALL) == 47 and len(MING_ALL) == 81, (len(ZG_ALL), len(TANG_ALL), len(MING_ALL))
TOTAL = len(ZG_ALL) + len(TANG_ALL) + len(MING_ALL)
assert TOTAL == 142, TOTAL

# preview (6 each) — every entry verified as a COUPLE (兩人合照) shot
FEAT = {
    "戰國": ["zg1.jpg", "zg2.jpg", "zg3.jpg", "zg4.jpg", "n03.jpg", "n04.jpg"],
    "唐代": ["tg1.jpg", "tg2.jpg", "tg3.jpg", "tg4.jpg", "n09.jpg", "n13.jpg"],
    "明朝": ["p20.jpg", "p49.jpg", "p50.jpg", "p52.jpg", "p54.jpg", "p56.jpg"],
}

def jstr(s): return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'

def block(files, name, featured):
    def item(f, i):
        return "{SRC:%s,ALT:%s}" % (jstr("images/album/" + f), jstr(u"%s 婚紗照 %d" % (name, i + 1)))
    feat = [f for f in files if f in featured]
    more = [f for f in files if f not in featured]
    # keep featured in the configured order
    feat = [f for f in featured if f in files]
    return feat, more

themes = [
    (u"戰國", "WARRING STATES", u"金戈鐵馬，一世相許。", ZG_ALL),
    (u"唐代", "TANG DYNASTY",  u"盛世繁華，執手同遊。", TANG_ALL),
    (u"明朝", "MING DYNASTY",  u"衣冠如畫，一世相守。", MING_ALL),
]

parts = []
pool = []
for name, en, sub, files in themes:
    feat, more = block(files, name, FEAT[name])
    assert len(feat) == 6, (name, len(feat))
    fs = ",".join("{SRC:%s,ALT:%s}" % (jstr("images/album/" + f), jstr(u"%s 婚紗照 %d" % (name, i + 1))) for i, f in enumerate(feat))
    ms = ",".join("{SRC:%s,ALT:%s}" % (jstr("images/album/" + f), jstr(u"%s 婚紗照 %d" % (name, 6 + i + 1))) for i, f in enumerate(more))
    parts.append('{NAME:%s,EN:%s,SUB:%s,FEATURED:[%s],MORE:[%s]}' % (jstr(name), jstr(en), jstr(sub), fs, ms))
    pool += files
    print("[%s] featured=%d more=%d total=%d" % (name, len(feat), len(more), len(feat) + len(more)))

GALLERY = "GALLERY_THEMES:[" + ",".join(parts) + "]"
POOL = "ECARD_PHOTO_POOL:[" + ",".join(jstr("images/album/" + f) for f in pool) + "]"

src = io.open(CFG, encoding="utf-8").read()

# --- replace GALLERY_THEMES ---
a = src.index("GALLERY_THEMES:[")
b = src.index(",E_INVITATION_VIDEO_URL:")
src = src[:a] + GALLERY + src[b:]

# --- replace ECARD_PHOTO_POOL ---
a = src.index("ECARD_PHOTO_POOL:[")
b = src.index(",ECARD_VIDEO_URL:")
src = src[:a] + POOL + src[b:]

io.open(CFG, "w", encoding="utf-8").write(src)
print("gallery themes:", len(parts), "| pool:", len(pool))
print("OK")
