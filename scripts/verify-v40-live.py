#!/usr/bin/env python3
"""
v37 正式站實測（真實 Chromium / Playwright）

驗證：
  A. 電子喜帖寄送流程（真實點擊送出）
     - 送出後確實 POST 到 /exec（type=ecard）
     - 前端可讀取 POST 回應（不再 no-cors 黑洞）
     - 依回應顯示正確訊息（未授權 → 明確授權提示；成功 → 已送出）
     - 送出期間按鈕 disabled、不跳轉新分頁
  B. RSVP 回歸（以 stub 攔截，不污染試算表）
     - 立即「傳送中…」→「感謝您的回覆」→ 表單清空 → 不跳轉 → 0 email 請求
     - 不克出席：人數欄位 disabled + 區塊隱藏
  C. 版面：桌機 1440x900 / 行動版 390x844 皆無水平捲動、無 console error
"""
import json, sys, time, os
from playwright.sync_api import sync_playwright

SITE = "https://jack25860.github.io/jack-and-lily-wedding/"
EXEC = "https://script.google.com/macros/s/AKfycbwMfQ2N-fNLdvUdsdiXT-1y5vMUWUyBhUMtMmR3cQjscGHA3WkKoabYCVvkazPdiMfW/exec"
OUT = "/workspace/documents/v40_ecard"

results = []
def chk(group, name, cond, actual=None):
    results.append((group, name, bool(cond), actual))
    print(("  ok   " if cond else "  FAIL ") + f"[{group}] {name}" + ("" if cond else f"  actual={actual!r}"))

def run(pw, label, viewport, mobile):
    print(f"\n===== {label} ({viewport['width']}x{viewport['height']}) =====")
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport=viewport, is_mobile=mobile, has_touch=mobile)
    page = ctx.new_page()

    console_errors, page_errors = [], []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: page_errors.append(str(e)))
    reqs = []
    page.on("request", lambda r: reqs.append({"url": r.url, "method": r.method}))

    page.goto(SITE, wait_until="networkidle", timeout=90000)
    time.sleep(1.5)

    # ---------- C. 版面 ----------
    sw, cw = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
    chk(label, "無水平捲動", sw <= cw + 1, (sw, cw))

    # ---------- A. 電子喜帖 ----------
    page.click("#ecardMailBtn")
    time.sleep(0.8)
    panel_visible = page.eval_on_selector("#ecardPanel", "el => !el.hidden")
    chk(label, "喜帖面板可開啟", panel_visible, panel_visible)

    page.fill("#ecardTo", "jack25860@gmail.com")
    reqs.clear()
    pages_before = len(ctx.pages)
    page.click("#ecardSendBtn")
    time.sleep(0.15)
    busy = page.eval_on_selector("#ecardSendBtn", "el => el.disabled || el.getAttribute('aria-busy')==='true'")
    chk(label, "送出後按鈕立即鎖定", busy is True, busy)

    status_txt = ""
    for _ in range(50):
        time.sleep(0.5)
        status_txt = page.eval_on_selector("#ecardStatus", "el => el.textContent.trim()")
        if status_txt and "傳送中" not in status_txt:
            break

    posts = [r for r in reqs if r["method"] == "POST" and "script.google.com" in r["url"]]
    chk(label, "確實 POST 到 /exec", len(posts) >= 1, len(posts))
    chk(label, "不跳轉新分頁", len(ctx.pages) == pages_before, (pages_before, len(ctx.pages)))
    chk(label, "顯示最終狀態文字", bool(status_txt) and "傳送中" not in status_txt, status_txt)
    print(f"     → 狀態文字：{status_txt!r}")

    # 前端是否真的讀到後端回應（不再 no-cors 黑洞）
    read_ok = page.evaluate("""async (u) => {
        try {
          const r = await fetch(u, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
            body: JSON.stringify({type:'ecard', to:'jack25860@gmail.com', subject:'probe'})});
          const t = await r.text();
          return {readable:true, status:r.status, body:t.slice(0,300)};
        } catch(e) { return {readable:false, err:String(e)}; }
    }""", EXEC)
    chk(label, "前端可讀取 POST 回應（非 no-cors 黑洞）", read_ok.get("readable") is True, read_ok)
    print(f"     → POST 回應：{json.dumps(read_ok, ensure_ascii=False)[:300]}")

    if read_ok.get("readable"):
        body = read_ok.get("body", "")
        if '"ok":false' in body and ("permission" in body or "scope" in body):
            chk(label, "未授權時顯示明確授權提示", "授權" in status_txt, status_txt)
        elif '"ok":true' in body:
            chk(label, "已授權時顯示已送出", "已送出" in status_txt, status_txt)

    page.screenshot(path=f"{OUT}/ecard_{label}.png", full_page=False)

    # ---------- B. RSVP 回歸（stub 攔截） ----------
    page2 = ctx.new_page()
    page2.route("**/script.google.com/**", lambda route: route.fulfill(
        status=200, content_type="application/json", body='{"ok":true,"seq":1}'))
    r2reqs = []
    page2.on("request", lambda r: r2reqs.append({"url": r.url, "method": r.method}))
    page2.goto(SITE, wait_until="networkidle", timeout=90000)
    time.sleep(1.0)

    page2.fill("#rsvpName", "QA v37")
    page2.fill("#rsvpEmail", "qa.v37@example.com")
    page2.check('input[name="attend"][value="出席"]')
    time.sleep(0.4)

    r2reqs.clear()
    pages_before2 = len(ctx.pages)
    # 以 MutationObserver 記錄送出鈕是否曾進入 disabled/aria-busy（避免同步 API 的時序誤判）
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
    busy2 = page2.evaluate("window.__busySeen === true")
    chk(label, "RSVP 送出後立即鎖定", busy2 is True, busy2)

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
    nm = page2.eval_on_selector("#rsvpName", "el => el.value")
    chk(label, "RSVP 表單已清空", nm == "", nm)

    # 不克出席
    page2.evaluate("document.querySelector('#rsvpThanksClose')?.click()")
    time.sleep(0.4)
    page2.check('input[name="attend"][value="不克出席"]')
    time.sleep(0.6)
    hidden = page2.eval_on_selector("#rsvpNumWrap", "el => el.hidden || getComputedStyle(el).display==='none'")
    chk(label, "不克出席：人數區塊隱藏", hidden is True, hidden)
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
print(f"\n== v40 live result: {passed} passed, {failed} failed ==")
with open(f"{OUT}/live_results.json", "w") as f:
    json.dump({"passed": passed, "failed": failed,
               "results": [{"group": g, "name": n, "ok": o, "actual": str(a)} for g, n, o, a in results]},
              f, ensure_ascii=False, indent=2)
sys.exit(1 if failed else 0)
