#!/usr/bin/env python3
# v58 verification: font-size control collapsed as round "Tt" button, expands on tap,
# auto-collapses after choosing a level; plus regression of preserved features.
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8123/index.html"
ECARD = "http://127.0.0.1:8123/ecard-video.html"
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + ("  | " + str(detail) if detail else ""))


def opts_state(page):
    st = page.evaluate("""() => {
      const o=document.querySelector('#fontctlOpts');
      const cs=getComputedStyle(o);
      return {vis:cs.visibility, op:parseFloat(cs.opacity), pe:cs.pointerEvents,
              hidden:o.hidden, rect:o.getBoundingClientRect().width};
    }""")
    # collapsed = not interactive and visually gone (visibility flips at the end of the
    # transition, so treat opacity~0 + pointer-events:none as the authoritative signal)
    st["collapsed"] = (st["op"] < 0.05 and st["pe"] == "none")
    st["expanded"] = (st["op"] > 0.9 and st["pe"] == "auto")
    return st


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

    def tap(sel):
        if has_touch:
            page.locator(sel).tap()
        else:
            page.locator(sel).click()

    # --- structure ---
    check(label + " fontctl present", page.locator("#fontctl").count() == 1)
    check(label + " round toggle present", page.locator("#fontctlToggle").count() == 1)
    check(label + " toggle shows Tt", page.locator("#fontctlToggle .fontctl__tt").inner_text().strip() == "Tt",
          page.locator("#fontctlToggle .fontctl__tt").inner_text().strip())
    opts = page.locator(".fontctl__opt")
    check(label + " 3 options", opts.count() == 3, opts.count())
    labels = page.evaluate("() => [...document.querySelectorAll('.fontctl__opt')].map(b=>b.textContent.trim())")
    check(label + " labels 小/中/大", labels == ["小", "中", "大"], labels)

    # --- collapsed by default ---
    st = opts_state(page)
    check(label + " collapsed by default (opts hidden)", st["collapsed"], st)
    check(label + " data-open=false", page.get_attribute("#fontctl", "data-open") == "false")
    check(label + " aria-expanded=false", page.get_attribute("#fontctlToggle", "aria-expanded") == "false")
    check(label + " aria-controls set", page.get_attribute("#fontctlToggle", "aria-controls") == "fontctlOpts")

    # --- default md ---
    cls = page.evaluate("() => document.documentElement.className")
    check(label + " default md class", "font-scale-md" in cls, cls)
    pressed = page.evaluate("() => [...document.querySelectorAll('.fontctl__opt')].map(b=>b.getAttribute('aria-pressed'))")
    check(label + " default aria-pressed md", pressed == ["false", "true", "false"], pressed)
    base_fs = page.evaluate("() => getComputedStyle(document.documentElement).fontSize")
    check(label + " default root font-size 16px", base_fs == "16px", base_fs)

    # --- tap Tt -> expands ---
    tap("#fontctlToggle")
    page.wait_for_timeout(500)
    st = opts_state(page)
    check(label + " tap Tt expands (opts visible)", st["expanded"], st)
    check(label + " expanded aria-expanded=true", page.get_attribute("#fontctlToggle", "aria-expanded") == "true")
    check(label + " expanded data-open=true", page.get_attribute("#fontctl", "data-open") == "true")
    # options sit ABOVE the round button
    geo_open = page.evaluate("""() => {
      const o=document.querySelector('#fontctlOpts').getBoundingClientRect();
      const t=document.querySelector('#fontctlToggle').getBoundingClientRect();
      return {oBottom:o.bottom, tTop:t.top, oLeft:o.left, oRight:o.right, vw:innerWidth};
    }""")
    check(label + " options above round button", geo_open["oBottom"] <= geo_open["tTop"] + 1,
          (round(geo_open["oBottom"], 1), round(geo_open["tTop"], 1)))
    check(label + " options within viewport", geo_open["oLeft"] >= 0 and geo_open["oRight"] <= geo_open["vw"] + 1, geo_open)

    # --- choose 大 -> applies lg AND auto-collapses ---
    tap('.fontctl__opt[data-fs="lg"]')
    page.wait_for_timeout(800)
    cls = page.evaluate("() => document.documentElement.className")
    lg_fs = page.evaluate("() => getComputedStyle(document.documentElement).fontSize")
    check(label + " lg class applied", "font-scale-lg" in cls, cls)
    check(label + " lg root font-size 19px", lg_fs == "19px", lg_fs)
    check(label + " lg > md", float(lg_fs[:-2]) > float(base_fs[:-2]), (base_fs, lg_fs))
    st = opts_state(page)
    check(label + " AUTO-COLLAPSE after choosing 大", st["collapsed"], st)
    check(label + " auto-collapse aria-expanded=false", page.get_attribute("#fontctlToggle", "aria-expanded") == "false")
    check(label + " auto-collapse data-open=false", page.get_attribute("#fontctl", "data-open") == "false")
    h_fs_lg = page.evaluate("() => getComputedStyle(document.querySelector('.section__title')).fontSize")

    # --- choose 小 -> applies sm AND auto-collapses ---
    tap("#fontctlToggle")
    page.wait_for_timeout(400)
    tap('.fontctl__opt[data-fs="sm"]')
    page.wait_for_timeout(500)
    cls = page.evaluate("() => document.documentElement.className")
    sm_fs = page.evaluate("() => getComputedStyle(document.documentElement).fontSize")
    check(label + " sm class applied", "font-scale-sm" in cls, cls)
    check(label + " sm root font-size 14px", sm_fs == "14px", sm_fs)
    h_fs_sm = page.evaluate("() => getComputedStyle(document.querySelector('.section__title')).fontSize")
    check(label + " heading scales sm<lg", float(h_fs_sm[:-2]) < float(h_fs_lg[:-2]), (h_fs_sm, h_fs_lg))
    st = opts_state(page)
    check(label + " AUTO-COLLAPSE after choosing 小", st["collapsed"], st)

    # --- choose 中 -> back to md ---
    tap("#fontctlToggle")
    page.wait_for_timeout(400)
    tap('.fontctl__opt[data-fs="md"]')
    page.wait_for_timeout(500)
    md_fs = page.evaluate("() => getComputedStyle(document.documentElement).fontSize")
    check(label + " md root font-size 16px after choosing 中", md_fs == "16px", md_fs)

    # --- click outside collapses ---
    tap("#fontctlToggle")
    page.wait_for_timeout(400)
    check(label + " expanded before outside click", opts_state(page)["expanded"])
    if has_touch:
        page.touchscreen.tap(viewport["width"] // 2, 120)
    else:
        page.mouse.click(viewport["width"] // 2, 120)
    page.wait_for_timeout(800)
    st = opts_state(page)
    check(label + " outside click collapses", st["collapsed"], st)

    # --- Esc collapses ---
    tap("#fontctlToggle")
    page.wait_for_timeout(400)
    check(label + " expanded before Esc", opts_state(page)["expanded"])
    page.keyboard.press("Escape")
    page.wait_for_timeout(800)
    st = opts_state(page)
    check(label + " Esc collapses", st["collapsed"], st)

    # --- persistence: choose sm, reload keeps sm ---
    tap("#fontctlToggle")
    page.wait_for_timeout(400)
    tap('.fontctl__opt[data-fs="sm"]')
    page.wait_for_timeout(400)
    page.reload(wait_until="load")
    page.wait_for_timeout(900)
    cls = page.evaluate("() => document.documentElement.className")
    check(label + " persistence after reload (sm)", "font-scale-sm" in cls, cls)
    ls = page.evaluate("() => localStorage.getItem('ssss-wedding-font-scale')")
    check(label + " localStorage key", ls == "sm", ls)
    check(label + " still collapsed after reload", opts_state(page)["collapsed"])

    # --- junk value falls back to md ---
    page.evaluate("() => localStorage.setItem('ssss-wedding-font-scale','HUGE')")
    page.reload(wait_until="load")
    page.wait_for_timeout(900)
    cls = page.evaluate("() => document.documentElement.className")
    check(label + " junk value falls back to md", "font-scale-md" in cls, cls)

    # --- geometry: no overlap with .music, within viewport, no h-overflow ---
    page.evaluate("() => localStorage.setItem('ssss-wedding-font-scale','md')")
    page.reload(wait_until="load")
    page.wait_for_timeout(1000)
    geo = page.evaluate("""() => {
      const f=document.querySelector('#fontctl').getBoundingClientRect();
      const m=document.querySelector('#music').getBoundingClientRect();
      return {fTop:f.top,fBottom:f.bottom,fLeft:f.left,fRight:f.right,mTop:m.top,mBottom:m.bottom,
              vw:innerWidth, vh:innerHeight,
              sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth};
    }""")
    check(label + " fontctl above music (no overlap)", geo["fBottom"] <= geo["mTop"] + 1,
          (round(geo["fBottom"], 1), round(geo["mTop"], 1)))
    check(label + " fontctl within viewport",
          geo["fTop"] >= 0 and geo["fRight"] <= geo["vw"] + 1 and geo["fLeft"] >= 0, geo)
    check(label + " no horizontal overflow", geo["sw"] <= geo["cw"] + 1, (geo["sw"], geo["cw"]))

    # --- touch targets (measure while EXPANDED: the collapsed state is scaled .94) ---
    tap("#fontctlToggle")
    page.wait_for_timeout(600)
    tgt = page.evaluate("() => [...document.querySelectorAll('.fontctl__opt')].map(b=>b.getBoundingClientRect().height)")
    check(label + " option touch targets >=44px", all(h >= 44 for h in tgt), [round(h, 1) for h in tgt])
    tt = page.evaluate("() => {const r=document.querySelector('#fontctlToggle').getBoundingClientRect();return [r.width,r.height];}")
    check(label + " toggle touch target >=44px", tt[0] >= 44 and tt[1] >= 44, [round(v, 1) for v in tt])
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)

    # --- regression: music default on ---
    mcls = page.evaluate("() => document.querySelector('#musicBtn').className")
    check(label + " music default playing", "playing" in mcls, mcls)
    check(label + " music label MUSIC ON", page.locator("#musicLabel").inner_text().strip() == "MUSIC ON")

    # --- regression: RSVP adults cap 10 ---
    opts_adults = page.evaluate("() => [...document.querySelectorAll('#rsvpForm [name=adults] option')].map(o=>o.value)")
    check(label + " adults options max 10", opts_adults and max(int(v) for v in opts_adults) == 10, opts_adults)

    # --- regression: key sections present ---
    for sel, nm in [("#rsvpForm", "rsvp form"), ("#countdown", "countdown"), ("#notes", "notes section"),
                    ("#trailerVideo", "trailer video"), ("#galleryThemes", "gallery themes"), ("#msgForm", "message form")]:
        check(label + " has " + nm, page.locator(sel).count() >= 1)

    # --- console errors ---
    check(label + " console errors 0", len(errs) == 0, errs[:3])

    # --- screenshots ---
    page.evaluate("() => window.scrollTo(0,0)")
    page.wait_for_timeout(300)
    tag = label.replace(" ", "_")
    page.screenshot(path="scripts/v58-%s-full.png" % tag, full_page=False)
    page.locator("#fontctl").screenshot(path="scripts/v58-%s-collapsed.png" % tag)
    page.screenshot(path="scripts/v58-%s-floatarea.png" % tag,
                    clip={"x": geo["vw"] - 260, "y": geo["vh"] - 240, "width": 260, "height": 240})
    tap("#fontctlToggle")
    page.wait_for_timeout(600)
    page.screenshot(path="scripts/v58-%s-expanded.png" % tag,
                    clip={"x": geo["vw"] - 300, "y": geo["vh"] - 300, "width": 300, "height": 300})

    # --- ecard page regression ---
    page.goto(ECARD, wait_until="load")
    page.wait_for_timeout(1200)
    check(label + " ecard float sound switch",
          page.locator("#ecardSound, .ecard-sound, [id*=sound], [class*=sound]").count() >= 1)
    check(label + " ecard video element", page.locator("video").count() >= 1)
    check(label + " ecard console errors 0", len(errs) == 0, errs[:3])

    ctx.close()
    browser.close()


with sync_playwright() as pw:
    run(pw, "desktop", {"width": 1440, "height": 900}, False, False)
    run(pw, "android", {"width": 390, "height": 844}, True, True,
        ua="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36")
    run(pw, "ios", {"width": 390, "height": 844}, True, True,
        ua="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")

fails = [r for r in results if not r[1]]
print("\n===== SUMMARY: %d/%d passed, %d FAIL =====" % (len(results) - len(fails), len(results), len(fails)))
for n, _, d in fails:
    print("  FAIL:", n, d)
sys.exit(1 if fails else 0)
