#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v111 patch: change the link-preview title and description.

Before (v110):
  <title>三生三世・緣定今生｜Jack ＆ Lily 婚禮邀請</title>
  og:title       三生三世・緣定今生｜Jack ＆ Lily
  og:description 我們騎著各自的馬，走進同一段旅程。從相遇，到相知；從相愛，到相守。這一世，我們決定不再錯過。

After (v111) — matches the second reference screenshot:
  <title>王有岑 & 杜伊穠 | 婚禮邀請暨報名</title>
  og:title       王有岑 & 杜伊穠 | 婚禮邀請暨報名
  og:description 三生三世・緣定今生
                 我們騎著各自的馬，走進同一段旅程。誠摯邀請您見證我們的重要時刻，歡迎填寫出席報名，與我們共享幸福喜悅。

Also: js/app.js overwrites document.title on load with
  SITE_TITLE + "｜" + groom + " ＆ " + bride + " 婚禮邀請"
so the tab title would stay old unless that line is changed too.

Nothing else is touched: no layout, no styles, no other copy, no scripts.
"""
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TITLE = "王有岑 & 杜伊穠 | 婚禮邀請暨報名"
DESC = ("三生三世・緣定今生&#10;"
        "我們騎著各自的馬，走進同一段旅程。"
        "誠摯邀請您見證我們的重要時刻，歡迎填寫出席報名，與我們共享幸福喜悅。")


def read(rel):
    with io.open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def write(rel, text):
    with io.open(os.path.join(ROOT, rel), "w", encoding="utf-8", newline="") as f:
        f.write(text)


def sub_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        sys.exit("FAIL [%s]: expected 1 occurrence, found %d" % (label, n))
    return text.replace(old, new, 1)


# ── index.html ────────────────────────────────────────────────────────────────
idx = read("index.html")

idx = sub_once(idx, '<meta name="site-version" content="v110">',
               '<meta name="site-version" content="v111">', "site-version")

idx = sub_once(idx,
               "<title>三生三世・緣定今生｜Jack ＆ Lily 婚禮邀請</title>",
               "<title>" + TITLE + "</title>", "title")

idx = sub_once(idx,
               '<meta name="description" content="Jack ＆ Lily 的婚禮邀請。'
               '三生三世，緣定今生 — 我們騎著各自的馬，走進同一段旅程。'
               '誠摯邀請你，走進我們的故事。">',
               '<meta name="description" content="' + DESC + '">', "description")

idx = sub_once(idx,
               '<meta property="og:title" content="三生三世・緣定今生｜Jack ＆ Lily">',
               '<meta property="og:title" content="' + TITLE + '">', "og:title")

idx = sub_once(idx,
               '<meta property="og:description" content="我們騎著各自的馬，走進同一段旅程。'
               '從相遇，到相知；從相愛，到相守。這一世，我們決定不再錯過。">',
               '<meta property="og:description" content="' + DESC + '">', "og:description")
# NOTE: the live text reads 「這一世」 (U+4E16) — verified byte-for-byte against v110.

idx = sub_once(idx,
               '<meta name="twitter:title" content="三生三世・緣定今生｜Jack ＆ Lily">',
               '<meta name="twitter:title" content="' + TITLE + '">', "twitter:title")

idx = sub_once(idx,
               '<meta name="twitter:description" content="我們騎著各自的馬，走進同一段旅程。'
               '誠摯邀請你，走進我們的故事。">',
               '<meta name="twitter:description" content="' + DESC + '">', "twitter:description")

write("index.html", idx)

# ── js/app.js ─────────────────────────────────────────────────────────────────
app = read("js/app.js")

app = sub_once(
    app,
    'document.title=val("SITE_TITLE")+"｜"+groom+" ＆ "+bride+" 婚禮邀請"',
    'document.title=groom+" & "+bride+" | 婚禮邀請暨報名"',
    "app.js document.title")

write("js/app.js", app)

print("v111 patch applied OK")
