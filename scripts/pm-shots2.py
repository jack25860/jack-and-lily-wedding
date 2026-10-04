#!/usr/bin/env python3
"""PM 最終驗證：精準截圖（喜帖狀態訊息 + 相簿三主題格狀）。"""
import time, os
from playwright.sync_api import sync_playwright

SITE = "https://jack25860.github.io/jack-and-lily-wedding/"
OUT = "/workspace/documents/v40_ecard"
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for label, vp, mob in [("desktop", {"width": 1440, "height": 900}, False),
                           ("mobile", {"width": 390, "height": 844}, True)]:
        ctx = b.new_context(viewport=vp, is_mobile=mob, has_touch=mob)
        p = ctx.new_page()
        p.goto(SITE, wait_until="networkidle", timeout=90000)
        time.sleep(1.5)

        # 喜帖：送出後截取狀態訊息
        p.click("#ecardMailBtn")
        time.sleep(0.8)
        p.fill("#ecardTo", "jack25860@gmail.com")
        p.click("#ecardSendBtn")
        for _ in range(60):
            time.sleep(0.5)
            s = p.eval_on_selector("#ecardStatus", "el => el.textContent.trim()")
            if s and "傳送中" not in s:
                break
        print(f"[{label}] ecard status: {s!r}")
        p.eval_on_selector("#ecardPanel", "el => el.scrollIntoView({block:'center'})")
        time.sleep(0.6)
        p.screenshot(path=f"{OUT}/ecard_status_{label}.png", full_page=False)

        # 相簿：捲到第一個主題並截圖
        p.evaluate("document.querySelector('#galleryThemes')?.scrollIntoView({block:'start'})")
        time.sleep(1.5)
        p.screenshot(path=f"{OUT}/gallery_themes_{label}.png", full_page=False)
        # 展開明朝（第三主題）確認
        p.evaluate("""() => {
            const btns = document.querySelectorAll('.gtheme__toggle');
            if (btns[2]) btns[2].click();
        }""")
        time.sleep(1.2)
        p.evaluate("document.querySelectorAll('.gtheme')[2]?.scrollIntoView({block:'start'})")
        time.sleep(1.0)
        p.screenshot(path=f"{OUT}/gallery_ming_{label}.png", full_page=False)
        ctx.close()
    b.close()
print("done")
