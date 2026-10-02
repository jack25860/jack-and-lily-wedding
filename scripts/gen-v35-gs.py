# -*- coding: utf-8 -*-
"""v35: add full ECARD_PHOTO_POOL + version bump to scripts/rsvp-to-sheet.gs"""
import os, io, json

V = "/workspace/webpages/jack-and-lily-wedding-v35"
GS = os.path.join(V, "scripts", "rsvp-to-sheet.gs")
ALB = os.path.join(V, "images", "album")

def num(f): return int("".join(c for c in f if c.isdigit()))
names = sorted(os.listdir(ALB))
pool = ["images/album/" + f for f in
        sorted([n for n in names if n.startswith("zg")], key=num) +
        sorted([n for n in names if n.startswith("tg")], key=num) +
        sorted([n for n in names if n.startswith("p")], key=num) +
        [n for n in names if n.startswith("n")]]
assert len(pool) == 142, len(pool)

lines = ",\n  ".join("'" + p + "'" for p in pool)
pool_block = (
    "/** \u96fb\u5b50\u559c\u5e16\u96a8\u6a5f\u5a5a\u7d17\u7167\u6c60\uff1a\u6db5\u84cb\u76f8\u7c3f\u5168\u90e8\u7167\u7247\uff08\u6230\u570b 14 + \u5510\u4ee3 47 + \u660e\u671d 81 = 142\uff09\n"
    " *  \u524d\u7aef\u6703\u5f9e js/config.js \u7684 ECARD_PHOTO_POOL \u96a8\u6a5f\u9078\u4e00\u5f35\u4e26\u4ee5 photo \u50b3\u5165\uff1b\n"
    " *  \u82e5\u524d\u7aef\u672a\u50b3\u5165 photo\uff0c\u672c\u8173\u672c\u6703\u5f9e\u6b64\u6e05\u55ae\u81ea\u884c\u96a8\u6a5f\u6311\u9078\uff0c\u78ba\u4fdd\u96d9\u65b9\u4e00\u81f4\u3002 */\n"
    "var ECARD_PHOTO_POOL = [\n  " + lines + "\n];\n\n"
    "/** \u96a8\u6a5f\u9078\u4e00\u5f35\u5a5a\u7d17\u7167\u7db2\u5740 */\n"
    "function randomPhoto_() {\n"
    "  if (!ECARD_PHOTO_POOL.length) return '';\n"
    "  return ECARD_PHOTO_POOL[Math.floor(Math.random() * ECARD_PHOTO_POOL.length)];\n"
    "}\n"
)

src = io.open(GS, encoding="utf-8").read()

a = src.index("var ECARD_SENDER_NAME =")
b = src.index("var ENDPOINT_VERSION = 'v34';") + len("var ENDPOINT_VERSION = 'v34';")
src = src[:a] + "var ECARD_SENDER_NAME = '\u4e09\u751f\u4e09\u4e16\u30fb\u7de3\u5b9a\u4eca\u751f';\n\n" + pool_block + "\nvar ENDPOINT_VERSION = 'v35';" + src[b:]

# server-side fallback when the client did not send a photo
old = "  var photoUrl = pick_(data, ['photo']);"
new = ("  var photoUrl = pick_(data, ['photo']) || randomPhoto_();\n"
       "  if (photoUrl && photoUrl.indexOf('http') !== 0) photoUrl = SITE_BASE + photoUrl;")
assert old in src
src = src.replace(old, new, 1)

# base url for relative photo paths
anc = "var ECARD_SENDER_NAME ="
src = src.replace(anc, "/** \u5a5a\u79ae\u7db2\u7ad9\u57df\u540d\uff08\u7528\u65bc\u5c07\u76f8\u5c0d\u8def\u5f91\u8f49\u6210\u7d55\u5c0d\u7db2\u5740\uff09 */\nvar SITE_BASE = 'https://jack25860.github.io/jack-and-lily-wedding/';\n\n" + anc, 1)

io.open(GS, "w", encoding="utf-8").write(src)
print("pool entries:", len(pool))
print("version bumped to v35")
