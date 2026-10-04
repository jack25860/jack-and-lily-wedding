#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v32 本機端到端驗證：RSVP 送出流程（成功路徑 / 失敗備援路徑）

用法：
    python3 scripts/verify-v32.py <站台根目錄> [port]
    # 站台根目錄需為「完整站台」（含 images/ audio/ 等二進位資產）

驗證重點：
  [成功路徑] 注入可用的 SHEET_WEBAPP_URL →
      不跳轉新分頁、顯示「感謝您的回覆」、表單清空回預設、
      實際 POST 一筆到端點、payload 欄位正確、無任何 email 請求
  [失敗路徑] SHEET_WEBAPP_URL 為空 →
      不跳轉、不顯示感謝卡、顯示明確錯誤、表單內容完整保留、
      備援三出口（Google 表單 prefill / 複製內容 / mailto）可用、無 email 請求
  [共通] 不克出席時人數欄位隱藏且 disabled；桌機＋行動版水平溢出 0；console/pageerror 0
"""
import functools
import http.server
import json
import os
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = sys.argv[1] if len(sys.argv) > 1 else "/workspace/_v32_test/site"
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8199
BASE = f"http://127.0.0.1:{PORT}/"
PROBE = "https://script.google.com/macros/s/AKfycbPROBEv32/exec"
OUT_DIR = os.path.dirname(os.path.abspath(__file__))
SHOTS = "/workspace/documents/v32_rsvp_flow"

RESULTS = []
POSTS = []


def check(label, actual, expected=True):
    ok = actual == expected
    RESULTS.append((ok, label, f"actual={actual!r} expected={expected!r}"))
    print(("  PASS  " if ok else "  FAIL  ") + label +
          ("" if ok else f"\n          actual={actual!r}  expected={expected!r}"))


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def prep_page(ctx, console, perrs, popups):
    page = ctx.new_page()
    page.on("console", lambda m: console.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: perrs.append(str(e)))
    page.on("request", lambda r: POSTS.append(r) if r.method == "POST" and "formsubmit" in r.url else None)
    ctx.on("page", lambda p: popups.append(p))
    return page


def wait_ready(page):
    page.goto(BASE, wait_until="load")
    try:
        page.wait_for_selector("#loader", state="detached", timeout=10000)
    except Exception:
        pass
    page.wait_for_timeout(400)


def reveal_scroll(page):
    """逐步捲動以觸發 IntersectionObserver 的 .reveal，再回到定位點。"""
    h = page.evaluate("document.body.scrollHeight")
    for y in range(0, int(h), 600):
        page.mouse.wheel(0, 600)
        page.wait_for_timeout(60)
    page.wait_for_timeout(400)


def pick(page, name, value):
    """點選視覺隱藏的 radio（真正的 click ⇒ 會觸發 change 事件）"""
    page.evaluate(
        """([n,v])=>{const el=document.querySelector(`input[name="${n}"][value="${v}"]`);
           if(el) el.click();}""",
        [name, value],
    )


def fill_form(page, attend="出席", adults="2", children="1", chairs="1"):
    page.fill("#rsvpName", "QA測試賓客")
    page.fill("#rsvpEmail", "qa.v32@example.com")
    pick(page, "side", "女方")
    pick(page, "relation", "朋友")
    pick(page, "attend", attend)
    if attend == "出席":
        page.select_option("#rsvpAdults", adults)
        page.select_option("#rsvpChildren", children)
        page.select_option("#rsvpChairs", chairs)


def overflow(page):
    return page.evaluate("document.documentElement.scrollWidth === document.documentElement.clientWidth")


# ═══════════════════════════════════════════════════════════════════
def run():
    os.makedirs(SHOTS, exist_ok=True)
    httpd = serve()
    print(f"== v32 RSVP 流程驗證 ==\n站台：{ROOT}\n服務：{BASE}\n")

    with sync_playwright() as pw:
        browser = pw.chromium.launch()

        # ─────────── A. 成功路徑（桌機） ───────────
        print("[A] 成功路徑（桌機 1440×900，注入可用端點）")
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        console, perrs, popups = [], [], []
        page = prep_page(ctx, console, perrs, popups)

        def inject(route):
            body = route.fetch().text().replace('SHEET_WEBAPP_URL:""', f'SHEET_WEBAPP_URL:"{PROBE}"')
            route.fulfill(status=200, content_type="application/javascript", body=body)

        page.route("**/js/config.js*", inject)

        sent = []
        page.route(PROBE, lambda r: (sent.append(r.request.post_data), r.fulfill(status=200, body="{}")))

        wait_ready(page)
        check("A1 config 已注入端點", page.evaluate("window.WEDDING_CONFIG.SHEET_WEBAPP_URL"), PROBE)

        reveal_scroll(page)
        fill_form(page, "出席", "2", "1", "1")
        page.click("#rsvpSubmit")
        page.wait_for_timeout(1500)

        check("A2 未開啟新分頁", len(popups), 0)
        check("A3 感謝提示已顯示", page.evaluate("!document.querySelector('#rsvpThanks').hidden"))
        check("A4 感謝標題文字", page.inner_text("#rsvpThanksTitle"), "感謝您的回覆")
        check("A5 備援區塊保持隱藏", page.evaluate("document.querySelector('#rsvpFallback').hidden"))
        check("A6 姓名已清空", page.input_value("#rsvpName"), "")
        check("A7 信箱已清空", page.input_value("#rsvpEmail"), "")
        check("A8 出席回預設", page.evaluate("document.querySelector('input[name=\"attend\"]:checked').value"), "出席")
        check("A9 關係回預設", page.evaluate("document.querySelector('input[name=\"relation\"]:checked').value"), "家人")
        check("A10 人數回預設 1/0/0",
              [page.input_value("#rsvpAdults"), page.input_value("#rsvpChildren"), page.input_value("#rsvpChairs")],
              ["1", "0", "0"])
        check("A11 未發出任何 email 請求", len(POSTS), 0)
        check("A12 端點收到 1 筆 POST", len(sent), 1)
        payload = json.loads(sent[0]) if sent else {}
        check("A13 payload 姓名", payload.get("name"), "QA測試賓客")
        check("A14 payload 出席/大人/兒童/椅",
              [payload.get("attend"), payload.get("adults"), payload.get("children"), payload.get("chairs")],
              ["出席", 2, 1, 1])
        check("A15 payload 賓客方/關係", [payload.get("side"), payload.get("relation")], ["女方", "朋友"])
        check("A16 水平溢出 0", overflow(page))
        check("A17 console error 0", len(console), 0)
        check("A18 pageerror 0", len(perrs), 0)
        page.screenshot(path=f"{SHOTS}/v32_local_desktop_thanks.png")
        page.click("#rsvpThanksClose")
        page.wait_for_timeout(400)
        check("A19 關閉後提示消失", page.evaluate("document.querySelector('#rsvpThanks').hidden"))
        ctx.close()

        # ─────────── B. 失敗路徑（桌機，端點為空＝正式站現況） ───────────
        print("\n[B] 失敗備援路徑（桌機，SHEET_WEBAPP_URL 為空）")
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        console, perrs, popups = [], [], []
        page = prep_page(ctx, console, perrs, popups)

        wait_ready(page)
        check("B1 端點為空", page.evaluate("window.WEDDING_CONFIG.SHEET_WEBAPP_URL"), "")
        reveal_scroll(page)
        fill_form(page, "出席", "4", "2", "2")
        page.click("#rsvpSubmit")
        page.wait_for_timeout(1200)

        check("B2 未開啟新分頁", len(popups), 0)
        check("B3 感謝提示未顯示", page.evaluate("document.querySelector('#rsvpThanks').hidden"))
        check("B4 備援區塊已顯示", page.evaluate("!document.querySelector('#rsvpFallback').hidden"))
        check("B5 備援標題", page.inner_text(".rsvp-fallback__title"), "回覆尚未送出")
        status_txt = page.inner_text("#rsvpStatus")
        check("B6 狀態含『尚未設定完成』", "尚未設定完成" in status_txt)
        check("B7 狀態帶 is-err 樣式",
              "is-err" in (page.get_attribute("#rsvpStatus", "class") or ""))
        check("B8 姓名內容保留", page.input_value("#rsvpName"), "QA測試賓客")
        check("B9 信箱內容保留", page.input_value("#rsvpEmail"), "qa.v32@example.com")
        check("B10 人數內容保留",
              [page.input_value("#rsvpAdults"), page.input_value("#rsvpChildren"), page.input_value("#rsvpChairs")],
              ["4", "2", "2"])
        href = page.get_attribute("#rsvpFallbackForm", "href") or ""
        check("B11 表單備援 href 含 prefill entry", "entry.1256769847=" in href and "usp=pp_url" in href)
        check("B12 表單備援帶入姓名", "QA%E6%B8%AC%E8%A9%A6%E8%B3%93%E5%AE%A2" in href)
        check("B13 表單備援帶入人數", "entry.907958152=4" in href and "entry.2135245100=2" in href)
        mail = page.get_attribute("#rsvpFallbackMail", "href") or ""
        check("B14 mailto 備援", mail.startswith("mailto:jack25860@gmail.com?subject="))
        check("B15 mailto 帶入內容", "%E5%87%BA%E5%B8%AD%E5%A4%A7%E4%BA%BA%E4%BA%BA%E6%95%B8" in mail)
        page.click("#rsvpFallbackCopy")
        page.wait_for_timeout(500)
        check("B16 複製後顯示提示", "已複製" in page.inner_text("#rsvpFallbackNote"))
        check("B17 未發出任何 email 請求", len(POSTS), 0)
        check("B18 水平溢出 0", overflow(page))
        check("B19 console error 0", len(console), 0)
        check("B20 pageerror 0", len(perrs), 0)
        page.screenshot(path=f"{SHOTS}/v32_local_desktop_fallback.png")
        ctx.close()

        # ─────────── C. 不克出席（桌機，失敗路徑下檢查人數不入列） ───────────
        print("\n[C] 不克出席（桌機）")
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        console, perrs, popups = [], [], []
        page = prep_page(ctx, console, perrs, popups)
        wait_ready(page)
        reveal_scroll(page)
        fill_form(page, "不克出席")
        check("C1 人數區塊隱藏", page.evaluate("document.querySelector('#rsvpNumWrap').hidden"))
        check("C2 三個 select 皆 disabled",
              page.evaluate("[...document.querySelectorAll('#rsvpNumWrap select')].every(s=>s.disabled)"))
        check("C3 兒童椅列隱藏", page.evaluate("document.querySelector('#rsvpChairRow').hidden"))
        page.click("#rsvpSubmit")
        page.wait_for_timeout(1000)
        mail = page.get_attribute("#rsvpFallbackMail", "href") or ""
        check("C4 備援內容不含大人人數", "出席大人人數" not in mail)
        check("C5 備援內容標示不克出席", "%E4%B8%8D%E5%85%8B%E5%87%BA%E5%B8%AD" in mail)
        check("C6 表單備援不含人數 entry", "entry.907958152" not in (page.get_attribute("#rsvpFallbackForm", "href") or ""))
        check("C7 console error 0", len(console), 0)
        ctx.close()

        # ─────────── D. 行動版（失敗路徑） ───────────
        print("\n[D] 行動版（390×844，失敗路徑）")
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        console, perrs, popups = [], [], []
        page = prep_page(ctx, console, perrs, popups)
        wait_ready(page)
        reveal_scroll(page)
        fill_form(page, "出席", "2", "1", "1")
        page.click("#rsvpSubmit")
        page.wait_for_timeout(1200)
        check("D1 未開啟新分頁", len(popups), 0)
        check("D2 備援區塊已顯示", page.evaluate("!document.querySelector('#rsvpFallback').hidden"))
        check("D3 內容保留", page.input_value("#rsvpName"), "QA測試賓客")
        check("D4 水平溢出 0", overflow(page))
        check("D5 備援按鈕在框內未溢出", page.evaluate(
            "(()=>{const b=document.querySelector('#rsvpFallback');"
            "return [...b.querySelectorAll('.btn')].every(e=>{const r=e.getBoundingClientRect(),p=b.getBoundingClientRect();"
            "return r.left>=p.left-1&&r.right<=p.right+1;});})()"))
        check("D6 console error 0", len(console), 0)
        check("D7 pageerror 0", len(perrs), 0)
        page.screenshot(path=f"{SHOTS}/v32_local_mobile_fallback.png")
        ctx.close()

        browser.close()
    httpd.shutdown()

    # 匯出成功路徑的 payload，供 Apps Script harness 二次驗證
    with open("/workspace/_v32_test/payloads.json", "w", encoding="utf-8") as f:
        json.dump({"probe_payloads": sent and [sent[0]] or []}, f, ensure_ascii=False, indent=2)

    fails = [r for r in RESULTS if not r[0]]
    print(f"\n== 共 {len(RESULTS)} 項，{'全部通過' if not fails else str(len(fails)) + ' 項失敗'} ==")
    for _, label, detail in fails:
        print(f"   FAIL: {label}  ({detail})")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    run()
