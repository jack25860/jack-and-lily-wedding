#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v105 patch — two changes requested by the user:

1. Replace the trailer heading "結婚預告片" with a more literary line, and
   update every place that string appears (visible heading, aria-label,
   HTML comment, config value).

2. iOS Safari in-page playback + volume hardening. The v104 code already
   removed `muted` and set volume=1 on click, but it did so *after* the
   `play()` call in one path and never re-asserted the volume once the
   element actually started. On iOS the element can be re-muted by the
   system when a play() promise is rejected, and `volume` is read-only on
   iOS (setting it is a no-op, not an error). This patch:
     - unmutes BEFORE play() so the user gesture carries the audio intent
     - re-asserts muted=false / volume=1 on `playing` and on `volumechange`
     - keeps `playsinline` + `webkit-playsinline` (already present)
     - never falls back to a muted autoplay: if play() is rejected we show
       the native controls instead of silently muting the film

Run from the repository root.
"""

import io
import sys

NEW_TITLE = "三生一諾 · 預告"

failures = []


def read(path):
    with io.open(path, encoding="utf-8") as fh:
        return fh.read()


def write(path, text):
    with io.open(path, "w", encoding="utf-8") as fh:
        fh.write(text)


def sub_once(path, old, new, label):
    text = read(path)
    if old not in text:
        failures.append("%s: anchor not found in %s" % (label, path))
        return
    if text.count(old) != 1:
        failures.append("%s: anchor appears %d times in %s" % (label, text.count(old), path))
        return
    write(path, text.replace(old, new, 1))
    print("  ok  %s" % label)


# ── 1. index.html ────────────────────────────────────────────────────────────
print("index.html")

sub_once(
    "index.html",
    '<h3 class="trailer__title" data-cfg="TRAILER_TITLE">結婚預告片</h3>',
    '<h3 class="trailer__title" data-cfg="TRAILER_TITLE">%s</h3>' % NEW_TITLE,
    "trailer heading",
)

sub_once(
    "index.html",
    'aria-label="播放結婚預告片"',
    'aria-label="播放%s"' % NEW_TITLE,
    "play button aria-label",
)

sub_once(
    "index.html",
    "<!-- 影片素材：結婚預告片",
    "<!-- 影片素材：%s" % NEW_TITLE,
    "html comment",
)

sub_once(
    "index.html",
    '<meta name="site-version" content="v104">',
    '<meta name="site-version" content="v105">',
    "site-version meta",
)

# ── 2. js/config.js ──────────────────────────────────────────────────────────
print("js/config.js")

sub_once(
    "js/config.js",
    'TRAILER_TITLE:"結婚預告片"',
    'TRAILER_TITLE:"%s"' % NEW_TITLE,
    "TRAILER_TITLE",
)

# ── 3. js/app.js — iOS audio hardening ───────────────────────────────────────
print("js/app.js")

OLD_START = (
    'function start(){\n'
    'if(loaded)return;loaded=true;\n'
    'if(!prefetched){v.setAttribute("preload","auto");v.setAttribute("src",src);try{v.load()}catch(e){}}\n'
    'try{v.muted=false;v.defaultMuted=false;v.removeAttribute("muted");v.volume=1}catch(e){}\n'
)

NEW_START = (
    '/*v105:ios-audio-hardening*/\n'
    'function unmute(){try{v.muted=false;v.defaultMuted=false;v.removeAttribute("muted");'
    'if(v.volume!==1)v.volume=1}catch(e){}}\n'
    'v.addEventListener("playing",unmute);\n'
    'v.addEventListener("volumechange",function(){if(!v.muted&&v.volume===0)unmute()});\n'
    'function start(){\n'
    'if(loaded)return;loaded=true;\n'
    'if(!prefetched){v.setAttribute("preload","auto");v.setAttribute("src",src);try{v.load()}catch(e){}}\n'
    'unmute();\n'
)

sub_once("js/app.js", OLD_START, NEW_START, "unmute before play()")

# The v104 fallback muted the film when play() was rejected. On iOS that is
# exactly how a film ends up silent, so show the native controls instead.
OLD_FALLBACK = (
    'function playNow(){var p=null;try{p=v.play()}catch(e){}'
    'if(p&&p.catch)p.catch(function(){if(v.error)return;'
    'try{v.muted=true;var q=v.play();q&&q.catch&&q.catch(function(){})}catch(e){}})}'
)

NEW_FALLBACK = (
    'function playNow(){var p=null;try{p=v.play()}catch(e){}'
    'if(p&&p.catch)p.catch(function(){if(v.error)return;'
    '/*v105: never fall back to a muted film - surface the native controls instead */'
    'try{v.setAttribute("controls","")}catch(e){}})}'
)

sub_once("js/app.js", OLD_FALLBACK, NEW_FALLBACK, "no muted fallback")

# ── report ───────────────────────────────────────────────────────────────────
if failures:
    print("\nFAILED:")
    for f in failures:
        print("  - %s" % f)
    sys.exit(1)

print("\nv105 patch applied cleanly")
