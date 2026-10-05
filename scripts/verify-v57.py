#!/usr/bin/env python3
# v57 verification: font-size control (sm/md/lg) + regression of preserved features.
import json, sys, time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8123/index.html"
ECARD = "http://127.0.0.1:8123/ecard-video.html"
results = []
def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + ("  | " + str(detail) if detail else ""))

def run(pw, label, viewport, is_mobile, has_touch, ua=None):
    print("\n===== %s (%s) =====" % (label, viewport))
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport=viewport, is_mobile=is_mobile, has_touch=has_touch,
                              user_agent=ua, device_scale_factor=2 if is_mobile else 1)
    page = ctx.new_page()
    errs = []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    page.goto(BASE, wait_until="load")
    page.wait_for_timeout(1200)

    # --- fontctl presence ---
    check(label+" fontctl present", page.locator("#fontctl").count() == 1)
    opts = page.locator(".fontctl__opt")
    check(label+" 3 options", opts.count() == 3, opts.count())
    labels = [opts.nth(i).inner_text().strip() for i in range(opts.count())]
    check(label+" labels 小/中/大", labels == ["小","中","大"], labels)

    # --- default md ---
    cls = page.evaluate("() => document.documentElement.className")
    check(label+" default md class", "font-scale-md" in cls, cls)
    pressed = page.evaluate("() => [...document.querySelectorAll('.fontctl__opt')].map(b=>b.getAttribute('aria-pressed'))")
    check(label+" default aria-pressed md", pressed == ["false","true","false"], pressed)
    base_fs = page.evaluate("() => getComputedStyle(document.documentElement).fontSize")
    check(label+" default root font-size 16px", base_fs == "16px", base_fs)

    # --- click 大 (lg) via real tap ---
    page.locator('.fontctl__opt[data-fs="lg"]').tap() if has_touch else page.locator('.fontctl__opt[data-fs="lg"]').click()
    page.wait_for_timeout(400)
    cls = page.evaluate("() => document.documentElement.className")
    lg_fs = page.evaluate("() => getComputedStyle(document.documentElement).fontSize")
    check(label+" lg class applied", "font-scale-lg" in cls, cls)
    check(label+" lg root font-size 19px", lg_fs == "19px", lg_fs)
    check(label+" lg > md", float(lg_fs[:-2]) > float(base_fs[:-2]), (base_fs, lg_fs))
    # a heading actually scales
    h_fs_lg = page.evaluate("() => getComputedStyle(document.querySelector('.section__title')).fontSize")

    # --- click 小 (sm) ---
    page.locator('.fontctl__opt[data-fs="sm"]').tap() if has_touch else page.locator('.fontctl__opt[data-fs="sm"]').click()
    page.wait_for_timeout(400)
    cls = page.evaluate("() => document.documentElement.className")
    sm_fs = page.evaluate("() => getComputedStyle(document.documentElement).fontSize")
    check(label+" sm class applied", "font-scale-sm" in cls, cls)
    check(label+" sm root font-size 14px", sm_fs == "14px", sm_fs)
    h_fs_sm = page.evaluate("() => getComputedStyle(document.querySelector('.section__title')).fontSize")
    check(label+" heading scales sm<lg", float(h_fs_sm[:-2]) < float(h_fs_lg[:-2]), (h_fs_sm, h_fs_lg))

    # --- persistence: reload keeps sm ---
    page.reload(wait_until="load"); page.wait_for_timeout(900)
    cls = page.evaluate("() => document.documentElement.className")
    check(label+" persistence after reload (sm)", "font-scale-sm" in cls, cls)
    ls = page.evaluate("() => localStorage.getItem('ssss-wedding-font-scale')")
    check(label+" localStorage key", ls == "sm", ls)

    # --- default not affected by junk old data ---
    page.evaluate("() => localStorage.setItem('ssss-wedding-font-scale','HUGE')")
    page.reload(wait_until="load"); page.wait_for_timeout(900)
    cls = page.evaluate("() => document.documentElement.className")
    check(label+" junk value falls back to md", "font-scale-md" in cls, cls)

    # --- no overlap with .music + no horizontal overflow ---
    page.evaluate("() => localStorage.setItem('ssss-wedding-font-scale','md')")
    page.reload(wait_until="load"); page.wait_for_timeout(1000)
    geo = page.evaluate("""() => {
      const f=document.querySelector('#fontctl').getBoundingClientRect();
      const m=document.querySelector('#music').getBoundingClientRect();
      return {fTop:f.top,fBottom:f.bottom,fLeft:f.left,fRight:f.right,mTop:m.top,mBottom:m.bottom,mLeft:m.left,mRight:m.right,
              vw:innerWidth, vh:innerHeight,
              sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth};
    }""")
    check(label+" fontctl above music (no overlap)", geo["fBottom"] <= geo["mTop"] + 1, (round(geo["fBottom"],1), round(geo["mTop"],1)))
    check(label+" fontctl within viewport", geo["fTop"] >= 0 and geo["fRight"] <= geo["vw"] + 1 and geo["fLeft"] >= 0, geo)
    check(label+" no horizontal overflow", geo["sw"] <= geo["cw"] + 1, (geo["sw"], geo["cw"]))

    # --- touch target size ---
    tgt = page.evaluate("() => [...document.querySelectorAll('.fontctl__opt')].map(b=>b.getBoundingClientRect().height)")
    check(label+" touch targets >=44px", all(h >= 44 for h in tgt), [round(h,1) for h in tgt])

    # --- regression: music default on ---
    mcls = page.evaluate("() => document.querySelector('#musicBtn').className")
    check(label+" music default playing", "playing" in mcls, mcls)
    check(label+" music label MUSIC ON", page.locator("#musicLabel").inner_text().strip() == "MUSIC ON")

    # --- regression: RSVP adults cap 10 ---
    opts_adults = page.evaluate("() => [...document.querySelectorAll('#rsvpForm [name=adults] option')].map(o=>o.value)")
    check(label+" adults options max 10", opts_adults and max(int(v) for v in opts_adults) == 10, opts_adults)

    # --- regression: key sections present ---
    for sel, nm in [("#rsvpForm","rsvp form"),("#countdown","countdown"),("#notes","notes section"),
                    ("#trailerVideo","trailer video"),("#galleryThemes","gallery themes"),("#msgForm","message form")]:
        check(label+" has "+nm, page.locator(sel).count() >= 1)

    # --- console errors ---
    check(label+" console errors 0", len(errs) == 0, errs[:3])

    # --- screenshots ---
    page.evaluate("() => window.scrollTo(0,0)")
    page.wait_for_timeout(300)
    page.screenshot(path="scripts/v57-%s-full.png" % label.replace(" ","_"), full_page=False)
    page.locator("#fontctl").screenshot(path="scripts/v57-%s-fontctl.png" % label.replace(" ","_"))
    # combined float area
    page.screenshot(path="scripts/v57-%s-floatarea.png" % label.replace(" ","_"), clip={"x": geo["vw"]-260, "y": geo["vh"]-220, "width": 260, "height": 220})

    # --- ecard page regression ---
    page.goto(ECARD, wait_until="load"); page.wait_for_timeout(1200)
    check(label+" ecard float sound switch", page.locator("#ecardSound, .ecard-sound, [id*=sound], [class*=sound]").count() >= 1)
    check(label+" ecard video element", page.locator("video").count() >= 1)
    check(label+" ecard console errors 0", len(errs) == 0, errs[:3])

    ctx.close(); browser.close()

with sync_playwright() as pw:
    run(pw, "desktop", {"width":1440,"height":900}, False, False)
    run(pw, "android", {"width":390,"height":844}, True, True,
        ua="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36")
    run(pw, "ios", {"width":390,"height":844}, True, True,
        ua="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")

fails = [r for r in results if not r[1]]
print("\n===== SUMMARY: %d/%d passed, %d FAIL =====" % (len(results)-len(fails), len(results), len(fails)))
for n,_,d in fails:
    print("  FAIL:", n, d)
sys.exit(1 if fails else 0)
