#!/usr/bin/env python3
"""v108: the guest-message board must fail loudly instead of silently.

Measured on the live site (2026-11-23):
  * GET <endpoint>?diag=1 -> {"version":"v49"} -- the v50 deploy never took
    effect, so the live endpoint has no `saveMessage` branch.
  * POST {type:"saveMessage"} to that v49 endpoint is NOT rejected: v49 falls
    through to its RSVP branch and appends the message as a bogus guest row in
    A:L (verified: row 3 became "__DIAG_TEST__"). The version gate must stay --
    it is what prevents that corruption.
  * v107 gated the write on diag >= v50, so it correctly refused to POST, but
    then told the guest "\u7559\u8a00\u5df2\u5148\u5b58\u5728\u6b64\u88dd\u7f6e\uff0c\u7a0d\u5f8c\u6703\u81ea\u52d5\u540c\u6b65\u3002" which reads as
    success. The message never reached the shared sheet, so no other device
    could ever see it. That is the reported bug ("\u96fb\u8166\u7559\u8a00\u5f8c\uff0c\u624b\u6a5f\u770b\u4e0d\u5230").

v108 keeps the gate and makes the failure visible:
  1. MSG_EP_STATE {checked,ok,version} replaces the one-shot MSG_EP_OK, so a
     failed probe is retried on the next submit instead of cached forever.
  2. Endpoint not ready -> "\u7559\u8a00\u5df2\u986f\u793a\u5728\u6b64\u88dd\u7f6e\uff1b\u7559\u8a00\u677f\u540c\u6b65\u5c1a\u672a\u555f\u7528\uff0c\u5176\u4ed6\u88dd\u7f6e
     \u66ab\u6642\u770b\u4e0d\u5230\u3002" (no more "will sync later").
  3. POST failed -> "\u7559\u8a00\u9001\u51fa\u5931\u6557\uff0c\u5df2\u5148\u5b58\u5728\u6b64\u88dd\u7f6e\uff0c\u7a0d\u5f8c\u6703\u81ea\u52d5\u91cd\u8a66\u3002"
  4. site-version -> v108.

Front-end only: no new fields, no new features. RSVP (phone / optional email),
gallery, video and the iPhone typing-stability CSS are untouched.
"""
import io
import os
import sys

ROOT = os.environ.get("PATCH_ROOT", os.getcwd())


def patch(path, pairs):
    full = os.path.join(ROOT, path)
    with io.open(full, encoding="utf-8") as f:
        text = f.read()
    for old, new in pairs:
        n = text.count(old)
        if n != 1:
            sys.stderr.write("FAIL: pattern found %d times in %s:\n  %s\n"
                             % (n, path, old[:140]))
            sys.exit(1)
        text = text.replace(old, new)
    with io.open(full, "w", encoding="utf-8") as f:
        f.write(text)
    print("patched %s" % path)


APP = [
    # 1) state object instead of a one-shot boolean
    ('var MSG_EP_OK=null;',
     'var MSG_EP_STATE={checked:false,ok:false,version:""};'),

    # 2) probe: remember the version; retry a failed check on the next submit
    ('function msgEndpointReady(){if(MSG_EP_OK!==null)return Promise.resolve(MSG_EP_OK);'
     'var url=String(CFG.SHEET_WEBAPP_URL||"").trim();'
     'if(!/^https?:\\/\\//i.test(url)){MSG_EP_OK=false;return Promise.resolve(false)}',
     'function msgEndpointReady(){var url=String(CFG.SHEET_WEBAPP_URL||"").trim();'
     'if(!/^https?:\\/\\//i.test(url)){MSG_EP_STATE={checked:true,ok:false,version:""};'
     'return Promise.resolve(false)}'
     'if(MSG_EP_STATE.checked&&MSG_EP_STATE.ok)return Promise.resolve(true);'),

    ('MSG_EP_OK=!!(n>=50);return MSG_EP_OK}).catch(function(){MSG_EP_OK=false;return false})}',
     'MSG_EP_STATE={checked:true,ok:!!(n>=50),version:v};return MSG_EP_STATE.ok})'
     '.catch(function(){MSG_EP_STATE={checked:true,ok:false,version:""};return false})}'),

    # 3) endpoint not ready -> say the truth, do not imply a later sync
    ('if(!ready){var pend=loadPending();pend.push(entry);savePending(pend);'
     'status.textContent="\u7559\u8a00\u5df2\u5148\u5b58\u5728\u6b64\u88dd\u7f6e\uff0c'
     '\u7a0d\u5f8c\u6703\u81ea\u52d5\u540c\u6b65\u3002";'
     'window.setTimeout(function(){status.textContent=""},6e3);return}',
     'if(!ready){var pend=loadPending();pend.push(entry);savePending(pend);'
     'status.textContent="\u7559\u8a00\u5df2\u986f\u793a\u5728\u6b64\u88dd\u7f6e\uff1b'
     '\u7559\u8a00\u677f\u540c\u6b65\u5c1a\u672a\u555f\u7528\uff0c'
     '\u5176\u4ed6\u88dd\u7f6e\u66ab\u6642\u770b\u4e0d\u5230\u3002";'
     'window.setTimeout(function(){status.textContent=""},9e3);return}'),

    # 4) POST failed -> say it failed
    ('else{var pend=loadPending();pend.push(entry);savePending(pend);'
     'status.textContent="\u7559\u8a00\u5df2\u5148\u5b58\u5728\u6b64\u88dd\u7f6e\uff0c'
     '\u7a0d\u5f8c\u6703\u81ea\u52d5\u540c\u6b65\u3002"}'
     'window.setTimeout(function(){status.textContent=""},6e3)',
     'else{var pend=loadPending();pend.push(entry);savePending(pend);'
     'status.textContent="\u7559\u8a00\u9001\u51fa\u5931\u6557\uff0c'
     '\u5df2\u5148\u5b58\u5728\u6b64\u88dd\u7f6e\uff0c\u7a0d\u5f8c\u6703\u81ea\u52d5'
     '\u91cd\u8a66\u3002"}'
     'window.setTimeout(function(){status.textContent=""},7e3)'),
]

HTML = [
    ('<meta name="site-version" content="v107">',
     '<meta name="site-version" content="v108">'),
]

if __name__ == "__main__":
    patch("js/app.js", APP)
    patch("index.html", HTML)
    print("v108 patch applied")
