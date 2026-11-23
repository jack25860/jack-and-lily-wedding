#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v104: replace initTrailer() so playback starts the moment the browser can
decode a frame, instead of waiting for readyState>=3 AND 2 s of forward buffer.

Measured on v103 (real Chrome, 20 Mbps desktop / 10 Mbps mobile):
  desktop  first frame 400 ms   (prefetch had already buffered the file)
  mobile   first frame 5399 ms  (canplay at 1899 ms, then the 2 s buffer gate
                                 held play() back another 3.4 s)

The gate is the whole wait. YouTube starts as soon as it has a decodable
frame and keeps downloading in the background; this does the same.

Every edit asserts its match count so a drifted file fails loudly.
"""

import io
import sys

FAILED = []

VERSION_OLD = '<meta name="site-version" content="v103">'
VERSION_NEW = '<meta name="site-version" content="v104">'

NEW_FN = r'''function initTrailer(){
var v=$("#trailerVideo"),ph=$("#trailerPlaceholder"),btn=$("#trailerPlay"),fr=$("#trailerFrame");
if(!v)return;
var url=String(CFG.TRAILER_VIDEO_URL||"").trim(),urlM=String(CFG.TRAILER_VIDEO_URL_MOBILE||"").trim(),poster=String(CFG.TRAILER_VIDEO_POSTER||"").trim(),posterM=String(CFG.TRAILER_VIDEO_POSTER_MOBILE||"").trim();
var isMobile=!!(window.matchMedia&&window.matchMedia("(max-width:640px)").matches);
var pos=(isMobile&&posterM)?posterM:poster;
var nc=navigator.connection||navigator.mozConnection||navigator.webkitConnection||{};
var dl=typeof nc.downlink==="number"?nc.downlink:null;
var et=String(nc.effectiveType||""),save=nc.saveData===true;
var fast=!save&&(et==="4g"||et==="wifi"||et==="")&&(dl===null||dl>=12);
var src=isMobile?(urlM||url):((fast&&url)?url:(urlM||url));
if(pos)v.setAttribute("poster",pos);
if(!src){if(ph)ph.style.display="";v.style.display="none";return}
v.style.display="";
var bgm=$("#bgm"),bgmWas=false,bgmArmed=false;
function bgmPause(){if(bgmArmed)return;bgmArmed=true;bgmWas=bgm?(!bgm.paused&&!bgm.ended):false;if(bgm){bgmSuppressed=true;try{bgm.pause()}catch(e){}}}
function bgmResume(){if(!bgmArmed)return;bgmArmed=false;bgmSuppressed=false;if(!bgm||!bgmWas)return;bgmWas=false;try{var p=bgm.play();p&&p.catch&&p.catch(function(){})}catch(e){}}
v.addEventListener("play",bgmPause);
v.addEventListener("ended",bgmResume);
var rootEl=document.documentElement;
function reliefOn(){rootEl.classList.add("trailer-active")}
function reliefOff(){rootEl.classList.remove("trailer-active")}
v.addEventListener("playing",reliefOn);
v.addEventListener("pause",reliefOff);
v.addEventListener("ended",reliefOff);
v.addEventListener("error",reliefOff);
var loaded=false,prefetched=false,spinTimer=null,waitTimer=null;
function clearLoad(){if(fr)fr.classList.remove("is-loading");if(spinTimer){clearTimeout(spinTimer);spinTimer=null}}
function prefetch(){if(prefetched||loaded)return;prefetched=true;v.setAttribute("preload","auto");v.setAttribute("src",src);try{v.load()}catch(e){}}
if(window.IntersectionObserver&&fr){var io=new IntersectionObserver(function(es){for(var i=0;i<es.length;i++){if(es[i].isIntersecting){prefetch();io.disconnect();break}}},{rootMargin:"900px 0px"});io.observe(fr)}else{window.setTimeout(prefetch,2000)}
function playNow(){var p=null;try{p=v.play()}catch(e){}if(p&&p.catch)p.catch(function(){if(v.error)return;try{v.muted=true;var q=v.play();q&&q.catch&&q.catch(function(){})}catch(e){}})}
function start(){
if(loaded)return;loaded=true;
if(!prefetched){v.setAttribute("preload","auto");v.setAttribute("src",src);try{v.load()}catch(e){}}
try{v.muted=false;v.defaultMuted=false;v.removeAttribute("muted");v.volume=1}catch(e){}
if(v.ended){try{v.currentTime=0}catch(e){}}
if(ph){ph.style.transition="opacity .6s var(--ease)";ph.style.opacity="0";window.setTimeout(function(){ph.style.display="none"},620)}
v.style.transition="opacity .6s var(--ease)";v.style.opacity="1";
spinTimer=window.setTimeout(function(){if(fr&&v.readyState<3)fr.classList.add("is-loading")},450);
playNow();
}
if(btn)btn.addEventListener("click",function(e){e.preventDefault();start()});
if(ph)ph.addEventListener("click",start);
v.addEventListener("click",function(){if(v.paused){if(v.ended){try{v.currentTime=0}catch(e){}}v.play()}else v.pause()});
v.addEventListener("playing",clearLoad);
v.addEventListener("canplay",clearLoad);
v.addEventListener("loadeddata",clearLoad);
v.addEventListener("error",clearLoad);
v.addEventListener("waiting",function(){if(waitTimer)return;waitTimer=window.setTimeout(function(){waitTimer=null;if(fr&&v.readyState<3)fr.classList.add("is-loading")},700)});
v.addEventListener("timeupdate",function(){if(waitTimer){clearTimeout(waitTimer);waitTimer=null}clearLoad()});
}'''


def find_fn(s, name):
    """Return (start, end) of `function <name>(` ... matching closing brace."""
    key = "function " + name + "("
    i = s.find(key)
    if i < 0:
        return None
    j = s.find("{", i)
    if j < 0:
        return None
    depth = 0
    k = j
    in_str = None
    while k < len(s):
        c = s[k]
        if in_str:
            if c == "\\":
                k += 2
                continue
            if c == in_str:
                in_str = None
        else:
            if c in "\"'":
                in_str = c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return (i, k + 1)
        k += 1
    return None


def main():
    # ---------- app.js ----------
    p = "js/app.js"
    with io.open(p, encoding="utf-8") as fh:
        s = fh.read()

    if "v104:start-as-soon-as-decodable" in s:
        print("SKIP app.js already patched")
    else:
        rng = find_fn(s, "initTrailer")
        if not rng:
            FAILED.append("app.js: initTrailer() not found")
        else:
            a, b = rng
            old = s[a:b]
            if "readyState>=3&&ahead()>=2" not in old:
                FAILED.append("app.js: initTrailer() does not contain the v103 buffer gate - refusing to patch a drifted file")
            else:
                s = s[:a] + "/*v104:start-as-soon-as-decodable*/" + NEW_FN + s[b:]
                print("OK   app.js initTrailer() replaced (%d -> %d bytes)" % (len(old), len(NEW_FN)))

    if not FAILED:
        with io.open(p, "w", encoding="utf-8") as fh:
            fh.write(s)

    # ---------- index.html ----------
    p2 = "index.html"
    with io.open(p2, encoding="utf-8") as fh:
        h = fh.read()

    n = h.count(VERSION_OLD)
    if n != 1:
        FAILED.append("index.html: site-version expected 1 occurrence of %r, found %d" % (VERSION_OLD, n))
    else:
        h = h.replace(VERSION_OLD, VERSION_NEW)
        print("OK   site-version -> v104")

    if not FAILED:
        with io.open(p2, "w", encoding="utf-8") as fh:
            fh.write(h)

    if FAILED:
        sys.stderr.write("\n".join("FAIL " + m for m in FAILED) + "\n")
        return 1
    print("v104 patch applied cleanly")
    return 0


if __name__ == "__main__":
    sys.exit(main())
