#!/usr/bin/env python3
"""PM 最終驗證：以真實 Chromium 讀取線上 /exec 的電子喜帖 POST 回應。"""
import json, time
from playwright.sync_api import sync_playwright

SITE = "https://jack25860.github.io/jack-and-lily-wedding/"
EXEC = "https://script.google.com/macros/s/AKfycbwMfQ2N-fNLdvUdsdiXT-1y5vMUWUyBhUMtMmR3cQjscGHA3WkKoabYCVvkazPdiMfW/exec"

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.goto(SITE, wait_until="networkidle", timeout=90000)
    time.sleep(1.0)

    # 1) 直接以頁面 fetch 讀取後端回應（模擬前端 postRow 的 plain() 路徑）
    r = page.evaluate("""async (u) => {
        try {
          const res = await fetch(u, {method:'POST',
            headers:{'Content-Type':'text/plain;charset=utf-8'},
            body: JSON.stringify({type:'ecard', to:'jack25860@gmail.com', subject:'[PM verify] ecard'})});
          const t = await res.text();
          return {readable:true, status:res.status, body:t.slice(0,600)};
        } catch(e) { return {readable:false, err:String(e)}; }
    }""", EXEC)
    print("=== direct fetch POST /exec (type=ecard) ===")
    print(json.dumps(r, ensure_ascii=False, indent=2))

    # 2) 走真實 UI 流程，攔截實際 POST 回應
    captured = []
    def on_resp(resp):
        if "script.google" in resp.url and resp.request.method == "POST":
            try:
                captured.append({"url": resp.url[:80], "status": resp.status,
                                 "body": resp.text()[:600]})
            except Exception as e:
                captured.append({"url": resp.url[:80], "status": resp.status, "err": str(e)})
    page.on("response", on_resp)

    page.click("#ecardMailBtn")
    time.sleep(0.8)
    page.fill("#ecardTo", "jack25860@gmail.com")
    page.click("#ecardSendBtn")
    status = ""
    for _ in range(60):
        time.sleep(0.5)
        status = page.eval_on_selector("#ecardStatus", "el => el.textContent.trim()")
        if status and "傳送中" not in status:
            break
    print("\n=== UI flow ===")
    print("status text:", repr(status))
    print("captured POST responses:", json.dumps(captured, ensure_ascii=False, indent=2))

    # 3) diag
    d = page.evaluate("""async (u) => {
        try { const res = await fetch(u + '?diag=1'); return await res.text(); }
        catch(e){ return 'ERR '+String(e); }
    }""", EXEC)
    print("\n=== /exec?diag=1 ===")
    print(d[:800])

    b.close()
