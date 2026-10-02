#!/usr/bin/env python3
"""v34 LIVE verification against GitHub Pages: gallery, RSVP timing, ecard, decline, mobile."""
import json
import os
import sys
from playwright.sync_api import sync_playwright

BASE = "https://jack25860.github.io/jack-and-lily-wedding/"
OUT = "/workspace/documents/v34_rsvp_flow"
os.makedirs(OUT, exist_ok=True)

results = []


def chk(tag, name, cond, extra=None):
    results.append((tag, name, bool(cond), extra))
    print(("PASS " if cond else "FAIL ") + f"[{tag}] {name}" + (f"  {extra}" if extra and not cond else ""))


with sync_playwright() as p:
    browser = p.chromium.launch()

    # ============ DESKTOP ============
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE, wait_until="load")
    page.wait_for_timeout(3500)

    themes = page.evaluate("() => [...document.querySelectorAll('.gtheme__name')].map(e=>e.textContent.trim())")
    chk("gallery", "線上主題 = 明朝 + 今生", themes == ["明朝", "今生"], themes)
    chk("gallery", "線上無 戰國/唐代", not any(t in ("戰國", "唐代") for t in themes), themes)

    feat = page.evaluate("() => [...document.querySelectorAll('.gtheme')].map(t=>t.querySelectorAll('.gtheme__grid:not(.gtheme__more) .g-item').length)")
    chk("gallery", "預覽 4-6 張", all(4 <= n <= 6 for n in feat), feat)
    chk("gallery", "其餘展開前隱藏", page.evaluate("() => [...document.querySelectorAll('.gtheme__more')].every(m=>m.hidden)"))
    total = page.evaluate("() => document.querySelectorAll('.g-item').length")
    chk("gallery", "總張數 130", total == 130, total)
    prev = page.evaluate("() => [...document.querySelectorAll('.gtheme__grid:not(.gtheme__more) .g-item img')].map(i=>i.getAttribute('src'))")
    chk("gallery", "預覽含兩人合照", any(any(k in s for k in ("n03", "n09", "n27", "n45", "n50", "n70")) for s in prev), prev)

    # images actually load
    broken = page.evaluate("""() => [...document.querySelectorAll('.g-item img')].filter(i=>i.complete && i.naturalWidth===0).map(i=>i.getAttribute('src'))""")
    chk("gallery", "無破圖", len(broken) == 0, broken[:5])

    ov = page.evaluate("() => ({s:document.documentElement.scrollWidth, c:document.documentElement.clientWidth})")
    chk("gallery", "桌機無水平捲動", ov["s"] <= ov["c"] + 1, ov)

    # ---- RSVP timing (live, real endpoint) ----
    page.evaluate("() => document.querySelector('#rsvpForm').scrollIntoView()")
    page.wait_for_timeout(400)
    page.fill("#rsvpName", "QA自動測試-請忽略")
    page.fill("#rsvpEmail", "qa.v34.live@example.com")
    page.check('input[name="attend"][value="出席"]')
    page.wait_for_timeout(250)
    page.select_option("#rsvpAdults", "2")
    page.select_option("#rsvpChildren", "1")
    page.select_option("#rsvpChairs", "1")

    email_reqs = []
    page.on("request", lambda r: email_reqs.append(r.url) if ("formsubmit.co" in r.url or r.url.startswith("mailto:")) else None)

    page.click("#rsvpSubmit")
    page.wait_for_timeout(150)
    immediate = page.evaluate("() => document.querySelector('#rsvpStatus').textContent.trim()")
    chk("rsvp", "送出後立即顯示提示", immediate != "", repr(immediate))
    chk("rsvp", "立即提示為『傳送中…』", "傳送中" in immediate, repr(immediate))

    page.wait_for_timeout(4000)
    chk("rsvp", "顯示『感謝您的回覆』", page.evaluate("() => !document.querySelector('#rsvpThanks').hidden"))
    ttitle = page.evaluate("() => document.querySelector('#rsvpThanks .rsvp-thanks__title').textContent.trim()")
    chk("rsvp", "提示文字正確", "感謝您的回覆" in ttitle, ttitle)
    cleared = page.evaluate("""() => ({name:document.querySelector('#rsvpName').value, email:document.querySelector('#rsvpEmail').value,
        adults:document.querySelector('#rsvpAdults').value, children:document.querySelector('#rsvpChildren').value, chairs:document.querySelector('#rsvpChairs').value})""")
    chk("rsvp", "表單清空回預設", cleared["name"] == "" and cleared["email"] == "" and cleared["adults"] == "1" and cleared["children"] == "0" and cleared["chairs"] == "0", cleared)
    chk("rsvp", "未發出任何 email 請求", len(email_reqs) == 0, email_reqs)
    chk("rsvp", "未開新分頁", len(ctx.pages) == 1, len(ctx.pages))
    page.screenshot(path=f"{OUT}/v34_live_desktop_thanks.png")

    # ---- decline ----
    page.click("#rsvpThanksClose")
    page.wait_for_timeout(400)
    page.check('input[name="attend"][value="不克出席"]')
    page.wait_for_timeout(400)
    chk("decline", "人數區塊隱藏", page.evaluate("() => document.querySelector('#rsvpNumWrap').hidden || getComputedStyle(document.querySelector('#rsvpNumWrap')).display==='none'"))
    chk("decline", "人數欄位停用", page.evaluate("() => ['rsvpAdults','rsvpChildren','rsvpChairs'].every(id=>document.getElementById(id).disabled)"))
    page.screenshot(path=f"{OUT}/v34_live_desktop_decline.png")

    # ---- ecard ----
    if not page.evaluate("() => document.querySelector('#rsvpThanks').hidden"):
        page.click("#rsvpThanksClose")
    page.wait_for_timeout(300)
    page.evaluate("() => document.querySelector('#ecardShow').scrollIntoView()")
    page.wait_for_timeout(400)
    i0 = page.evaluate("() => [...document.querySelectorAll('.ecard-dot')].findIndex(d=>d.classList.contains('is-on'))")
    page.wait_for_timeout(6500)
    i1 = page.evaluate("() => [...document.querySelectorAll('.ecard-dot')].findIndex(d=>d.classList.contains('is-on'))")
    chk("ecard", "喜帖輪播自動前進", i1 != i0, (i0, i1))
    page.click("#ecardMailBtn")
    page.wait_for_timeout(500)
    chk("ecard", "面板展開", page.evaluate("() => !document.querySelector('#ecardPanel').hidden"))
    page.fill("#ecardTo", "not-an-email")
    page.click("#ecardSendBtn")
    page.wait_for_timeout(400)
    chk("ecard", "無效信箱顯示錯誤", "有效" in page.evaluate("() => document.querySelector('#ecardStatus').textContent"))
    page.screenshot(path=f"{OUT}/v34_live_desktop_ecard.png")

    chk("desktop", "無 pageerror", len(errors) == 0, errors)
    ctx.close()

    # ============ MOBILE ============
    ctx2 = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pg = ctx2.new_page()
    merr = []
    pg.on("pageerror", lambda e: merr.append(str(e)))
    pg.goto(BASE, wait_until="load")
    pg.wait_for_timeout(3500)

    mov = pg.evaluate("() => ({s:document.documentElement.scrollWidth, c:document.documentElement.clientWidth})")
    chk("mobile", "無水平捲動", mov["s"] <= mov["c"] + 1, mov)
    mfeat = pg.evaluate("() => [...document.querySelectorAll('.gtheme')].map(t=>t.querySelectorAll('.gtheme__grid:not(.gtheme__more) .g-item').length)")
    chk("mobile", "預覽 4-6 張", all(4 <= n <= 6 for n in mfeat), mfeat)
    mbroken = pg.evaluate("""() => [...document.querySelectorAll('.g-item img')].filter(i=>i.complete && i.naturalWidth===0).length""")
    chk("mobile", "無破圖", mbroken == 0, mbroken)

    pg.evaluate("() => document.querySelector('#rsvpForm').scrollIntoView()")
    pg.wait_for_timeout(400)
    pg.fill("#rsvpName", "QA自動測試-手機")
    pg.fill("#rsvpEmail", "qa.v34.live.mobile@example.com")
    pg.check('input[name="attend"][value="出席"]')
    pg.wait_for_timeout(250)
    pg.select_option("#rsvpAdults", "3")
    pg.select_option("#rsvpChildren", "2")
    pg.select_option("#rsvpChairs", "2")
    pg.click("#rsvpSubmit")
    pg.wait_for_timeout(150)
    mim = pg.evaluate("() => document.querySelector('#rsvpStatus').textContent.trim()")
    chk("mobile", "立即顯示傳送中", "傳送中" in mim, repr(mim))
    pg.wait_for_timeout(4000)
    chk("mobile", "顯示感謝提示", pg.evaluate("() => !document.querySelector('#rsvpThanks').hidden"))
    pg.screenshot(path=f"{OUT}/v34_live_mobile_thanks.png")
    mov2 = pg.evaluate("() => ({s:document.documentElement.scrollWidth, c:document.documentElement.clientWidth})")
    chk("mobile", "提示顯示時無水平捲動", mov2["s"] <= mov2["c"] + 1, mov2)
    chk("mobile", "無 pageerror", len(merr) == 0, merr)
    ctx2.close()
    browser.close()

passed = sum(1 for r in results if r[2])
print(f"\n==== {passed}/{len(results)} PASSED ====")
for tag, name, ok, extra in results:
    if not ok:
        print(f"  FAIL [{tag}] {name} :: {extra}")
with open(f"{OUT}/v34_live_results.json", "w") as f:
    json.dump([{"tag": t, "name": n, "pass": o, "extra": str(e)} for t, n, o, e in results], f, ensure_ascii=False, indent=2)
sys.exit(0 if passed == len(results) else 1)
