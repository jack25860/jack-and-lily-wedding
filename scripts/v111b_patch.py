#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v111b refinement: put a line break between the two description sentences.

The reference screenshot shows the preview description as three lines:

    三生三世・緣定今生
    我們騎著各自的馬，走進同一段旅程。
    誠摯邀請您見證我們的重要時刻，歡迎填寫出席報名，與我們共享幸福喜悅。

v111 joined sentence 2 and 3 into one run of text, so the break was left to
the renderer. This adds an explicit &#10; so the preview always shows the
same three lines as the reference.

Only the three description meta tags change. site-version stays v111.
"""
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

OLD = ("三生三世・緣定今生&#10;"
       "我們騎著各自的馬，走進同一段旅程。"
       "誠摯邀請您見證我們的重要時刻，歡迎填寫出席報名，與我們共享幸福喜悅。")

NEW = ("三生三世・緣定今生&#10;"
       "我們騎著各自的馬，走進同一段旅程。&#10;"
       "誠摯邀請您見證我們的重要時刻，歡迎填寫出席報名，與我們共享幸福喜悅。")


def main():
    path = os.path.join(ROOT, "index.html")
    with io.open(path, encoding="utf-8") as f:
        s = f.read()

    n = s.count(OLD)
    if n != 3:
        sys.exit("FAIL: expected 3 description tags, found %d" % n)

    s = s.replace(OLD, NEW)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(s)

    print("v111b refinement applied OK (3 description tags)")


if __name__ == "__main__":
    main()
