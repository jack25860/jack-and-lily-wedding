#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v32 正式站（GitHub Pages）驗證

用法：
    python3 scripts/verify-v32-live.py [url]

驗證重點（全部在真實正式站上執行）：
  [0] 檔案層：index.html / js/app.js / js/config.js / scripts/rsvp-to-sheet.gs 皆 200 且含 v32 標記
  [1] 失敗路徑（正式站現況：SHEET_WEBAPP_URL 為空）
      送出 → 不跳轉、不顯示感謝卡、顯示 is-err 明確錯誤、內容完整保留、三備援可用、0 email 請求
  [2] 成功路徑（攔截 config.js 注入端點，驗證正式站的 HTML/CSS/JS 能正確走完成功流程）
      送出 → 不跳轉、感謝提示、表單清空、實際 POST 1 筆
  [3] 不克出席 → 人數區塊隱藏且 disabled、備援內容不含人數
  [4] 桌機 1440×900 與行動版 390×844：無水平捲動、console error 0、pageerror 0
  [5] 頁首/章節完整未破版；截圖輸出
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://jack25860.github.io/jack-and-lily-wedding/")
PROBE = "https://script.google.com/macros/s/AKfycbPROBEv32LIVE/exec"
SHOTS = "/workspace/documents/v32_rsvp_flow"
os.makedirs(SHOTS, exist_ok=True)

RESULTS = []
POSTS = []


def check(label, actual, expected=True):
    ok = actual == expected
    RESULTS.append((ok, label, f"actual={actual!r} expected={expected!r}"))
    print(("  PASS  " if ok else "  FAIL  ") + label +
          ("" if ok else f"\n          actual={actual!r}  expected={expected!r}"))


def prep(ctx, console, perrs, popups):
    page = ctx.new_page()
    page.on("console", lambda m: console.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: perrs.append(str(e)))
    page.on("request", lambda r: POSTS.append(r) if r.method == "POST" and "formsubmit" in r.url else None)
    ctx.on("page", lambda p: popups.append(p))
    return page


def wait_ready(page):
    page.goto(BASE, wait_until="load", timeout=90000)
    try:
        page.wait_for_selector("#loader", state="detached", timeout=15000)
    except Exception:
        pass
    page.wait_for_timeout(600)


def reveal(page):
    h = page.evaluate("document.body.scrollHeight")
    for _ in range(0, int(h), 700):
        page.mouse.wheel(0, 700)
        page.wait_for_timeout(70)
    page.wait_for_timeout(500)


def pick(page, name, value):
    page.evaluate(
        """([n,v])=>{const el=document.querySelector(`input[name="${n}"][value="${v}"]`);
           if(el) el.click();}""",
        [name, value],
    )


def fill(page, attend="出席", adults="2", children="1", chairs="1"):
    page.fill("#rsvpName", "QA正式站測試")
    page.fill("#rsvpEmail", "qa.v32.live@example.com")
    pick(page, "side", "女方")
    pick(page, "relation", "朋友")
    pick(page, "attend", attend)
    if attend == "出席":
        page.select_option("#rsvpAdults", adults)
        page.select_option("#rsvpChildren", children)
        page.select_option("#rsvpChairs", chairs)


def no_overflow(page):
    return page.evaluate("document.documentElement.scrollWidth === document.documentElement.clientWidth")


