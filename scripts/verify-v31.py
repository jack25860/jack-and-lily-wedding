#!/usr/bin/env python3
"""v31 live verification.

Proves, against the LIVE GitHub Pages site:
  * RSVP submit sends NO email request (no formsubmit.co / mailto) and opens NO new tab
  * RSVP submit DOES POST to the Apps Script webapp (SHEET_WEBAPP_URL)
  * the "感謝您的回覆" overlay appears and the form resets to defaults
  * the "不克出席" path hides/disables the guest-count fields
  * no horizontal overflow, no console/page errors
The sheet endpoint is injected by intercepting js/config.js BEFORE app.js boots,
because initRsvp() captures SHEET_WEBAPP_URL at load time.
"""
import json, os
from playwright.sync_api import sync_playwright

LIVE = "https://jack25860.github.io/jack-and-lily-wedding/"
OUT = "/workspace/documents/v31_rsvp_flow"
os.makedirs(OUT, exist_ok=True)
FAKE_SHEET = "https://httpbin.org/post"


def run(label, viewport, is_mobile=False, attend="出席"):
    reqs, new_tabs, errors = [], [], []
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile)
        page = ctx.new_page()
        page.on("request", lambda r: reqs.append(r.url))
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append("console:" + m.text) if m.type == "error" else None)
        ctx.on("page", lambda pg: new_tabs.append(pg.url))

        # inject the sheet endpoint into config.js before app.js reads it
        def patch_config(route):
            resp = route.fetch()
            body = resp.text().replace('SHEET_WEBAPP_URL:""', f'SHEET_WEBAPP_URL:"{FAKE_SHEET}"')
            route.fulfill(status=200, content_type="application/javascript", body=body)

        page.route("**/js/config.js*", patch_config)

        page.goto(LIVE, wait_until="load")
        page.wait_for_timeout(2500)
        page.evaluate("() => { const s=document.querySelector('#rsvp'); s && s.scrollIntoView(); }")
        page.wait_for_timeout(1200)

        page.fill("#rsvpName", "QA自動測試")
        page.fill("#rsvpEmail", "qa@example.com")
        page.check('input[name="side"][value="女方"]')
        page.check('input[name="relation"][value="朋友"]')
        if attend == "出席":
            page.check('input[name="attend"][value="出席"]')
            page.select_option("#rsvpAdults", "2")
            page.select_option("#rsvpChildren", "1")
            page.select_option("#rsvpChairs", "1")
        else:
            page.check('input[name="attend"][value="不克出席"]')
        page.wait_for_timeout(400)

        before = page.evaluate(
            """() => ({
              name: document.querySelector('#rsvpName').value,
              email: document.querySelector('#rsvpEmail').value,
              adults: document.querySelector('#rsvpAdults').value,
              children: document.querySelector('#rsvpChildren').value,
              chairs: document.querySelector('#rsvpChairs').value,
              attend: (document.querySelector('input[name=attend]:checked')||{}).value,
              relation: (document.querySelector('input[name=relation]:checked')||{}).value,
              numWrapDisplay: getComputedStyle(document.querySelector('#rsvpNumWrap')).display,
              numWrapHidden: document.querySelector('#rsvpNumWrap').hidden,
              adultsDisabled: document.querySelector('#rsvpAdults').disabled,
              childrenDisabled: document.querySelector('#rsvpChildren').disabled,
              chairsDisabled: document.querySelector('#rsvpChairs').disabled,
            })"""
        )

        reqs.clear()
        page.click("#rsvpSubmit")
        page.wait_for_timeout(3500)

        after = page.evaluate(
            """() => ({
              name: document.querySelector('#rsvpName').value,
              email: document.querySelector('#rsvpEmail').value,
              adults: document.querySelector('#rsvpAdults').value,
              children: document.querySelector('#rsvpChildren').value,
              chairs: document.querySelector('#rsvpChairs').value,
              attend: (document.querySelector('input[name=attend]:checked')||{}).value,
              relation: (document.querySelector('input[name=relation]:checked')||{}).value,
              thanksHidden: document.querySelector('#rsvpThanks').hidden,
              thanksTitle: (document.querySelector('#rsvpThanksTitle')||{}).textContent,
              numWrapDisplay: getComputedStyle(document.querySelector('#rsvpNumWrap')).display,
              scrollW: document.documentElement.scrollWidth,
              clientW: document.documentElement.clientWidth,
            })"""
        )

        email_reqs = sorted({u for u in reqs if "formsubmit.co" in u or u.startswith("mailto")})
        sheet_reqs = sorted({u for u in reqs if "httpbin.org" in u})

        if not after["thanksHidden"]:
            try:
                page.locator("#rsvpThanks").screenshot(path=f"{OUT}/{label}_thanks.png")
            except Exception as e:
                print("thanks shot err", e)
            page.evaluate("() => { const b=document.querySelector('#rsvpThanksClose'); if(b) b.click(); }")
            page.wait_for_timeout(700)

        try:
            page.locator("#rsvp").screenshot(path=f"{OUT}/{label}_rsvp.png")
        except Exception as e:
            print("rsvp shot err", e)

        ctx.close()
        b.close()
    return {
        "label": label,
        "before": before,
        "after": after,
        "email_requests": email_reqs,
        "sheet_requests": sheet_reqs,
        "new_tabs": new_tabs,
        "errors": errors,
    }


if __name__ == "__main__":
    results = [
        run("desktop_attend", {"width": 1440, "height": 900}),
        run("mobile_attend", {"width": 390, "height": 844}, is_mobile=True),
        run("desktop_decline", {"width": 1440, "height": 900}, attend="不克出席"),
    ]
    print(json.dumps(results, ensure_ascii=False, indent=2))
