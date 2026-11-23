#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v104b: restore 1080p on desktop, with an automatic downgrade if it stalls.

Why: v103 gated the desktop source on `navigator.connection.downlink >= 12`.
Chrome caps `downlink` at 10 (spec: max 10 Mbps granularity), so that test is
NEVER true and every desktop visitor silently got the 720p file - a quality
regression against the "keep the high quality" requirement.

Measured on the live site with real Chrome (1440x900):
  1080p @20 Mbps -> first frame 1406 ms, 0.7% dropped frames, 0 stalled
  1080p @10 Mbps -> never reached readyState 3 (cannot keep up)

So: desktop starts on 1080p (quality preserved), and if playback genuinely
stalls for 2.5 s the player switches to 720p at the same position - the same
"start high, step down only when needed" behaviour YouTube uses. Mobile is
untouched (it already gets 720p and the user reports it is fine).

Every edit asserts its match count so a drifted file fails loudly.
"""

import io
import sys

FAILED = []

OLD_SRC = 'var fast=!save&&(et==="4g"||et==="wifi"||et==="")&&(dl===null||dl>=12);\nvar src=isMobile?(urlM||url):((fast&&url)?url:(urlM||url));'

NEW_SRC = (
    '/*v104b:desktop-1080p-with-auto-downgrade*/\n'
    'var src=isMobile?(urlM||url):(save?(urlM||url):(url||urlM));'
)

DOWNGRADE = r'''var downgraded=false;
function downgrade(){
if(downgraded||!urlM||src===urlM)return;
downgraded=true;
var t=v.currentTime,wasPlaying=!v.paused;
src=urlM;v.setAttribute("src",urlM);
try{v.load()}catch(e){}
function seek(){v.removeEventListener("loadedmetadata",seek);try{v.currentTime=t}catch(e){}if(wasPlaying){var p=v.play();p&&p.catch&&p.catch(function(){})}}
v.addEventListener("loadedmetadata",seek);
}
function armDowngrade(){
if(isMobile||src===urlM)return;
var stallT=null;
v.addEventListener("waiting",function(){
if(downgraded||stallT)return;
stallT=window.setTimeout(function(){stallT=null;if(!downgraded&&v.readyState<3)downgrade()},2500);
});
v.addEventListener("playing",function(){if(stallT){clearTimeout(stallT);stallT=null}});
v.addEventListener("timeupdate",function(){if(stallT&&v.readyState>=3){clearTimeout(stallT);stallT=null}});
}
'''

ANCHOR = 'function start(){\nif(loaded)return;loaded=true;'
ANCHOR_NEW = DOWNGRADE + ANCHOR

PLAYNOW = 'spinTimer=window.setTimeout(function(){if(fr&&v.readyState<3)fr.classList.add("is-loading")},450);\nplayNow();\n}'
PLAYNOW_NEW = 'spinTimer=window.setTimeout(function(){if(fr&&v.readyState<3)fr.classList.add("is-loading")},450);\nplayNow();\narmDowngrade();\n}'


def main():
    p = "js/app.js"
    with io.open(p, encoding="utf-8") as fh:
        s = fh.read()

    if "v104b:desktop-1080p-with-auto-downgrade" in s:
        print("SKIP app.js already patched to v104b")
    else:
        n = s.count(OLD_SRC)
        if n != 1:
            FAILED.append("app.js: expected 1 occurrence of the v103 downlink gate, found %d" % n)
        else:
            s = s.replace(OLD_SRC, NEW_SRC)
            print("OK   src selection -> desktop 1080p (saveData -> 720p)")

        n = s.count(ANCHOR)
        if n != 1:
            FAILED.append("app.js: expected 1 occurrence of start() anchor, found %d" % n)
        else:
            s = s.replace(ANCHOR, ANCHOR_NEW)
            print("OK   downgrade watchdog inserted")

        n = s.count(PLAYNOW)
        if n != 1:
            FAILED.append("app.js: expected 1 occurrence of playNow() tail, found %d" % n)
        else:
            s = s.replace(PLAYNOW, PLAYNOW_NEW)
            print("OK   armDowngrade() wired into start()")

    if not FAILED:
        with io.open(p, "w", encoding="utf-8") as fh:
            fh.write(s)

    if FAILED:
        sys.stderr.write("\n".join("FAIL " + m for m in FAILED) + "\n")
        return 1
    print("v104b patch applied cleanly")
    return 0


if __name__ == "__main__":
    sys.exit(main())