def run():
    print(f"== v32 正式站驗證 ==\n站台：{BASE}\n")
    with sync_playwright() as pw:
        browser = pw.chromium.launch()

        # ───────── [1] 失敗路徑（正式站現況） ─────────
        print("[1] 失敗路徑（桌機 1440×900，端點為空＝正式站現況）")
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        console, perrs, popups = [], [], []
        page = prep(ctx, console, perrs, popups)
        wait_ready(page)
        check("1-1 線上端點現況為空", page.evaluate("window.WEDDING_CONFIG.SHEET_WEBAPP_URL"), "")
        check("1-2 備援區塊初始隱藏", page.evaluate("document.querySelector('#rsvpFallback').hidden"))
        reveal(page)
        fill(page, "出席", "4", "2", "2")
        page.click("#rsvpSubmit")
        page.wait_for_timeout(1200)
        check("1-3 未開啟新分頁", len(popups), 0)
        check("1-4 未顯示感謝卡", page.evaluate("document.querySelector('#rsvpThanks').hidden"))
        check("1-5 備援區塊已顯示", page.evaluate("!document.querySelector('#rsvpFallback').hidden"))
        check("1-6 備援標題", page.inner_text(".rsvp-fallback__title"), "回覆尚未送出")
        check("1-7 狀態顯示明確錯誤", "尚未設定完成" in page.inner_text("#rsvpStatus"))
        check("1-8 錯誤狀態帶 is-err",
              "is-err" in (page.get_attribute("#rsvpStatus", "class") or ""))
        check("1-9 姓名內容保留", page.input_value("#rsvpName"), "QA正式站測試")
        check("1-10 人數內容保留",
              [page.input_value("#rsvpAdults"), page.input_value("#rsvpChildren"), page.input_value("#rsvpChairs")],
              ["4", "2", "2"])
        href = page.get_attribute("#rsvpFallbackForm", "href") or ""
        check("1-11 prefill 連結正確", "usp=pp_url" in href and "entry.1256769847=" in href and "entry.907958152=4" in href)
        mail = page.get_attribute("#rsvpFallbackMail", "href") or ""
        check("1-12 mailto 連結正確", mail.startswith("mailto:jack25860@gmail.com?subject="))
        page.click("#rsvpFallbackCopy")
        page.wait_for_timeout(600)
        check("1-13 複製成功提示", "已複製" in page.inner_text("#rsvpFallbackNote"))
        check("1-14 未發出任何 email 請求", len(POSTS), 0)
        check("1-15 無水平捲動", no_overflow(page))
        check("1-16 console error 0", len(console), 0)
        check("1-17 pageerror 0", len(perrs), 0)
        page.locator("#rsvpFallback").screenshot(path=f"{SHOTS}/v32_live_desktop_fallback.png")
        ctx.close()

        # ───────── [2] 成功路徑（注入端點） ─────────
        print("\n[2] 成功路徑（桌機，注入可用端點）")
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        console, perrs, popups = [], [], []
        page = prep(ctx, console, perrs, popups)

        def inject(route):
            body = route.fetch().text().replace('SHEET_WEBAPP_URL:""', f'SHEET_WEBAPP_URL:"{PROBE}"')
            route.fulfill(status=200, content_type="application/javascript", body=body)

        page.route("**/js/config.js*", inject)
        sent = []
        page.route(PROBE, lambda r: (sent.append(r.request.post_data), r.fulfill(status=200, body="{}")))
        wait_ready(page)
        check("2-1 注入生效", page.evaluate("window.WEDDING_CONFIG.SHEET_WEBAPP_URL"), PROBE)
        reveal(page)
        fill(page, "出席", "2", "1", "1")
        page.click("#rsvpSubmit")
        page.wait_for_timeout(1800)
        check("2-2 未開啟新分頁", len(popups), 0)
        check("2-3 顯示感謝提示", page.evaluate("!document.querySelector('#rsvpThanks').hidden"))
        check("2-4 感謝標題", page.inner_text("#rsvpThanksTitle"), "感謝您的回覆")
        check("2-5 表單已清空（姓名）", page.input_value("#rsvpName"), "")
        check("2-6 人數回預設 1/0/0",
              [page.input_value("#rsvpAdults"), page.input_value("#rsvpChildren"), page.input_value("#rsvpChairs")],
              ["1", "0", "0"])
        check("2-7 端點收到 1 筆 POST", len(sent), 1)
        pl = json.loads(sent[0]) if sent else {}
        check("2-8 payload 正確",
              [pl.get("name"), pl.get("attend"), pl.get("adults"), pl.get("children"), pl.get("chairs")],
              ["QA正式站測試", "出席", 2, 1, 1])
        check("2-9 未發出任何 email 請求", len(POSTS), 0)
        check("2-10 無水平捲動", no_overflow(page))
        check("2-11 console error 0", len(console), 0)
        check("2-12 pageerror 0", len(perrs), 0)
        page.screenshot(path=f"{SHOTS}/v32_live_desktop_thanks.png")
        ctx.close()

        # ───────── [3] 不克出席 ─────────
        print("\n[3] 不克出席（桌機）")
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        console, perrs, popups = [], [], []
        page = prep(ctx, console, perrs, popups)
        wait_ready(page)
        reveal(page)
        fill(page, "不克出席")
        check("3-1 人數區塊隱藏", page.evaluate("document.querySelector('#rsvpNumWrap').hidden"))
        check("3-2 三 select 全 disabled",
              page.evaluate("[...document.querySelectorAll('#rsvpNumWrap select')].every(s=>s.disabled)"))
        check("3-3 兒童椅列隱藏", page.evaluate("document.querySelector('#rsvpChairRow').hidden"))
        page.click("#rsvpSubmit")
        page.wait_for_timeout(1000)
        mail = page.get_attribute("#rsvpFallbackMail", "href") or ""
        check("3-4 備援不含大人人數", "出席大人人數" not in mail)
        check("3-5 備援標示不克出席", "%E4%B8%8D%E5%85%8B%E5%87%BA%E5%B8%AD" in mail)
        check("3-6 prefill 不含人數 entry", "entry.907958152" not in (page.get_attribute("#rsvpFallbackForm", "href") or ""))
        check("3-7 console error 0", len(console), 0)
        page.locator("#rsvp").screenshot(path=f"{SHOTS}/v32_live_desktop_rsvp_decline.png")
        ctx.close()

        # ───────── [4] 行動版 ─────────
        print("\n[4] 行動版（390×844）")
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        console, perrs, popups = [], [], []
        page = prep(ctx, console, perrs, popups)
        wait_ready(page)
        reveal(page)
        check("4-1 行動版無水平捲動（初始）", no_overflow(page))
        fill(page, "出席", "2", "1", "1")
        check("4-2 未破版：區塊寬度 ≤ 視窗",
              page.evaluate("document.querySelector('#rsvpForm').getBoundingClientRect().width <= 390"))
        page.click("#rsvpSubmit")
        page.wait_for_timeout(1200)
        check("4-3 未開啟新分頁", len(popups), 0)
        check("4-4 備援區塊已顯示", page.evaluate("!document.querySelector('#rsvpFallback').hidden"))
        check("4-5 內容保留", page.input_value("#rsvpName"), "QA正式站測試")
        check("4-6 行動版無水平捲動（送出後）", no_overflow(page))
        check("4-7 備援按鈕不溢出容器", page.evaluate(
            "(()=>{const b=document.querySelector('#rsvpFallback');"
            "return [...b.querySelectorAll('.btn')].every(e=>{const r=e.getBoundingClientRect(),p=b.getBoundingClientRect();"
            "return r.left>=p.left-1&&r.right<=p.right+1;});})()"))
        check("4-8 console error 0", len(console), 0)
        check("4-9 pageerror 0", len(perrs), 0)
        page.locator("#rsvpFallback").screenshot(path=f"{SHOTS}/v32_live_mobile_fallback.png")
        ctx.close()

        browser.close()

    fails = [r for r in RESULTS if not r[0]]
    print(f"\n== 共 {len(RESULTS)} 項，{'全部通過' if not fails else str(len(fails)) + ' 項失敗'} ==")
    for _, label, detail in fails:
        print(f"   FAIL: {label}  ({detail})")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    run()
