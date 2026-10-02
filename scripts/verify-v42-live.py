#!/usr/bin/env python3
"""
v42 正式站實測（真實 Chromium / Playwright）

驗證：
  A. 電子喜帖寄送成功後「清空輸入框」
     - 成功（stub 回 ok:true）→ #ecardTo 清空、焦點回到輸入框、狀態顯示「已送出」
     - 失敗（stub 回 ok:false mail_scope_missing）→ #ecardTo 保留原值、顯示授權提示
     - 去重（stub 回 ok:true deduped:true）→ 視為已寄出而清空、顯示「剛剛已寄出」
  B. 大人出席人數上限 = 10（桌機＋行動版）
  C. 版面：桌機 1440x900 / 行動版 390x844 皆無水平捲動、無 console error
  D. RSVP 回歸（stub 攔截，不污染試算表）
"""
import json, sys, time, os
from playwright.sync_api import sync_playwright

SITE = "https://jack25860.github.io/jack-and-lily-wedding/"
OUT = "/workspace/documents/v42_ecard"

results = []
def chk(group, name, cond, actual=None):
    results.append((group, name, bool(cond), actual))
    print(("  ok   " if cond else "  FAIL ") + f"[{group}] {name}" + ("" if cond else f"  actual={actual!r}"))

def stub_ok(route):
    route.fulfill(status=200, content_type="application/json", body='{"ok":true,"inline":2}')

def stub_fail(route):
    route.fulfill(status=200, content_type="application/json",
                  body='{"ok":false,"error":"mail_scope_missing","detail":"no permission"}')

def stub_dedup(route):
    route.fulfill(status=200, content_type="application/json", body='{"ok":true,"deduped":true,"inline":2}')

