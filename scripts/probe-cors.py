#!/usr/bin/env python3
"""Quick CORS probe: can a real browser read the Apps Script /exec responses?"""
import json
from playwright.sync_api import sync_playwright

EXEC = "https://script.google.com/macros/s/AKfycbwMfQ2N-fNLdvUdsdiXT-1y5vMUWUyBhUMtMmR3cQjscGHA3WkKoabYCVvkazPdiMfW/exec"
SITE = "https://jack25860.github.io/jack-and-lily-wedding/"

with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_context().new_page()
    pg.goto(SITE, wait_until="domcontentloaded", timeout=90000)

    print("=== GET /exec (plain) ===")
    print(pg.evaluate("""async (u) => {
        try { const r = await fetch(u, {cache:'no-store'}); return {ok:true, status:r.status, text:(await r.text()).slice(0,120)}; }
        catch(e) { return {ok:false, err:String(e)}; }
    }""", EXEC))

    print("=== GET /exec?diag=1 ===")
    print(pg.evaluate("""async (u) => {
        try { const r = await fetch(u + '?diag=1', {cache:'no-store'}); return {ok:true, status:r.status, json: await r.json()}; }
        catch(e) { return {ok:false, err:String(e)}; }
    }""", EXEC))

    print("=== POST /exec (ecard) ===")
    print(pg.evaluate("""async (u) => {
        try {
          const r = await fetch(u, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
            body: JSON.stringify({type:'ecard', to:'jack25860@gmail.com', subject:'t'})});
          return {ok:true, status:r.status, text:(await r.text()).slice(0,200)};
        } catch(e) { return {ok:false, err:String(e)}; }
    }""", EXEC))

    b.close()
