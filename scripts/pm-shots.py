#!/usr/bin/env python3
"""PM 最終驗證：截圖（電子喜帖面板 + 相簿）供視覺檢查。"""
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
        # 電子喜帖面板 + 送出（顯示授權提示）
        p.click("#ecardMailBtn")
        time.sleep(0.8)
        p.fill("#ecardTo", "jack25860@gmail.com")
        p.click("#ecardSendBtn")
        for _ in range(60):
            time.sleep(0.5)
            s = p.eval_on_selector("#ecardStatus", "el => el.textContent.trim()")
            if s and "傳送中" not in s:
                break
        p.screenshot(path=f"{OUT}/ecard_{label}.png", full_page=False)
        # 相簿
        p.evaluate("document.querySelector('#gallery')?.scrollIntoView()")
        time.sleep(1.2)
        p.screenshot(path=f"{OUT}/gallery_{label}.png", full_page=False)
        ctx.close()
    b.close()
print("screenshots done")
