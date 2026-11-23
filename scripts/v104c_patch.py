#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v104c: make the desktop downgrade adaptive, the way YouTube does it.

v104b restored 1080p on desktop and stepped down to 720p only when playback
stalled (readyState < 3 for 2.5 s). That covers buffering, but not judder: a
machine that keeps up with the download yet cannot present every frame shows
dropped frames, not stalls, so it would never step down.

Measured on the live site with real Chrome (1440x900, 20 Mbps, full page):
  1080p -> 166 / 986 dropped frames (16.8%)
  720p  ->  68 / 986 dropped frames ( 6.9%)

v104c adds a second trigger: while playing, sample getVideoPlaybackQuality()
every 2 s; if more than 15% of the frames in a window of >=30 frames were
dropped, step down to 720p at the same position. The first window is skipped
so decoder warm-up cannot cause a false positive.

Net behaviour: desktop starts at 1080p (quality preserved), and drops to 720p
only if the machine actually cannot play it smoothly. Mobile is untouched.
"""

import io
import sys

FAILED = []

QUALITY = r'''/*v104c:frame-drop-downgrade*/
function quality(){try{return v.getVideoPlaybackQuality?v.getVideoPlaybackQuality():(v.webkitGetVideoPlaybackQuality?v.webkitGetVideoPlaybackQuality():null)}catch(e){return null}}
var lastQ=null;
var qTimer=window.setInterval(function(){
if(downgraded){clearInterval(qTimer);return}
if(v.paused||v.ended)return;
var q=quality();if(!q){clearInterval(qTimer);return}
if(!lastQ){lastQ=q;return}
var dt=q.totalVideoFrames-lastQ.totalVideoFrames,dd=q.droppedVideoFrames-lastQ.droppedVideoFrames;
lastQ=q;
if(dt<30)return;
if(dd/dt>0.15){clearInterval(qTimer);downgrade()}
},2000);
v.addEventListener("ended",function(){clearInterval(qTimer)});
'''

ANCHOR = 'v.addEventListener("timeupdate",function(){if(stallT&&v.readyState>=3){clearTimeout(stallT);stallT=null}});\n}'
NEW = ('v.addEventListener("timeupdate",function(){if(stallT&&v.readyState>=3){clearTimeout(stallT);stallT=null}});\n'
       + QUALITY + '}')


def main():
    p = "js/app.js"
    with io.open(p, encoding="utf-8") as fh:
        s = fh.read()

    if "v104c:frame-drop-downgrade" in s:
        print("SKIP app.js already patched to v104c")
    else:
        n = s.count(ANCHOR)
        if n != 1:
            FAILED.append("app.js: expected 1 occurrence of the armDowngrade tail, found %d" % n)
        else:
            s = s.replace(ANCHOR, NEW)
            print("OK   frame-drop watchdog added to armDowngrade()")

    if not FAILED:
        with io.open(p, "w", encoding="utf-8") as fh:
            fh.write(s)

    if FAILED:
        sys.stderr.write("\n".join("FAIL " + m for m in FAILED) + "\n")
        return 1
    print("v104c patch applied cleanly")
    return 0


if __name__ == "__main__":
    sys.exit(main())