def run(pw, label, viewport, mobile):
    print(f"\n===== {label} ({viewport['width']}x{viewport['height']}) =====")
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport=viewport, is_mobile=mobile, has_touch=mobile)
    page = ctx.new_page()
    console_errors, page_errors = [], []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: page_errors.append(str(e)))

    page.goto(SITE, wait_until="networkidle", timeout=90000)
    time.sleep(1.5)

    # ---------- C. 版面 ----------
    sw, cw = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
    chk(label, "無水平捲動", sw <= cw + 1, (sw, cw))

    # ---------- B. 大人人數上限 10 ----------
    opts = page.eval_on_selector_all("#rsvpAdults option", "els => els.map(e => e.value)")
    chk(label, "大人出席人數選項 1..10", opts == [str(i) for i in range(1, 11)], opts)
    chk(label, "大人出席人數上限為 10", opts and opts[-1] == "10", opts[-1] if opts else None)
    child_opts = page.eval_on_selector_all("#rsvpChildren option", "els => els.map(e => e.value)")
    chk(label, "小孩人數維持 0..4", child_opts == [str(i) for i in range(0, 5)], child_opts)

    # ---------- A1. 成功 → 清空 ----------
    page.click("#ecardMailBtn")
    time.sleep(0.8)
    chk(label, "喜帖面板可開啟", page.eval_on_selector("#ecardPanel", "el => !el.hidden"))
    page.route("**/script.google.com/**", stub_ok)
    page.fill("#ecardTo", "guest1@example.com")
    page.click("#ecardSendBtn")
    txt = ""
    for _ in range(40):
        time.sleep(0.4)
        txt = page.eval_on_selector("#ecardStatus", "el => el.textContent.trim()")
        if txt and "傳送中" not in txt:
            break
    val = page.eval_on_selector("#ecardTo", "el => el.value")
    chk(label, "成功後清空收件人欄位", val == "", val)
    chk(label, "成功後顯示已送出", "已送出" in txt, txt)
    focused = page.evaluate("document.activeElement && document.activeElement.id")
    chk(label, "成功後焦點回到收件人欄位", focused == "ecardTo", focused)
    page.unroute("**/script.google.com/**")

    # ---------- A2. 失敗 → 不清空 ----------
    page.route("**/script.google.com/**", stub_fail)
    page.fill("#ecardTo", "guest2@example.com")
    page.click("#ecardSendBtn")
    txt2 = ""
    for _ in range(40):
        time.sleep(0.4)
        txt2 = page.eval_on_selector("#ecardStatus", "el => el.textContent.trim()")
        if txt2 and "傳送中" not in txt2:
            break
    val2 = page.eval_on_selector("#ecardTo", "el => el.value")
    chk(label, "失敗後保留收件人欄位", val2 == "guest2@example.com", val2)
    chk(label, "失敗後顯示授權提示", "授權" in txt2, txt2)
    page.unroute("**/script.google.com/**")

    # ---------- A3. 去重 → 視為已寄出而清空 ----------
    page.route("**/script.google.com/**", stub_dedup)
    page.fill("#ecardTo", "guest3@example.com")
    page.click("#ecardSendBtn")
    txt3 = ""
    for _ in range(40):
        time.sleep(0.4)
        txt3 = page.eval_on_selector("#ecardStatus", "el => el.textContent.trim()")
        if txt3 and "傳送中" not in txt3:
            break
    val3 = page.eval_on_selector("#ecardTo", "el => el.value")
    chk(label, "去重後清空收件人欄位", val3 == "", val3)
    chk(label, "去重後顯示剛剛已寄出", "剛剛已寄出" in txt3, txt3)
    chk(label, "去重提示為 8 秒窗期", "8 秒" in txt3, txt3)
    page.unroute("**/script.google.com/**")

    page.screenshot(path=f"{OUT}/ecard_{label}.png", full_page=False)

    # ---------- D. RSVP 回歸 ----------
    page2 = ctx.new_page()
    page2.route("**/script.google.com/**", lambda r: r.fulfill(
        status=200, content_type="application/json", body='{"ok":true,"seq":1}'))
    r2reqs = []
    page2.on("request", lambda r: r2reqs.append({"url": r.url, "method": r.method}))
    page2.goto(SITE, wait_until="networkidle", timeout=90000)
    time.sleep(1.0)
    page2.fill("#rsvpName", "QA v42")
    page2.fill("#rsvpEmail", "qa.v42@example.com")
    page2.check('input[name="attend"][value="出席"]')
    time.sleep(0.4)
    page2.select_option("#rsvpAdults", "10")
    r2reqs.clear()
    pages_before2 = len(ctx.pages)
    page2.evaluate("""() => {
        window.__busySeen = false;
        const btn = document.querySelector('#rsvpSubmit');
        if (!btn) return;
        const mark = () => { if (btn.disabled || btn.getAttribute('aria-busy')==='true') window.__busySeen = true; };
        new MutationObserver(mark).observe(btn, {attributes:true, attributeFilter:['disabled','aria-busy']});
        mark();
    }""")
    page2.click("#rsvpSubmit")
    time.sleep(0.2)
    chk(label, "RSVP 送出後立即鎖定", page2.evaluate("window.__busySeen === true"))
    thanks = False
    for _ in range(30):
        time.sleep(0.4)
        try:
            thanks = page2.eval_on_selector("#rsvpThanks", "el => !el.hidden")
        except Exception:
            thanks = False
        if thanks:
            break
    chk(label, "RSVP 顯示「感謝您的回覆」", thanks, thanks)
    chk(label, "RSVP 不跳轉新分頁", len(ctx.pages) == pages_before2, (pages_before2, len(ctx.pages)))
    emails = [r for r in r2reqs if "formsubmit" in r["url"] or "mailto" in r["url"]]
    chk(label, "RSVP 不寄送通知信（0 email 請求）", len(emails) == 0, len(emails))
    chk(label, "RSVP 表單已清空", page2.eval_on_selector("#rsvpName", "el => el.value") == "")
    page2.evaluate("document.querySelector('#rsvpThanksClose')?.click()")
    time.sleep(0.4)
    page2.check('input[name="attend"][value="不克出席"]')
    time.sleep(0.6)
    chk(label, "不克出席：人數區塊隱藏",
        page2.eval_on_selector("#rsvpNumWrap", "el => el.hidden || getComputedStyle(el).display==='none'"))
    dis = page2.evaluate("""() => {
        const ins = document.querySelectorAll('#rsvpNumWrap select, #rsvpChairRow select');
        return ins.length ? Array.from(ins).every(i => i.disabled) : null;
    }""")
    chk(label, "不克出席：人數欄位停用", dis is True, dis)
    page2.screenshot(path=f"{OUT}/rsvp_{label}.png", full_page=False)

    chk(label, "無 console error", len(console_errors) == 0, console_errors[:3])
    chk(label, "無 pageerror", len(page_errors) == 0, page_errors[:3])
    browser.close()

os.makedirs(OUT, exist_ok=True)
with sync_playwright() as pw:
    run(pw, "desktop", {"width": 1440, "height": 900}, False)
    run(pw, "mobile", {"width": 390, "height": 844}, True)

passed = sum(1 for r in results if r[2])
failed = len(results) - passed
print(f"\n== v42 live result: {passed} passed, {failed} failed ==")
with open(f"{OUT}/live_results.json", "w") as f:
    json.dump({"passed": passed, "failed": failed,
               "results": [{"group": g, "name": n, "ok": o, "actual": str(a)} for g, n, o, a in results]},
              f, ensure_ascii=False, indent=2)
sys.exit(1 if failed else 0)
