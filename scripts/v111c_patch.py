#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v111c: fix a pre-existing wrong character in the bride's static fallback.

index.html line ~881 holds a no-JS fallback for the e-card names:

    <span data-cfg="BRIDE_NAME">杜伊甯</span>

「甯」 is U+752F. The name the client specified is 「杜伊穠」 — U+7A60.
js/config.js (BRIDE_NAME) and every other place on the site already use
U+7A60, and js/app.js overwrites this span on load, so the typo only shows
for a split second / when JavaScript does not run. It is still a wrong
character in the bride's name, so it is corrected here.

This is the ONLY change: one character, one file. No layout, no styles,
no other copy, no script logic.
"""
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

WRONG = 'BRIDE_NAME">\u675c\u4f0a\u752f<'   # 杜伊甯  (U+752F)
RIGHT = 'BRIDE_NAME">\u675c\u4f0a\u7a60<'   # 杜伊穠  (U+7A60)


def main():
    path = os.path.join(ROOT, "index.html")
    with io.open(path, encoding="utf-8") as f:
        s = f.read()

    n = s.count(WRONG)
    if n != 1:
        sys.exit("FAIL: expected 1 occurrence of the wrong fallback, found %d" % n)

    s = s.replace(WRONG, RIGHT)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(s)

    # no U+752F may remain anywhere in the page
    if "\u752f" in s:
        sys.exit("FAIL: U+752F still present")

    print("v111c applied OK: 杜伊甯(U+752F) -> 杜伊穠(U+7A60)")


if __name__ == "__main__":
    main()
