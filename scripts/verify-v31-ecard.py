#!/usr/bin/env python3
"""v31: confirm the e-card manual send path is untouched (still FormSubmit, manual only)."""
import json, os
from playwright.sync_api import sync_playwright

LIVE = "https://jack25860.github.io/jack-and-lily-wedding/"
OUT = "/workspace/documents/v31_rsvp_flow"
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    reqs = []
    page.on("request", lambda r: reqs.append(r.url))
    page.goto(LIVE, wait_until="load")
    page.wait_for_timeout(2500)
    page.evaluate("() => { const s=document.querySelector('#ecardShow'); s && s.scrollIntoView(); }")
    page.wait_for_timeout(1500)

    # auto-rotation must advance
    idx1 = page.evaluate("() => [...document.querySelectorAll('.ecard-show__slide')].findIndex(s=>s.classList.contains('is-on'))")
    page.wait_for_timeout(6000)
    idx2 = page.evaluate("() => [...document.querySelectorAll('.ecard-show__slide')].findIndex(s=>s.classList.contains('is-on'))")

    # open the manual send panel
    page.click("#ecardMailBtn")
    page.wait_for_timeout(600)
    panel_open = page.evaluate("() => !document.querySelector('#ecardPanel').hidden")

    # invalid email -> error, no request
    reqs.clear()
    page.fill("#ecardTo", "not-an-email")
    page.click("#ecardSendBtn")
    page.wait_for_timeout(800)
    err = page.evaluate("() => document.querySelector('#ecardStatus').textContent")
    reqs_after_invalid = list(reqs)

    # valid email -> FormSubmit request
    reqs.clear()
    page.fill("#ecardTo", "guest@example.com")
    page.click("#ecardSendBtn")
    page.wait_for_timeout(2500)
    ok = page.evaluate("() => document.querySelector('#ecardStatus').textContent")
    fs = sorted({u for u in reqs if "formsubmit.co" in u})

    try:
        page.locator("#ecardShow").screenshot(path=f"{OUT}/desktop_ecard.png")
    except Exception as e:
        print("ecard shot err", e)

    print(json.dumps({
        "slide_idx_before": idx1,
        "slide_idx_after_6s": idx2,
        "rotation_advanced": idx1 != idx2,
        "panel_open": panel_open,
        "invalid_email_status": err,
        "requests_on_invalid": reqs_after_invalid,
        "valid_email_status": ok,
        "formsubmit_requests": fs,
    }, ensure_ascii=False, indent=2))
    ctx.close()
    b.close()
