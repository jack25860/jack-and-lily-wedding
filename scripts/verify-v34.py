#!/usr/bin/env python3
"""v34 local end-to-end verification: gallery, RSVP timing, ecard, decline path."""
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8123/index.html"
OUT = "/workspace/documents/v34_rsvp_flow"
import os
os.makedirs(OUT, exist_ok=True)

results = []


def chk(tag, name, cond, extra=None):
    results.append((tag, name, bool(cond), extra))
    print(("PASS " if cond else "FAIL ") + f"[{tag}] {name}" + (f"  {extra}" if extra and not cond else ""))


with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---------------- DESKTOP ----------------
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE, wait_until="load")
    page.wait_for_timeout(2500)

    # --- gallery ---
    themes = page.evaluate("() => [...document.querySelectorAll('.gtheme__name')].map(e=>e.textContent.trim())")
    chk("gallery", "只有 明朝 + 今生 兩個主題", themes == ["明朝", "今生"], themes)
    chk("gallery", "無 戰國/唐代 主題", not any(t in ("戰國", "唐代") for t in themes), themes)

    feat = page.evaluate("() => [...document.querySelectorAll('.gtheme')].map(t=>t.querySelectorAll('.gtheme__grid:not(.gtheme__more) .g-item').length)")
    chk("gallery", "每個主題預覽 4-6 張", all(4 <= n <= 6 for n in feat), feat)

    more_hidden = page.evaluate("() => [...document.querySelectorAll('.gtheme__more')].every(m=>m.hidden)")
    chk("gallery", "其餘照片展開前隱藏", more_hidden)

    total = page.evaluate("() => document.querySelectorAll('.g-item').length")
    chk("gallery", "相簿總張數 = 130", total == 130, total)

    # couple photo in preview: n03/n09/n27/n45/n50/n70
    preview_srcs = page.evaluate("() => [...document.querySelectorAll('.gtheme__grid:not(.gtheme__more) .g-item img')].map(i=>i.getAttribute('src'))")
    couple = [s for s in preview_srcs if any(k in s for k in ("n03", "n09", "n27", "n45", "n50", "n70"))]
    chk("gallery", "預覽含兩人合照", len(couple) >= 1, preview_srcs)

    # expand works
    page.click(".gtheme__toggle")
    page.wait_for_timeout(400)
    expanded = page.evaluate("() => !document.querySelector('.gtheme__more').hidden")
    chk("gallery", "點擊可展開其餘照片", expanded)

    # no horizontal scroll
    ov = page.evaluate("() => ({s:document.documentElement.scrollWidth, c:document.documentElement.clientWidth})")
    chk("gallery", "桌機無水平捲動", ov["s"] <= ov["c"] + 1, ov)

    # --- RSVP timing ---
    page.evaluate("() => document.querySelector('#rsvpForm').scrollIntoView()")
    page.wait_for_timeout(300)
    page.fill("#rsvpName", "QA自動測試-請忽略")
    page.fill("#rsvpEmail", "qa.v34@example.com")
    page.check('input[name="attend"][value="出席"]')
    page.wait_for_timeout(200)
    page.select_option("#rsvpAdults", "2")
    page.select_option("#rsvpChildren", "1")
    page.select_option("#rsvpChairs", "1")

    # intercept the sheet POST
    posts = []
    def slow_sheet(route):
        posts.append(route.request.post_data)
        page.wait_for_timeout(700)
        route.fulfill(status=200, body="{}")
    page.route("**/script.google.com/**", slow_sheet)
    page.route("**/formsubmit.co/**", lambda route: (posts.append("EMAIL:" + str(route.request.url)), route.fulfill(status=200, body="ok")))

    page.click("#rsvpSubmit")
    page.wait_for_timeout(120)
    immediate = page.evaluate("() => document.querySelector('#rsvpStatus').textContent.trim()")
    chk("rsvp", "送出後立即顯示提示（非空白）", immediate != "", repr(immediate))
    chk("rsvp", "立即提示為『傳送中…』", "傳送中" in immediate, repr(immediate))

    page.wait_for_timeout(1200)
    thanks = page.evaluate("() => !document.querySelector('#rsvpThanks').hidden")
    chk("rsvp", "寫入完成後顯示『感謝您的回覆』", thanks)
    ttitle = page.evaluate("() => document.querySelector('#rsvpThanks .rsvp-thanks__title').textContent.trim()")
    chk("rsvp", "提示文字正確", "感謝您的回覆" in ttitle, ttitle)

    cleared = page.evaluate("""() => ({
        name: document.querySelector('#rsvpName').value,
        email: document.querySelector('#rsvpEmail').value,
        adults: document.querySelector('#rsvpAdults').value,
        children: document.querySelector('#rsvpChildren').value,
        chairs: document.querySelector('#rsvpChairs').value,
        attend: (document.querySelector('input[name=attend]:checked')||{}).value
    })""")
    chk("rsvp", "表單清空回預設", cleared["name"] == "" and cleared["email"] == "" and cleared["adults"] == "1" and cleared["children"] == "0" and cleared["chairs"] == "0", cleared)

    email_posts = [x for x in posts if isinstance(x, str) and x.startswith("EMAIL:")]
    sheet_posts = [x for x in posts if not (isinstance(x, str) and x.startswith("EMAIL:"))]
    chk("rsvp", "未發出任何 email 請求", len(email_posts) == 0, email_posts)
    chk("rsvp", "有寫入試算表請求", len(sheet_posts) == 1, len(sheet_posts))
    if sheet_posts:
        try:
            pl = json.loads(sheet_posts[0])
            chk("rsvp", "payload 欄位正確", pl.get("name") == "QA自動測試-請忽略" and pl.get("adults") == 2 and pl.get("children") == 1 and pl.get("chairs") == 1, pl)
        except Exception as e:
            chk("rsvp", "payload 可解析", False, str(e))

    page.screenshot(path=f"{OUT}/v34_local_desktop_thanks.png")

    # --- decline path ---
    page.click("#rsvpThanksClose")
    page.wait_for_timeout(300)
    page.check('input[name="attend"][value="不克出席"]')
    page.wait_for_timeout(300)
    hidden = page.evaluate("() => document.querySelector('#rsvpNumWrap').hidden || getComputedStyle(document.querySelector('#rsvpNumWrap')).display==='none'")
    chk("decline", "人數區塊隱藏", hidden)
    dis = page.evaluate("() => ['rsvpAdults','rsvpChildren','rsvpChairs'].every(id=>document.getElementById(id).disabled)")
    chk("decline", "人數欄位停用", dis)

    posts.clear()
    page.fill("#rsvpName", "QA自動測試-不克")
    page.fill("#rsvpEmail", "qa.v34.decline@example.com")
    page.click("#rsvpSubmit")
    page.wait_for_timeout(1200)
    if sheet_posts:
        try:
            pl = json.loads(posts[0])
            chk("decline", "不克出席不列入人數", pl.get("adults") == 0 and pl.get("children") == 0 and pl.get("chairs") == 0 and pl.get("attend") == "不克出席", pl)
        except Exception as e:
            chk("decline", "payload 可解析", False, str(e))
    chk("decline", "不克出席仍顯示感謝", page.evaluate("() => !document.querySelector('#rsvpThanks').hidden"))

    # --- ecard ---
    page.click("#rsvpThanksClose")
    page.wait_for_timeout(300)
    page.evaluate("() => document.querySelector('#ecardShow').scrollIntoView()")
    page.wait_for_timeout(300)
    idx0 = page.evaluate("() => [...document.querySelectorAll('.ecard-dot')].findIndex(d=>d.classList.contains('is-on'))")
    page.wait_for_timeout(6000)
    idx1 = page.evaluate("() => [...document.querySelectorAll('.ecard-dot')].findIndex(d=>d.classList.contains('is-on'))")
    chk("ecard", "喜帖輪播自動前進", idx1 != idx0, (idx0, idx1))

    page.click("#ecardMailBtn")
    page.wait_for_timeout(400)
    chk("ecard", "面板展開", page.evaluate("() => !document.querySelector('#ecardPanel').hidden"))
    page.fill("#ecardTo", "not-an-email")
    page.click("#ecardSendBtn")
    page.wait_for_timeout(300)
    err = page.evaluate("() => document.querySelector('#ecardStatus').textContent")
    chk("ecard", "無效信箱顯示錯誤", "有效" in err, err)

    posts.clear()
    page.fill("#ecardTo", "guest@example.com")
    page.click("#ecardSendBtn")
    page.wait_for_timeout(1200)
    ok = page.evaluate("() => document.querySelector('#ecardStatus').textContent")
    chk("ecard", "有效信箱送出成功", "已送出" in ok, ok)
    ecard_posts = [x for x in posts if not (isinstance(x, str) and x.startswith("EMAIL:"))]
    chk("ecard", "喜帖走 Apps Script（非 FormSubmit）", len(ecard_posts) == 1, len(ecard_posts))
    if ecard_posts:
        try:
            pl = json.loads(ecard_posts[0])
            chk("ecard", "喜帖 payload type=ecard", pl.get("type") == "ecard", pl.get("type"))
            chk("ecard", "喜帖含隨機婚紗照", bool(pl.get("photo")) and "album/" in pl.get("photo", ""), pl.get("photo"))
            chk("ecard", "喜帖含影片欄位", "videoUrl" in pl and "videoPoster" in pl, list(pl.keys()))
            chk("ecard", "喜帖含邀請文字", "誠摯地邀請您參加本次婚禮" in (pl.get("inviteText") or ""), pl.get("inviteText"))
        except Exception as e:
            chk("ecard", "喜帖 payload 可解析", False, str(e))

    chk("desktop", "無 pageerror", len(errors) == 0, errors)
    ctx.close()

    # ---------------- MOBILE ----------------
    ctx2 = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pg = ctx2.new_page()
    merr = []
    pg.on("pageerror", lambda e: merr.append(str(e)))
    pg.goto(BASE, wait_until="load")
    pg.wait_for_timeout(2500)

    mov = pg.evaluate("() => ({s:document.documentElement.scrollWidth, c:document.documentElement.clientWidth})")
    chk("mobile", "無水平捲動", mov["s"] <= mov["c"] + 1, mov)
    mfeat = pg.evaluate("() => [...document.querySelectorAll('.gtheme')].map(t=>t.querySelectorAll('.gtheme__grid:not(.gtheme__more) .g-item').length)")
    chk("mobile", "預覽 4-6 張", all(4 <= n <= 6 for n in mfeat), mfeat)

    pg.evaluate("() => document.querySelector('#rsvpForm').scrollIntoView()")
    pg.wait_for_timeout(300)
    pg.fill("#rsvpName", "QA自動測試-手機")
    pg.fill("#rsvpEmail", "qa.v34.mobile@example.com")
    pg.check('input[name="attend"][value="出席"]')
    pg.wait_for_timeout(200)
    pg.select_option("#rsvpAdults", "3")
    pg.select_option("#rsvpChildren", "2")
    pg.select_option("#rsvpChairs", "2")
    mposts = []
    def slow_sheet_m(route):
        mposts.append(route.request.post_data)
        pg.wait_for_timeout(700)
        route.fulfill(status=200, body="{}")
    pg.route("**/script.google.com/**", slow_sheet_m)
    pg.click("#rsvpSubmit")
    pg.wait_for_timeout(120)
    mim = pg.evaluate("() => document.querySelector('#rsvpStatus').textContent.trim()")
    chk("mobile", "立即顯示傳送中", "傳送中" in mim, repr(mim))
    pg.wait_for_timeout(1200)
    chk("mobile", "顯示感謝提示", pg.evaluate("() => !document.querySelector('#rsvpThanks').hidden"))
    pg.screenshot(path=f"{OUT}/v34_local_mobile_thanks.png")
    mov2 = pg.evaluate("() => ({s:document.documentElement.scrollWidth, c:document.documentElement.clientWidth})")
    chk("mobile", "提示顯示時仍無水平捲動", mov2["s"] <= mov2["c"] + 1, mov2)
    chk("mobile", "無 pageerror", len(merr) == 0, merr)
    ctx2.close()
    browser.close()

passed = sum(1 for r in results if r[2])
print(f"\n==== {passed}/{len(results)} PASSED ====")
for tag, name, ok, extra in results:
    if not ok:
        print(f"  FAIL [{tag}] {name} :: {extra}")
sys.exit(0 if passed == len(results) else 1)
