#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v33 LIVE end-to-end verification against the real GitHub Pages site.

Proves, in a real Chromium:
  * submit -> NO new tab, no navigation, "感謝您的回覆" thanks card shown
  * form cleared back to defaults
  * the RSVP payload is actually POSTed to the Apps Script /exec endpoint
  * ZERO email requests (no formsubmit.co, no mailto) on the RSVP path
  * decline -> guests block hidden + all three selects disabled, not submitted
  * ecard (電子喜帖) still present and its slider still auto-advances
  * desktop + mobile: no horizontal overflow, touch targets >= 44px
"""
import json
import os
import re
import sys
from playwright.sync_api import sync_playwright

SITE = "https://jack25860.github.io/jack-and-lily-wedding/"
OUT = "/workspace/documents/v33_rsvp_live"
os.makedirs(OUT, exist_ok=True)

R = []


def chk(group, name, cond, detail=""):
    R.append({"group": group, "name": name, "ok": bool(cond), "detail": str(detail)[:400]})


def step_scroll(page, steps=16, px=650, wait=110):
    """Incrementally scroll so IntersectionObserver reveals fire."""
    for _ in range(steps):
        page.mouse.wheel(0, px)
        page.wait_for_timeout(wait)


def run_case(pw, tag, viewport, is_mobile, p, shot_prefix):
    browser = pw.chromium.launch(args=["--no-sandbox"])
    ctx = browser.new_context(
        viewport=viewport,
        is_mobile=is_mobile,
        has_touch=is_mobile,
        locale="zh-TW",
    )
    page = ctx.new_page()
    reqs, new_pages, page_errs, console_errs = [], [], [], []
    page.on("request", lambda r: reqs.append(r.url))
    page.on("pageerror", lambda e: page_errs.append(str(e)))
    page.on(
        "console",
        lambda m: console_errs.append(m.text) if m.type == "error" else None,
    )
    ctx.on("page", lambda pg: new_pages.append(pg.url))

    page.goto(SITE, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(2500)
    scroll_through_to_form(page)

    # ---------- fill the form ----------
    page.fill("#rsvpName", p["name"])
    page.fill("#rsvpEmail", p["email"])
    page.check('input[name="side"][value="%s"]' % p["side"])
    page.check('input[name="relation"][value="%s"]' % p["relation"])
    page.check('input[name="attend"][value="%s"]' % p["attend"])

    if p["attend"] == "出席":
        page.select_option("#rsvpAdults", p["adults"])
        page.select_option("#rsvpChildren", p["children"])
        page.select_option("#rsvpChairs", p["chairs"])

    page.wait_for_timeout(400)

    if shot_prefix:
        page.locator("#rsvpForm").screenshot(path=os.path.join(OUT, shot_prefix + "_form.png"))

    # ---- decline: verify the guests block BEFORE submitting ----
    if p["attend"] == "不克出席":
        pre = page.evaluate(
            """() => {
              var w=document.querySelector('#rsvpNumWrap');
              var sels=['#rsvpAdults','#rsvpChildren','#rsvpChairs'].map(function(s){
                 var e=document.querySelector(s);return {id:s,disabled:e.disabled};});
              var chairRow=document.querySelector('#rsvpChairRow');
              return {wrapHidden:w.hidden,wrapDisplay:getComputedStyle(w).display,sels:sels,chairHidden:chairRow.hidden};
            }"""
        )
        chk(tag, "不克出席：人數區塊隱藏", pre["wrapHidden"] is True and pre["wrapDisplay"] == "none",
            "%s/%s" % (pre["wrapHidden"], pre["wrapDisplay"]))
        chk(tag, "不克出席：三個人數欄位全部 disabled",
            all(s["disabled"] for s in pre["sels"]), pre["sels"])
        chk(tag, "不克出席：兒童椅整列隱藏", pre["chairHidden"] is True, pre["chairHidden"])
        if shot_prefix:
            page.locator("#rsvpForm").screenshot(path=os.path.join(OUT, shot_prefix + "_decline_form.png"))

    n_reqs_before = len(reqs)
    url_before = page.url

    # ---------- submit ----------
    page.click("#rsvpSubmit")
    page.wait_for_timeout(5000)

    after = reqs[n_reqs_before:]
    email_hits = [u for u in after if ("formsubmit" in u.lower() or u.startswith("mailto:") or "mailto" in u.lower())]
    sheet_hits = [u for u in after if "script.google.com" in u or "script.googleusercontent.com" in u]

    chk(tag, "不跳轉新分頁 (no new tab)", len(new_pages) == 0, new_pages)
    chk(tag, "不導頁 (URL unchanged)", page.url == url_before, "%s -> %s" % (url_before, page.url))
    chk(tag, "送出後不發出任何 email 請求", len(email_hits) == 0, email_hits)

    thanks_visible = page.evaluate(
        "() => { var b=document.querySelector('#rsvpThanks'); return !!b && b.hidden===false; }"
    )
    thanks_text = page.evaluate(
        "() => { var t=document.querySelector('#rsvpThanksTitle')||document.querySelector('#rsvpThanks'); "
        "return t?t.textContent.replace(/\\s+/g,' ').trim().slice(0,60):''; }"
    )

    if p["attend"] == "出席":
        chk(tag, "顯示「感謝您的回覆」", thanks_visible, thanks_text)
        chk(tag, "提示文字正確", "感謝您的回覆" in thanks_text, thanks_text)
        chk(tag, "送出時確實 POST 到試算表端點", len(sheet_hits) >= 1, sheet_hits)

        state = page.evaluate(
            """() => {
              var f=document.querySelector('#rsvpForm');
              var g=n=>{var e=f.querySelector('[name="'+n+'"]');return e?e.value:null};
              var r=n=>{var e=f.querySelector('input[name="'+n+'"]:checked');return e?e.value:null};
              return {name:g('name'),email:g('email'),side:r('side'),relation:r('relation'),
                      attend:r('attend'),adults:g('adults'),children:g('children'),chairs:g('chairs'),
                      numWrapHidden:document.querySelector('#rsvpNumWrap').hidden};
            }"""
        )
        chk(tag, "表單清空：姓名", state["name"] == "", state["name"])
        chk(tag, "表單清空：信箱", state["email"] == "", state["email"])
        chk(tag, "回預設：出席", state["attend"] == "出席", state["attend"])
        chk(tag, "回預設：關係=家人", state["relation"] == "家人", state["relation"])
        chk(tag, "回預設：大人=1", state["adults"] == "1", state["adults"])
        chk(tag, "回預設：兒童=0", state["children"] == "0", state["children"])
        chk(tag, "回預設：兒童椅=0", state["chairs"] == "0", state["chairs"])
        chk(tag, "人數區塊仍顯示（出席）", state["numWrapHidden"] is False, state["numWrapHidden"])
        chk(tag, "未顯示錯誤狀態", page.evaluate(
            "() => {var s=document.querySelector('#rsvpStatus');return !!s && !s.classList.contains('is-err');}"
        ))
        chk(tag, "未顯示備援卡（成功路徑）", page.evaluate(
            "() => {var b=document.querySelector('#rsvpFallback');return !!b && b.hidden===true;}"
        ))
        if shot_prefix:
            page.screenshot(path=os.path.join(OUT, shot_prefix + "_thanks.png"))
    else:
        # decline path — the row IS written, with adults/children/chairs left blank by the Apps Script
        chk(tag, "不克出席：顯示「感謝您的回覆」", thanks_visible, thanks_text)
        chk(tag, "不克出席：送出時 POST 到試算表端點", len(sheet_hits) >= 1, sheet_hits[:2])
        chk(tag, "不克出席：未顯示備援卡（成功路徑）", page.evaluate(
            "() => {var b=document.querySelector('#rsvpFallback');return !!b && b.hidden===true;}"
        ))
        if shot_prefix:
            page.screenshot(path=os.path.join(OUT, shot_prefix + "_decline.png"))

    # ---------- layout / regression ----------
    metrics = page.evaluate(
        """() => ({scrollW: document.documentElement.scrollWidth,
                   clientW: document.documentElement.clientWidth,
                   ecardSlides: document.querySelectorAll('.ecard-show__slide').length,
                   ecardDots: document.querySelectorAll('.ecard-dot').length})"""
    )
    chk(tag, "無水平捲動", metrics["scrollW"] == metrics["clientW"],
        "%s vs %s" % (metrics["scrollW"], metrics["clientW"]))
    chk(tag, "電子喜帖輪播元素仍在", metrics["ecardSlides"] == 3 and metrics["ecardDots"] == 3, metrics)
    chk(tag, "無 pageerror", len(page_errs) == 0, page_errs)

    # ecard slider advances?
    idx0 = page.evaluate("() => {var d=[].findIndex.call(document.querySelectorAll('.ecard-dot'),function(x){return x.classList.contains('is-on')});return d;}")
    page.wait_for_timeout(6500)
    idx1 = page.evaluate("() => {var d=[].findIndex.call(document.querySelectorAll('.ecard-dot'),function(x){return x.classList.contains('is-on')});return d;}")
    chk(tag, "電子喜帖自動輪播前進", idx0 != idx1, "%s -> %s" % (idx0, idx1))

    # touch target height for the RSVP submit button
    bh = page.evaluate(
        "() => {var b=document.querySelector('#rsvpSubmit');return b?Math.round(b.getBoundingClientRect().height):0;}"
    )
    chk(tag, "送出按鈕高度 >= 44px", bh >= 44, bh)

    ctx.close()
    browser.close()
    return {"console": console_errs, "pageerrors": page_errs}


def scroll_through_to_form(page):
    """Scroll until the RSVP form is in view and reveals have fired."""
    for _ in range(24):
        r = page.evaluate(
            "() => {var f=document.querySelector('#rsvpForm');if(!f)return null;"
            "var b=f.getBoundingClientRect();return {top:b.top,h:b.height};}"
        )
        if r and r["top"] < 300 and r["top"] > -50:
            break
        page.mouse.wheel(0, 600)
        page.wait_for_timeout(90)
    page.evaluate("() => {var f=document.querySelector('#rsvpForm');if(f)f.scrollIntoView({block:'center'});}")
    page.wait_for_timeout(500)


def main():
    cases = [
        dict(
            tag="[桌機 1440] 出席",
            viewport={"width": 1440, "height": 900},
            is_mobile=False,
            p=dict(
                name="QA自動測試-請忽略A", email="qa.v33.attend@example.com",
                side="女方", relation="朋友", attend="出席",
                adults="2", children="1", chairs="1",
            ),
            shot_prefix="v33_live_desktop",
        ),
        dict(
            tag="[行動版 390] 出席",
            viewport={"width": 390, "height": 844},
            is_mobile=True,
            p=dict(
                name="QA自動測試-請忽略B", email="qa.v33.mobile@example.com",
                side="男方", relation="同事", attend="出席",
                adults="3", children="2", chairs="2",
            ),
            shot_prefix="v33_live_mobile",
        ),
        dict(
            tag="[桌機 1440] 不克出席",
            viewport={"width": 1440, "height": 900},
            is_mobile=False,
            p=dict(
                name="QA自動測試-請忽略C", email="qa.v33.decline@example.com",
                side="男方", relation="親戚", attend="不克出席",
                adults=None, children=None, chairs=None,
            ),
            shot_prefix="v33_live_decline",
        ),
    ]

    extra = {}
    with sync_playwright() as pw:
        for c in cases:
            try:
                extra[c["tag"]] = run_case(pw, c["tag"], c["viewport"], c["is_mobile"], c["p"], c["shot_prefix"])
            except Exception as e:  # noqa: BLE001
                chk(c["tag"], "CASE EXECUTION", False, "exception: %r" % (e,))

    ok = sum(1 for x in R if x["ok"])
    total = len(R)
    print("\n" + "=" * 78)
    for x in R:
        print("%s  %-46s %s %s" % ("PASS" if x["ok"] else "FAIL", x["name"], "" if x["ok"] else "->", x["detail"]))
    print("=" * 78)
    print("LIVE RESULT: %d/%d passed" % (ok, total))
    for k, v in extra.items():
        if v["console"] or v["pageerrors"]:
            print("  console(%s): %s" % (k, v["console"][:4]))
            print("  pageerror(%s): %s" % (k, v["pageerrors"][:4]))
    with open("/workspace/documents/v33_rsvp_live/live_results.json", "w") as f:
        json.dump({"results": R, "ok": ok, "total": total}, f, ensure_ascii=False, indent=2)
    return 0 if ok == total else 1


if __name__ == "__main__":
    sys.exit(main())
