#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v102 polish: version marker + drop the CSS filter on the trailer video.

Small, self-verifying, and needs no video download — see
.github/workflows/v102-polish.yml. Every edit asserts its match count so a
drifted file fails loudly instead of being silently half-patched.
"""

import io
import re
import sys

FAILED = []

VERSION_OLD = '<meta name="site-version" content="v99">'
VERSION_NEW = '<meta name="site-version" content="v102">'

# An inline override at the end of <head>, so it wins over the minified
# styles.css without re-uploading that whole 80 KB file.
OVERRIDE = (
    "<style>/* v102 - \u5f71\u7247\u64ad\u653e\u6548\u80fd\u5fae\u8abf\uff1a\u79fb\u9664\u5f71\u7247\u4e0a\u7684 CSS filter\u3002\n"
    "   \u539f\u672c\u7684 saturate(1.04) contrast(1.02) hue-rotate(-2deg) \u6703\u8b93\u700f\u89bd\u5668\u5c0d\u6bcf\u4e00\u683c\u756b\u9762\u591a\u505a\u4e00\u6b21\u6ffe\u93e1\u5408\u6210\uff0c\n"
    "   \u5728\u4f4e\u968e\u624b\u6a5f\u4e0a\u662f\u7d14\u7cb9\u7684\u984d\u5916\u8ca0\u64d4\u3002\u5be6\u6e2c\u5f71\u7247\u672c\u8eab\u5df2\u504f\u6696\u300122s \u62dc\u5802\u6bb5\u8207\u7ad9\u4e0a\u9152\u7d05\u5e7e\u4e4e\u540c\u8272\u7cfb\uff0c\n"
    "   \u8272\u8abf\u672c\u8eaa\u5c31\u5354\u8abf\uff0c\u4e0d\u9700\u8981\u9019\u5c64\u4fee\u98fe\u3002\u5167\u5074\u6697\u89d2 (`.trailer__frame:after`) \u4fdd\u7559\u3002 */\n"
    ".trailer__video{filter:none}\n"
    "</style>\n"
)


def main():
    path = "index.html"
    with io.open(path, encoding="utf-8") as fh:
        s = fh.read()

    # 1) version marker
    n = s.count(VERSION_OLD)
    if n != 1:
        FAILED.append("site-version: expected 1 occurrence of %r, found %d" % (VERSION_OLD, n))
    else:
        s = s.replace(VERSION_OLD, VERSION_NEW)
        print("OK   site-version -> v102")

    # 2) inline override just before </head>
    if ".trailer__video{filter:none}" in s:
        print("SKIP override already present")
    else:
        n = s.count("</head>")
        if n != 1:
            FAILED.append("</head>: expected 1 occurrence, found %d" % n)
        else:
            s = s.replace("</head>", OVERRIDE + "</head>")
            print("OK   trailer filter override injected")

    if FAILED:
        sys.stderr.write("\n".join("FAIL " + m for m in FAILED) + "\n")
        return 1

    with io.open(path, "w", encoding="utf-8") as fh:
        fh.write(s)

    # verify
    with io.open(path, encoding="utf-8") as fh:
        v = fh.read()
    for needle, want in (
        ('content="v102"', 1),
        (".trailer__video{filter:none}", 1),
        ("trailer__tag", 0),
        ("trailer__count", 0),
        (" muted ", 0),
    ):
        got = v.count(needle)
        if got != want:
            FAILED.append("%r count %d != %d" % (needle, got, want))
    if FAILED:
        sys.stderr.write("\n".join("FAIL " + m for m in FAILED) + "\n")
        return 1
    print("ALL POLISH CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
