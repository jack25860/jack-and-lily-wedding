#!/usr/bin/env python3
"""v36 real-browser verification against the LIVE GitHub Pages site.

Gallery: 3 themes in order 戰國→唐代→明朝, 6 preview each (all couple shots), expand works,
no h-scroll, no broken imgs. Corrected dynasty split: 戰國 39 / 唐代 47 / 明朝 56.
RSVP regression (unchanged feature): 傳送中… → 感謝 → form cleared, no new tab, 0 email requests.
The sheet endpoint is STUBBED so no rows are written to the couple's live spreadsheet.
"""
import json, os, re, sys, time
from playwright.sync_api import sync_playwright

URL = "https://jack25860.github.io/jack-and-lily-wedding/"
OUT = "/workspace/documents/v36_gallery"
os.makedirs(OUT, exist_ok=True)

fails, passes = [], []
def chk(tag, name, cond, extra=None):
    if cond: passes.append(name); print("PASS [%s] %s" % (tag, name))
    else:
        fails.append((tag, name, extra)); print("FAIL [%s] %s  %s" % (tag, name, extra))

results = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    for label, vw, vh in [("desktop", 1440, 900), ("mobile", 390, 844)]:
        ctx = b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1)
        page = ctx.new_page()
        console, perr, email_reqs, posts, newpages = [], [], [], [], []
        page.on("console", lambda m: console.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: perr.append(str(e)))
        page.on("popup", lambda pg: newpages.append(pg.url))
        def on_req(r):
            u = r.url
            if "formsubmit.co" in u or u.startswith("mailto:"): email_reqs.append(u)
            elif "/exec" in u and r.method == "POST": posts.append(u)
        page.on("request", on_req)

        # stub the Apps Script endpoint so nothing is written to the real sheet
        page.route("**/exec*", lambda route: route.fulfill(
            status=200, content_type="text/plain",
            body="RSVP endpoint is running. v36" if route.request.method == "GET" else '{"ok":true}'))

        page.goto(URL, wait_until="load")
        page.wait_for_timeout(3500)
        page.evaluate("document.documentElement.style.scrollBehavior='auto'")
        page.evaluate("document.querySelectorAll('.loader').forEach(function(e){e.classList.add('done')})")
        page.wait_for_timeout(500)

        # ---------- gallery ----------
        themes = page.evaluate("""() => {
          const out=[];
          document.querySelectorAll('#galleryThemes .gtheme').forEach(t=>{
            const nm=t.querySelector('.gtheme__name');
            const vis=t.querySelectorAll('.masonry:not([hidden]) .g-item img');
            const more=t.querySelector('.gtheme__more');
            const btn=t.querySelector('.gtheme__toggle');
            out.push({name:nm?nm.textContent.trim():null,
                      visible:vis.length,
                      moreHidden: more? more.hasAttribute('hidden') : null,
                      moreCount: more? more.querySelectorAll('.g-item img').length : 0,
                      btnLabel: btn? btn.textContent.trim():null,
                      ariaExpanded: btn? btn.getAttribute('aria-expanded'):null,
                      broken:[...t.querySelectorAll('.masonry:not([hidden]) .g-item img')].filter(i=>i.complete&&i.naturalWidth===0).length});
          });
          return out;}""")
        results[label+"_themes"] = themes
        names = [t["name"] for t in themes]
        chk(label, "theme order 戰國>唐代>明朝 (%s)" % " / ".join(names), names == ["戰國", "唐代", "明朝"], names)
        chk(label, "3 themes present", len(themes) == 3, len(themes))
        for t in themes:
            chk(label, "%s preview 4-6 imgs (%d)" % (t["name"], t["visible"]), 4 <= t["visible"] <= 6, t["visible"])
            chk(label, "%s MORE hidden before expand" % t["name"], t["moreHidden"] is True, t["moreHidden"])
            chk(label, "%s no broken preview img" % t["name"], t["broken"] == 0, t["broken"])
        results[label+"_morecounts"] = {t["name"]: t["moreCount"] for t in themes}
        chk(label, "MORE counts 33/41/50 (39/47/56 total)", [t["moreCount"] for t in themes] == [33, 41, 50], [t["moreCount"] for t in themes])

        # expand first & third theme
        for idx in [0, 2]:
            btn = page.locator("#galleryThemes .gtheme").nth(idx).locator(".gtheme__toggle")
            nm = themes[idx]["name"]
            btn.scroll_into_view_if_needed(); page.wait_for_timeout(350); btn.click(); page.wait_for_timeout(1600)
            st = page.evaluate("""(i) => {
              const t=document.querySelectorAll('#galleryThemes .gtheme')[i];
              const more=t.querySelector('.gtheme__more'); const btn=t.querySelector('.gtheme__toggle');
              return {hidden: more.hasAttribute('hidden'), expanded: btn.getAttribute('aria-expanded'),
                      imgs: more.querySelectorAll('.g-item img').length,
                      loaded: [...more.querySelectorAll('.g-item img')].filter(im=>im.complete&&im.naturalWidth>0).length,
                      broken: [...more.querySelectorAll('.g-item img')].filter(im=>im.complete&&im.naturalWidth===0).length,
                      label: btn.textContent.trim()};}""", idx)
            chk(label, "%s expand shows MORE (%d imgs)" % (nm, st["imgs"]), st["hidden"] is False, st)
            chk(label, "%s aria-expanded=true" % nm, st["expanded"] == "true", st["expanded"])
            chk(label, "%s expanded imgs lazy-loading (%d of %d loaded)" % (nm, st["loaded"], st["imgs"]), st["loaded"] >= 8, st)
            chk(label, "%s no broken expanded img" % nm, st["broken"] == 0, st["broken"])

        # no horizontal scroll
        hs = page.evaluate("() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth})")
        chk(label, "no horizontal scroll (%d<=%d)" % (hs["sw"], hs["cw"]), hs["sw"] <= hs["cw"] + 1, hs)
        results[label+"_hscroll"] = hs

        # gallery screenshot
        page.evaluate("""() => { const g=document.querySelector('#gallery'); if(g){window.scrollTo(0, g.getBoundingClientRect().top + window.scrollY - 10);} }""")
        page.wait_for_timeout(1800)
        page.screenshot(path="%s/gallery_%s.png" % (OUT, label), full_page=False)
        results[label+"_gallery_shot"] = "%s/gallery_%s.png" % (OUT, label)

        # ---------- RSVP regression (endpoint stubbed) ----------
        page.evaluate("""() => { const s=document.querySelector('#rsvp'); if(s){window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - 10);} }""")
        page.wait_for_timeout(800)
        page.fill("#rsvpName", "QA-v36-live")
        page.fill("#rsvpEmail", "qa.v36.live@example.com")
        page.check('input[name="side"][value="女方"]')
        page.wait_for_timeout(200)
        page.locator("#rsvpSubmit").click()
        page.wait_for_timeout(2600)
        st = page.evaluate("""() => {
          const th=document.querySelector('#rsvpThanks');
          const name=document.querySelector('#rsvpName');
          const num=(n)=>{const e=document.querySelector('[name="'+n+'"]');return e?e.value:null};
          return {thanksShown: th? !th.hasAttribute('hidden') : null,
                  thanksText: th? (th.textContent||'').replace(/\\s+/g,' ').trim().slice(0,60):null,
                  nameVal: name? name.value : null,
                  adults:num('adults'), children:num('children'), chairs:num('chairs'),
                  url: location.href};}""")
        results[label+"_rsvp"] = st
        chk(label, "RSVP: no new tab opened (%d)" % len(newpages), len(newpages) == 0, newpages)
        chk(label, "RSVP: URL unchanged (no redirect)", st["url"].startswith(URL), st["url"])
        chk(label, "RSVP: 感謝您的回覆 shown", st["thanksShown"] is True, st)
        chk(label, "RSVP: 感謝 text says 感謝您的回覆", "感謝您的回覆" in (st["thanksText"] or ""), st["thanksText"])
        chk(label, "RSVP: form cleared (name empty)", st["nameVal"] == "", st["nameVal"])
        chk(label, "RSVP: numbers reset 1/0/0", [st["adults"], st["children"], st["chairs"]] == ["1", "0", "0"], [st["adults"], st["children"], st["chairs"]])
        chk(label, "RSVP: POST attempted to sheet endpoint (%d)" % len(posts), len(posts) == 1, posts)
        chk(label, "RSVP: ZERO email requests (%d)" % len(email_reqs), len(email_reqs) == 0, email_reqs)

        # 不克出席
        page.reload(wait_until="load"); page.wait_for_timeout(3000)
        page.evaluate("document.querySelectorAll('.loader').forEach(function(e){e.classList.add('done')})")
        page.evaluate("""() => { const s=document.querySelector('#rsvp'); if(s){window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - 10);} }""")
        page.wait_for_timeout(600)
        page.check('input[name="attend"][value="不克出席"]')
        page.wait_for_timeout(700)
        dec = page.evaluate("""() => {
          const q=(s)=>document.querySelector(s);
          const hid=(sel)=>{const e=q(sel); if(!e) return null; return e.hasAttribute('hidden') || e.offsetParent===null;};
          const dis=(n)=>{const e=q('[name="'+n+'"]'); return e? e.disabled : null};
          return {numsHidden: hid('#rsvpNumWrap'),
                  adultsDis: dis('adults'), childrenDis: dis('children'), chairsDis: dis('chairs'),
                  chairsRowHidden: hid('#rsvpChairRow')};}""")
        results[label+"_decline"] = dec
        chk(label, "decline: 人數欄位 disabled", dec["adultsDis"] is True and dec["childrenDis"] is True and dec["chairsDis"] is True, dec)
        chk(label, "decline: 人數區塊 hidden or 兒童椅列 hidden", dec["numsHidden"] is True or dec["chairsRowHidden"] is True, dec)

        chk(label, "console errors = 0", len(console) == 0, console[:3])
        chk(label, "pageerrors = 0", len(perr) == 0, perr[:3])
        results[label+"_console"] = {"console": console, "pageerror": perr, "email_reqs": email_reqs, "posts": len(posts), "popups": newpages}

        page.evaluate("window.scrollTo(0,0)"); page.wait_for_timeout(800)
        page.evaluate("document.querySelectorAll('.loader').forEach(function(e){e.classList.add('done')})")
        page.wait_for_timeout(400)
        page.screenshot(path="%s/rsvp_%s.png" % (OUT, label), full_page=False)
        ctx.close()
    b.close()

json.dump(results, open("%s/live_results.json" % OUT, "w"), ensure_ascii=False, indent=1)
print("\n==== %d/%d PASSED ====" % (len(passes), len(passes) + len(fails)))
for t, n, e in fails: print("  FAIL [%s] %s :: %s" % (t, n, e))
sys.exit(0 if not fails else 1)
