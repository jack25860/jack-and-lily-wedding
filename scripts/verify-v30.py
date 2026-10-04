import json, sys, time
from playwright.sync_api import sync_playwright

URL = "https://jack25860.github.io/jack-and-lily-wedding/"
OUT = sys.argv[1] if len(sys.argv) > 1 else "v30check"

results = {}

RSVP_JS = r"""
() => {
  const g = (s) => document.querySelector(s);
  const txt = (s) => { const e = g(s); return e ? (e.textContent || '').trim() : null; };
  return {
    thanks_in_dom: !!g('#rsvpThanks'),
    thanks_hidden: g('#rsvpThanks') ? g('#rsvpThanks').hidden : null,
    thanks_title: txt('#rsvpThanksTitle'),
    intro: txt('.rsvp__intro'),
    btn_text: txt('.rsvp-cta__text'),
    cta_hint: txt('.rsvp-cta__hint'),
    numWrap_display: g('#rsvpNumWrap') ? getComputedStyle(g('#rsvpNumWrap')).display : null,
    chair_disabled: g('#rsvpChairs') ? g('#rsvpChairs').disabled : null,
    sheetCfg: (window.WEDDING_CONFIG || {}).SHEET_WEBAPP_URL,
    prefillFlag: (window.WEDDING_CONFIG || {}).RSVP_PREFILL_FORM,
  };
}
"""

FILL_JS = r"""
() => {
  const set = (sel, v) => { const e = document.querySelector(sel); if (e) { e.value = v; e.dispatchEvent(new Event('input', {bubbles:true})); e.dispatchEvent(new Event('change', {bubbles:true})); } };
  set('#rsvpName', 'QA自動測試');
  set('#rsvpEmail', 'qa@example.com');
  document.querySelector('input[name="relation"][value="朋友"]').click();
  document.querySelector('input[name="attend"][value="出席"]').click();
  set('#rsvpAdults', '2');
  set('#rsvpChildren', '1');
  set('#rsvpChairs', '1');
  const out = {};
  document.querySelectorAll('#rsvpForm input, #rsvpForm select').forEach((e) => {
    if (!e.name) return;
    out[e.name] = e.type === 'radio' ? (e.checked ? e.value : out[e.name]) : e.value;
  });
  return out;
}
"""

STATE_JS = r"""
() => {
  const v = (s) => { const e = document.querySelector(s); return e ? String(e.value) : null; };
  return {
    name: v('#rsvpName'), email: v('#rsvpEmail'),
    adults: v('#rsvpAdults'), children: v('#rsvpChildren'), chairs: v('#rsvpChairs'),
    side: document.querySelector('input[name="side"]:checked') ? document.querySelector('input[name="side"]:checked').value : null,
    relation: document.querySelector('input[name="relation"]:checked') ? document.querySelector('input[name="relation"]:checked').value : null,
    attend: document.querySelector('input[name="attend"]:checked') ? document.querySelector('input[name="attend"]:checked').value : null,
    status: (document.querySelector('#rsvpStatus') || {}).textContent || '',
    thanks_hidden: document.querySelector('#rsvpThanks') ? document.querySelector('#rsvpThanks').hidden : null,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    bodyScrollW: document.body.scrollWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
}
"""

DECLINE_JS = r"""
() => {
  document.querySelector('input[name="attend"][value="不克出席"]').click();
  const w = document.querySelector('#rsvpNumWrap');
  const c = document.querySelector('#rsvpChairs');
  const a = document.querySelector('#rsvpAdults');
  return {
    wrap_hidden: w ? w.hidden : null,
    wrap_display: w ? getComputedStyle(w).display : null,
    chairs_disabled: c ? c.disabled : null,
    adults_disabled: a ? a.disabled : null,
  };
}
"""


def run(browser, label, viewport, is_mobile):
    ctx = browser.new_context(viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile)
    page = ctx.new_page()
    errs, pageerrs, reqs, newpages = [], [], [], []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: pageerrs.append(str(e)))
    page.on("request", lambda r: reqs.append(r.url))
    ctx.on("page", lambda p: newpages.append(p.url))

    page.goto(URL + "?cb=" + str(int(time.time())), wait_until="load", timeout=90000)
    page.wait_for_timeout(2500)

    info = page.evaluate(RSVP_JS)

    # step-scroll to fire reveal animations, then return to RSVP
    for y in range(0, 14000, 700):
        page.mouse.wheel(0, 700)
        page.wait_for_timeout(60)
    page.wait_for_timeout(600)
    page.evaluate("() => document.getElementById('rsvp').scrollIntoView({block:'center'})")
    page.wait_for_timeout(900)

    before = page.evaluate(STATE_JS)
    filled = page.evaluate(FILL_JS)
    page.wait_for_timeout(300)

    # submit
    page.evaluate("() => document.querySelector('#rsvpSubmit').click()")
    page.wait_for_timeout(3200)

    after = page.evaluate(STATE_JS)
    decline = page.evaluate(DECLINE_JS)
    page.wait_for_timeout(400)

    # overlay must not break layout
    overflow_after = page.evaluate("() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})")

    shot = page.locator("#rsvpThanks")
    if info["thanks_hidden"] is False or after["thanks_hidden"] is False:
        try:
            shot.screenshot(path=f"{OUT}/{label}_thanks.png")
        except Exception as e:
            print("shot err", e)

    # close overlay
    page.evaluate("() => { const b = document.querySelector('#rsvpThanksClose'); if (b) b.click(); }")
    page.wait_for_timeout(600)
    closed = page.evaluate("() => { const b=document.querySelector('#rsvpThanks'); return b ? b.hidden : null; }")

    # RSVP block screenshot
    try:
        page.locator("#rsvp").screenshot(path=f"{OUT}/{label}_rsvp.png")
    except Exception as e:
        print("rsvp shot err", e)

    ext_submit = sorted({u for u in reqs if "formsubmit.co" in u or "script.google.com" in u})

    ctx.close()
    return {
        "label": label,
        "viewport": viewport,
        "info": info,
        "before": before,
        "filled": filled,
        "after_submit": after,
        "decline_toggle": decline,
        "closed_again": closed,
        "overflow_after_submit": overflow_after,
        "console_errors": errs,
        "page_errors": pageerrs,
        "new_tabs_opened": newpages,
        "endpoints_hit": ext_submit,
    }


import os
os.makedirs(OUT, exist_ok=True)
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    results["desktop"] = run(browser, "desktop", {"width": 1440, "height": 900}, False)
    results["mobile"] = run(browser, "mobile", {"width": 390, "height": 844}, True)
    browser.close()

print(json.dumps(results, ensure_ascii=False, indent=1))
