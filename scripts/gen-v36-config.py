#!/usr/bin/env python3
"""Regenerate v36 GALLERY_THEMES + ECARD_PHOTO_POOL in js/config.js and scripts/rsvp-to-sheet.gs
with the CORRECTED dynasty classification (verified visually)."""
import re, json, os

# ---- Corrected classification (visually verified) ----
ZG = ["zg%d" % i for i in range(1, 7)] + ["n%02d" % i for i in range(1, 9)] + ["n%02d" % i for i in range(50, 75)]  # 39
TG = ["tg%d" % i for i in range(1, 7)] + ["n%02d" % i for i in range(9, 50)]     # 47
P  = ["p%02d" % i for i in range(1, 57)]                                          # 56
assert len(ZG) == 39 and len(TG) == 47 and len(P) == 56, (len(ZG), len(TG), len(P))
ALL = ZG + TG + P
assert len(ALL) == 142 and len(set(ALL)) == 142

FEAT = {
    "ZG": ["zg1", "zg2", "zg3", "zg4", "n03", "n04"],
    "TG": ["tg1", "tg2", "tg3", "tg4", "n09", "n13"],
    "P":  ["p20", "p49", "p50", "p52", "p54", "p56"],
}
THEMES = [
    ("ZG", "戰國", "WARRING STATES", "金戈鐵馬，一世相許。"),
    ("TG", "唐代", "TANG DYNASTY", "盛世繁華，執手同遊。"),
    ("P",  "明朝", "MING DYNASTY", "衣冠如畫，一世相守。"),
]

def src(f): return "images/album/%s.jpg" % f

# ---- Build GALLERY_THEMES JS ----
parts = []
for key, name, en, sub in THEMES:
    feats = FEAT[key]
    more = [f for f in {"ZG": ZG, "TG": TG, "P": P}[key] if f not in feats]
    fjs = ",".join('{SRC:"%s",ALT:"%s 婚紗照 %d"}' % (src(f), name, i + 1) for i, f in enumerate(feats))
    mjs = ",".join('{SRC:"%s",ALT:"%s 婚紗照 %d"}' % (src(f), name, i + 1 + len(feats)) for i, f in enumerate(more))
    parts.append('{NAME:"%s",EN:"%s",SUB:"%s",FEATURED:[%s],MORE:[%s]}' % (name, en, sub, fjs, mjs))
gallery_js = "GALLERY_THEMES:[" + ",".join(parts) + "]"

# ---- Build ECARD_PHOTO_POOL JS ----
pool_js = "ECARD_PHOTO_POOL:[" + ",".join('"%s"' % src(f) for f in ALL) + "]"

# ---- Patch js/config.js ----
cfg = open("js/config.js", encoding="utf-8").read()
cfg2 = re.sub(r"GALLERY_THEMES:\[.*?\],E_INVITATION_VIDEO_URL", gallery_js + ",E_INVITATION_VIDEO_URL", cfg, count=1, flags=re.S)
assert cfg2 != cfg, "GALLERY_THEMES not replaced"
cfg3 = re.sub(r"ECARD_PHOTO_POOL:\[.*?\],ECARD_VIDEO_URL", pool_js + ",ECARD_VIDEO_URL", cfg2, count=1, flags=re.S)
assert cfg3 != cfg2, "ECARD_PHOTO_POOL not replaced"
open("js/config.js", "w", encoding="utf-8").write(cfg3)
print("config.js patched")

# ---- Patch scripts/rsvp-to-sheet.gs ----
gs = open("scripts/rsvp-to-sheet.gs", encoding="utf-8").read()
lines = ["var ECARD_PHOTO_POOL = ["]
for key, name, en, sub in THEMES:
    grp = {"ZG": ZG, "TG": TG, "P": P}[key]
    lines.append("  // %s %s (%d)" % (name, en, len(grp)))
    for i, f in enumerate(grp):
        comma = "," if not (key == "P" and i == len(grp) - 1) else ""
        lines.append("  '%s'%s" % (src(f), comma))
lines.append("];")
new_pool = "\n".join(lines)
gs2 = re.sub(r"var ECARD_PHOTO_POOL = \[.*?\n\];", new_pool, gs, count=1, flags=re.S)
assert gs2 != gs, "gs pool not replaced"
gs3 = gs2.replace("var ENDPOINT_VERSION = 'v35';", "var ENDPOINT_VERSION = 'v36';")
assert gs3 != gs2, "version not replaced"
gs3 = gs3.replace("涵蓋相簿全部照片（戰國 14 + 唐代 47 + 明朝 81 = 142）", "涵蓋相簿全部照片（戰國 39 + 唐代 47 + 明朝 56 = 142）")
open("scripts/rsvp-to-sheet.gs", "w", encoding="utf-8").write(gs3)
print("rsvp-to-sheet.gs patched")

# ---- Report ----
print("ZG", len(ZG), "TG", len(TG), "P", len(P), "TOTAL", len(ALL))
print("featured per theme:", {k: len(v) for k, v in FEAT.items()})
