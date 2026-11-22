#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply the v102 trailer changes to the checked-out site files.

Runs on the GitHub Actions runner (see .github/workflows/publish-trailer.yml),
because the sandbox that authored this cannot encode video and its uploaded files
are behind private links the runner cannot fetch. Every edit asserts its match
count, so a drifted file fails loudly instead of being silently half-patched.
"""

import io
import re
import sys

FAILED = []


def replace_once(path, old, new):
    with io.open(path, encoding="utf-8") as fh:
        s = fh.read()
    n = s.count(old)
    if n != 1:
        FAILED.append("%s: expected 1 occurrence, found %d of %r" % (path, n, old[:70]))
        return
    with io.open(path, "w", encoding="utf-8") as fh:
        fh.write(s.replace(old, new))
    print("OK   %s" % path)


def sub_n(path, pattern, repl, expect):
    with io.open(path, encoding="utf-8") as fh:
        s = fh.read()
    s2, n = re.subn(pattern, repl, s)
    if n != expect:
        FAILED.append("%s: expected %d regex matches, found %d for %r" % (path, expect, n, pattern[:70]))
        return
    with io.open(path, "w", encoding="utf-8") as fh:
        fh.write(s2)
    print("OK   %s (%s)" % (path, pattern[:40]))


# ---------------------------------------------------------------- index.html
# No `muted` attribute: the user must get sound after clicking play.
replace_once(
    "index.html",
    '<video id="trailerVideo" class="trailer__video" playsinline muted preload="none" poster="images/trailer-poster-1920.jpg"></video>',
    '<video id="trailerVideo" class="trailer__video" playsinline webkit-playsinline preload="none" poster="images/trailer-poster-1920.jpg"></video>',
)

# Remove the "即將上映" chip and the countdown line (and the dead nodes they leave).
sub_n("index.html", r'[ \t]*<p class="trailer__tag" id="trailerTag">.*?</p>\s*\n', "", 1)
sub_n("index.html", r'[ \t]*<p class="trailer__count" id="trailerCount" hidden></p>\s*\n', "", 1)

# ------------------------------------------------------------------ config.js
# Same-origin, web-optimised files produced by the transcode job.
sub_n(
    "js/config.js",
    r'TRAILER_VIDEO_URL:"[^"]*",TRAILER_VIDEO_URL_MOBILE:"[^"]*",',
    'TRAILER_VIDEO_URL:"videos/trailer-1080p.mp4",TRAILER_VIDEO_URL_MOBILE:"videos/trailer-720p.mp4",',
    1,
)
# Drop the release-date config that fed the removed chip/countdown.
sub_n(
    "js/config.js",
    r'TRAILER_RELEASE_DATE:"[^"]*",TRAILER_RELEASE_LABEL:"[^"]*",TRAILER_RELEASED_LABEL:"[^"]*",TRAILER_COUNT_EN:"[^"]*",TRAILER_COUNT_UNIT:"[^"]*",',
    "",
    1,
)

# --------------------------------------------------------------------- app.js
# Play WITH sound. Only fall back to muted if the browser genuinely refuses the
# un-muted play() call (autoplay policy) — never leave the trailer silent.
replace_once(
    "js/app.js",
    'var p=null;try{v.muted=false;p=v.play()}catch(e){}if(p&&p.catch)p.catch(function(){if(v.error)return;try{v.muted=true;var q=v.play();q&&q.catch&&q.catch(function(){if(!v.error)v.setAttribute("controls","")})}catch(e){}});',
    'try{v.muted=false;v.defaultMuted=false;v.removeAttribute("muted");v.volume=1}catch(e){}var p=null;try{p=v.play()}catch(e){}if(p&&p.catch)p.catch(function(){if(v.error)return;try{v.muted=false;var q=v.play();q&&q.catch&&q.catch(function(){if(v.error)return;try{v.muted=true;var r=v.play();r&&r.catch&&r.catch(function(){})}catch(e){}})}catch(e){}});',
)

# Remove the release/countdown routine entirely (single line) + its boot calls.
with io.open("js/app.js", encoding="utf-8") as fh:
    s = fh.read()
i = s.find("function initTrailerRelease(")
if i < 0:
    FAILED.append("js/app.js: initTrailerRelease not found")
else:
    j = s.find("\n", i)
    s = s[:i] + s[j + 1:]
    s = s.replace("initTrailerRelease(),", "")
    with io.open("js/app.js", "w", encoding="utf-8") as fh:
        fh.write(s)
    print("OK   js/app.js (release routine + boot calls removed)")

# ----------------------------------------------------------------- styles.css
# Drop the now-unused chip/countdown rules so no dead selectors remain.
sub_n(
    "css/styles.css",
    r'\.trailer__tag\{[^}]*\}\.trailer__count\{[^}]*\}',
    "",
    1,
)

# ------------------------------------------------------------------- checks
for path, needle, want in (
    ("index.html", "trailer__tag", 0),
    ("index.html", "trailerTag", 0),
    ("index.html", " muted ", 0),
    ("js/config.js", "TRAILER_RELEASE", 0),
    ("js/config.js", "videos/trailer-1080p.mp4", 1),
    ("js/config.js", "videos/trailer-720p.mp4", 1),
    ("js/app.js", "initTrailerRelease", 0),
    ("js/app.js", 'v.removeAttribute("muted")', 1),
    ("css/styles.css", "trailer__tag", 0),
    ("css/styles.css", "trailer__count", 0),
):
    with io.open(path, encoding="utf-8") as fh:
        got = fh.read().count(needle)
    if got != want:
        FAILED.append("%s: %r count %d != %d" % (path, needle, got, want))

if FAILED:
    sys.stderr.write("\n".join("FAIL " + m for m in FAILED) + "\n")
    sys.exit(1)
print("ALL PATCH CHECKS PASSED")
