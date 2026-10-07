/* ═══════════════════════════════════════════════════════════════════════════
   seating.js  ── 座位表頁面邏輯（v60）
   ───────────────────────────────────────────────────────────────────────────
   這個檔案「不需要」在替換座位資料時修改。
   資料一律來自 js/seating-data.js（window.SEATING_DATA）。

   功能：
     1. 依 VENUE 參數繪製「全場座位圖」：
        前方大舞台 + 中間紅毯步道 + 左右兩側桌次（目前 16 桌＝左右各 8 桌）
     2. 姓名查詢（模糊／部分比對、同名候選、查無資料三種情境）
     3. 查到時：座位變色 + 呼吸燈、顯示「姓名-幾桌」、自動捲動聚焦到該桌
     4. 右下角「Tt」字級浮動鈕（三檔 sm/md/lg，沿用主站 localStorage 記憶）
     5. 支援 prefers-reduced-motion
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var VB_W = 1200, VB_H = 620;      /* SVG 內部坐標系（與裝置無關） */      /* SVG 內部座標系（與裝置無關） */

  var DATA   = window.SEATING_DATA || {};
  var VENUE  = DATA.VENUE  || {};
  var TABLES = Array.isArray(DATA.TABLES) ? DATA.TABLES : [];
  var GUESTS = Array.isArray(DATA.GUESTS) ? DATA.GUESTS : [];
  var OPT    = DATA.OPTIONS || {};

  var tablesPerSide  = Math.max(1, parseInt(VENUE.tablesPerSide, 10) || 8);
  var seatsPerTable  = Math.max(1, parseInt(VENUE.seatsPerTable, 10) || 10);
  var aisleWidthPct  = Math.min(40, Math.max(6, parseFloat(VENUE.aisleWidthPct) || 13));
  var LABELS         = VENUE.labels || {};
  var tableSuffix    = OPT.tableSuffix || "桌";
  var notFoundText   = OPT.notFoundText || "查無此姓名，請確認輸入或洽現場招待";
  var candText       = OPT.candidatesText || "找到多位同名或相似的賓客，請選擇：";

  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ── 小工具 ───────────────────────────────────────────────────────────── */
  function $(s, sc) { return (sc || document).querySelector(s); }
  function $$(s, sc) { return Array.prototype.slice.call((sc || document).querySelectorAll(s)); }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) { for (var k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]); } }
    if (parent) parent.appendChild(n);
    return n;
  }
  function norm(s) { return String(s == null ? "" : s).replace(/\s+/g, "").toLowerCase(); }

  /* ══════════ 一、計算場地幾何 ══════════ */
  var STAGE = { x: 0, y: 14, w: 0, h: 66 };
  var AISLE = { x: 0, y: 0, w: 0, h: 0 };
  var boardY   = STAGE.y + STAGE.h + 14;          /* 座位區上緣 */
  var boardH   = VB_H - boardY - 14;              /* 座位區高度 */
  var aisleW   = VB_W * aisleWidthPct / 100;
  var aisleX   = (VB_W - aisleW) / 2;
  var sideW    = aisleX;                          /* 單側寬度 */
  var nCols    = Math.max(1, Math.ceil(tablesPerSide / 2));
  var nRows    = Math.min(2, tablesPerSide);
  var pad      = 12;
  var colW     = (sideW - pad * 2) / nCols;
  var rowH     = boardH / nRows;
  var tableR   = Math.max(20, Math.min(colW * 0.30, rowH * 0.20, 40));
  var ringR    = tableR + 11;
  var seatR    = Math.max(4.2, Math.min(6, ringR * 0.115));

  STAGE.w = VB_W * 0.5;
  STAGE.x = VB_W / 2 - STAGE.w / 2;

  AISLE.x = aisleX;
  AISLE.y = STAGE.y + STAGE.h;
  AISLE.w = aisleW;
  AISLE.h = VB_H - AISLE.y - 14;

  /* 產生每一側的座標：col 0 為最靠近紅毯的內側欄，由內往外編號 */
  function sidePositions(mirror) {
    var out = [];
    for (var c = 0; c < nCols; c++) {
      for (var r = 0; r < nRows; r++) {
        var cx = pad + colW * (c + 0.5);
        if (mirror) cx = VB_W - cx;
        out.push({ x: cx, y: boardY + rowH * (r + 0.5) });
      }
    }
    return out;
  }
  var posLeft  = sidePositions(false);
  var posRight = sidePositions(true);

  /* ══════════ 二、繪製全場座位圖 ══════════ */
  var svg, canvas, scrollBox, dimmer = null;
  var tableNodes = {};   /* no -> { gEl, ring, hitLabel, cx, cy, seats:[] , data } */

  function buildMap() {
    canvas = $("#seatMapCanvas");
    scrollBox = $("#seatMapScroll");
    if (!canvas) return;

    svg = el("svg", {
      viewBox: "0 0 " + VB_W + " " + VB_H,
      role: "img",
      "aria-label": "全場座位圖：前方舞台、中間紅毯步道、左右兩側共 " + TABLES.length + " 桌"
    });
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    /* 漸層定義 */
    var defs = el("defs", null, svg);
    var g1 = el("linearGradient", { id: "stageGrad", x1: "0", y1: "0", x2: "0", y2: "1" }, defs);
    el("stop", { offset: "0", "stop-color": "#7d1c2e" }, g1);
    el("stop", { offset: "1", "stop-color": "#4A0E19" }, g1);
    var g2 = el("linearGradient", { id: "aisleGrad", x1: "0", y1: "0", x2: "0", y2: "1" }, defs);
    el("stop", { offset: "0", "stop-color": "#8f2436" }, g2);
    el("stop", { offset: "1", "stop-color": "#5c1220" }, g2);

    /* 場地底板 */
    el("rect", { class: "venue-bg", x: 6, y: 6, width: VB_W - 12, height: VB_H - 12, rx: 14 }, svg);

    /* 左右兩側區塊 */
    var sideBlockH = AISLE.h;
    el("rect", { class: "tbl__island", x: 16, y: AISLE.y + 8, width: aisleX - 32, height: sideBlockH - 16, rx: 18 }, svg);
    el("rect", { class: "tbl__island", x: VB_W - aisleX + 16, y: AISLE.y + 8, width: aisleX - 32, height: sideBlockH - 16, rx: 18 }, svg);

    /* 舞台 */
    el("rect", { class: "stage", x: STAGE.x, y: STAGE.y, width: STAGE.w, height: STAGE.h, rx: 6 }, svg);
    var stageTx = el("text", {
      class: "stage__text", x: VB_W / 2, y: STAGE.y + STAGE.h / 2 - 2,
      "text-anchor": "middle", "dominant-baseline": "middle"
    }, svg);
    stageTx.textContent = LABELS.stage || "舞台";
    var stageEn = el("text", {
      class: "stage__en", x: VB_W / 2, y: STAGE.y + STAGE.h - 16, "text-anchor": "middle"
    }, svg);
    stageEn.textContent = "STAGE";

    /* 紅毯步道（由舞台往後延伸） */
    el("rect", { class: "aisle", x: AISLE.x, y: AISLE.y, width: AISLE.w, height: AISLE.h }, svg);
    /* 紅毯中央裝飾線 */
    el("line", {
      x1: VB_W / 2, y1: AISLE.y + 6, x2: VB_W / 2, y2: AISLE.y + AISLE.h - 6,
      stroke: "rgba(201,169,97,.45)", "stroke-width": 1, "stroke-dasharray": "8 10"
    }, svg);
    var aisleTx = el("text", {
      class: "aisle__text", x: VB_W / 2, y: AISLE.y + 34, "text-anchor": "middle",
      transform: "rotate(90 " + (VB_W / 2) + " " + (AISLE.y + 34) + ")"
    }, svg);
    aisleTx.textContent = LABELS.aisle || "紅毯步道";

    /* 左右側標示 */
    var lft = el("text", { class: "side-label", x: aisleX / 2, y: AISLE.y + 22, "text-anchor": "middle" }, svg);
    lft.textContent = LABELS.leftSide || "左側";
    var rgt = el("text", { class: "side-label", x: VB_W - aisleX / 2, y: AISLE.y + 22, "text-anchor": "middle" }, svg);
    rgt.textContent = LABELS.rightSide || "右側";

    /* 桌次 */
    TABLES.forEach(function (t, i) {
      var side = (t.side === "right" || t.side === "left")
        ? t.side
        : (i < tablesPerSide ? "left" : "right");
      var list = side === "left" ? posLeft : posRight;
      var idx = side === "left" ? i : i - tablesPerSide;
      if (!list[idx]) idx = idx % list.length;
      var p = list[idx];
      buildTable(t, p.x, p.y, side);
    });

    canvas.appendChild(svg);

    /* 圖例 / 資料來源註記（SVG 內） */
    var srcTx = el("text", { class: "venue-caption", x: 24, y: VB_H - 14 }, svg);
    srcTx.textContent = "SEATING CHART · JACK & LILY";

    bindZoom();
  }

  function buildTable(t, cx, cy, side) {
    var g = el("g", { class: "tbl", "data-table": String(t.no), "data-side": side }, svg);
    var seats = Math.max(1, parseInt(t.seats, 10) || seatsPerTable);

    /* 座位點 */
    var seatNodes = [];
    var step = 360 / seats;
    for (var s = 0; s < seats; s++) {
      var a = (-90 + s * step) * Math.PI / 180;
      var sx = cx + Math.cos(a) * ringR;
      var sy = cy + Math.sin(a) * ringR;
      var sc = el("circle", { class: "tbl-seat", cx: sx.toFixed(2), cy: sy.toFixed(2), r: seatR, "data-seat": s + 1 }, g);
      var owner = guestAt(t.no, s + 1);
      if (owner) { var ti = el("title", null, sc); ti.textContent = owner.name + " · " + (s + 1) + "號"; }
      seatNodes.push(sc);
    }

    el("circle", { class: "tbl__ring", cx: cx, cy: cy, r: tableR }, g);
    var num = el("text", { class: "tbl__num", x: cx, y: cy + tableR * 0.20, "text-anchor": "middle" }, g);
    num.textContent = String(t.no);
    if (t.name) {
      var nm = el("text", { class: "tbl__name", x: cx, y: cy + tableR * 0.66, "text-anchor": "middle" }, g);
      nm.textContent = t.name;
    }

    /* 命中標籤（預設隱藏，查到時顯示「姓名-幾桌」） */
    var lg = el("g", { class: "tbl-hitlabel" }, g);
    var bg = el("rect", { class: "tbl__hitlabel-bg", rx: 6, height: 26 }, lg);
    var lt = el("text", { class: "tbl__hitlabel", "text-anchor": "middle", y: 18 }, lg);

    tableNodes[t.no] = {
      gEl: g, ring: g.querySelector(".tbl__ring"), hitLabel: lg, hitLabelBg: bg, hitLabelText: lt,
      cx: cx, cy: cy, seats: seatNodes, data: t
    };
  }

  function guestAt(tableNo, seatNo) {
    for (var i = 0; i < GUESTS.length; i++) {
      if (Number(GUESTS[i].table) === Number(tableNo) && Number(GUESTS[i].seat) === Number(seatNo)) return GUESTS[i];
    }
    return null;
  }

  /* ══════════ 三、查詢 ══════════ */
  function findMatches(q) {
    var nq = norm(q);
    if (!nq) return [];
    var hits = [];
    for (var i = 0; i < GUESTS.length; i++) {
      var g = GUESTS[i];
      var n = norm(g.name);
      if (!n) continue;
      var score = -1;
      if (n === nq) score = 3;
      else if (n.indexOf(nq) === 0) score = 2;
      else if (n.indexOf(nq) >= 0) score = 1;
      else if (nq.indexOf(n) >= 0) score = 0;   /* 使用者輸入較長時（例如「王小明先生」） */
      if (score >= 0) hits.push({ guest: g, score: score });
    }
    hits.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return Number(a.guest.table) - Number(b.guest.table) || Number(a.guest.seat) - Number(b.guest.seat);
    });
    return hits.map(function (h) { return h.guest; });
  }

  function clearHit() {
    Object.keys(tableNodes).forEach(function (no) {
      var tn = tableNodes[no];
      tn.gEl.classList.remove("is-hit");
      tn.hitLabel.classList.remove("is-on");
      tn.seats.forEach(function (s) { s.classList.remove("seat-hit"); });
    });
    if (svg) svg.classList.remove("venue-dim");
  }

  function showHit(g, opts) {
    opts = opts || {};
    clearHit();
    var tn = tableNodes[g.table];
    var label = String(g.name) + "-" + g.table + tableSuffix;

    if (tn) {
      tn.gEl.classList.add("is-hit");
      var sc = tn.seats[Number(g.seat) - 1];
      if (sc) sc.classList.add("seat-hit");
      /* 標籤文字與寬度 */
      tn.hitLabelText.textContent = label;
      var w = labelWidth(label);
      tn.hitLabelBg.setAttribute("width", w);
      tn.hitLabelBg.setAttribute("x", tn.cx - w / 2);
      tn.hitLabelText.setAttribute("x", tn.cx);
      var ty = tn.cy - ringR - 34;
      if (ty < 8) ty = tn.cy + ringR + 12;
      tn.hitLabelBg.setAttribute("y", ty);
      tn.hitLabelText.setAttribute("y", ty + 18);
      tn.hitLabel.classList.add("is-on");
      if (svg) svg.classList.add("venue-dim");
      if (opts.focus !== false) focusTable(tn);
    }
    return { label: label, tableNo: g.table, seat: g.seat, found: !!tn };
  }

  function labelWidth(text) {
    var w = 0;
    for (var i = 0; i < text.length; i++) {
      w += text.charCodeAt(i) > 0x2E80 ? 13.6 : 7.4;
    }
    return Math.max(56, w + 24);
  }

  /* ══════════ 四、聚焦 / 縮放 ══════════ */
  var zoom = 1, ZOOM_MIN = 1, ZOOM_MAX = 2.6;

  /* 以「改變畫布寬度」實現縮放（而非 transform），
     這樣溢出的部分才能真的用捲動／手指拖曳看到，且不會被裁切。 */
  function baseWidth() {
    if (!scrollBox) return 700;
    var cs = window.getComputedStyle(scrollBox);
    var pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
    var w = scrollBox.clientWidth - pl - pr;
    return Math.max(w || 0, 700);
  }

  function applyZoom() {
    if (!canvas) return;
    canvas.style.width = Math.round(baseWidth() * zoom) + "px";
    var zv = $("#seatZoomVal");
    if (zv) zv.textContent = Math.round(zoom * 100) + "%";
  }

  function centerOn(tn) {
    if (!scrollBox || !tn) return;
    var tr = tn.gEl.getBoundingClientRect();
    var sr = scrollBox.getBoundingClientRect();
    var l = scrollBox.scrollLeft + (tr.left + tr.width / 2) - (sr.left + scrollBox.clientWidth / 2);
    var t = scrollBox.scrollTop + (tr.top + tr.height / 2) - (sr.top + scrollBox.clientHeight / 2);
    if (scrollBox.scrollTo) {
      scrollBox.scrollTo({ left: Math.max(0, l), top: Math.max(0, t), behavior: reduceMotion ? "auto" : "smooth" });
    } else {
      scrollBox.scrollLeft = Math.max(0, l); scrollBox.scrollTop = Math.max(0, t);
    }
  }

  function focusTable(tn) {
    if (!tn) return;
    var target = window.innerWidth <= 640 ? 1.75 : 1.5;
    zoom = Math.max(zoom, target);
    if (zoom > ZOOM_MAX) zoom = ZOOM_MAX;
    applyZoom();
    var raf = window.requestAnimationFrame || function (f) { return window.setTimeout(f, 16); };
    raf(function () {
      window.setTimeout(function () { centerOn(tn); }, reduceMotion ? 0 : 420);
    });
  }

  function centerHit() {
    var k = Object.keys(tableNodes).filter(function (n) { return tableNodes[n].gEl.classList.contains("is-hit"); })[0];
    if (!k) return;
    var raf = window.requestAnimationFrame || function (f) { return window.setTimeout(f, 16); };
    raf(function () { window.setTimeout(function () { centerOn(tableNodes[k]); }, reduceMotion ? 0 : 420); });
  }

  function bindZoom() {
    var zin = $("#seatZoomIn"), zout = $("#seatZoomOut"), zrst = $("#seatZoomReset");
    if (zin) zin.addEventListener("click", function () { zoom = Math.min(ZOOM_MAX, zoom + 0.25); applyZoom(); centerHit(); });
    if (zout) zout.addEventListener("click", function () { zoom = Math.max(ZOOM_MIN, zoom - 0.25); applyZoom(); centerHit(); });
    if (zrst) zrst.addEventListener("click", function () {
      zoom = 1; applyZoom();
      if (scrollBox && scrollBox.scrollTo) scrollBox.scrollTo({ left: 0, top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
    applyZoom();
    window.addEventListener("resize", function () {
      var w = baseWidth();
      if (w !== lastBase) { lastBase = w; applyZoom(); }
    }, { passive: true });
  }

  var lastBase = 0;

  /* ══════════ 五、搜尋 UI ══════════ */
  var resultBox, inputEl;

  function renderNotFound(q) {
    clearHit();
    zoom = 1; applyZoom();
    resultBox.className = "seat-result seat-result--miss";
    resultBox.innerHTML =
      '<p class="seat-result__text">' + esc(notFoundText) + "</p>" +
      '<p class="seat-result__pos">查詢：' + esc(q) + "</p>";
  }

  function renderCandidates(list, q) {
    clearHit();
    zoom = 1; applyZoom();
    var html = '<p class="seat-result__text">' + esc(candText) + "</p>" +
      '<div class="seat-result__cands"><p class="seat-result__cands-title">「' + esc(q) + '」共 ' + list.length + " 筆</p>" +
      '<div class="seat-result__cands-list">';
    list.forEach(function (g, i) {
      html += '<button type="button" class="seat-cand" data-cand="' + i + '">' +
        esc(g.name) + " <i>" + g.table + tableSuffix + (OPT.showSeatLabel !== false && g.seat ? " · 第" + g.seat + "位" : "") + "</i></button>";
    });
    html += "</div></div>";
    resultBox.className = "seat-result";
    resultBox.innerHTML = html;
    $$(".seat-cand", resultBox).forEach(function (b) {
      b.addEventListener("click", function () {
        var g = list[parseInt(b.getAttribute("data-cand"), 10)];
        if (g) renderFound(g, q);
      });
    });
  }

  function renderFound(g, q) {
    var r = showHit(g);
    var posTxt = r.tableNo + tableSuffix + (OPT.showSeatLabel !== false && g.seat ? " · 第 " + g.seat + " 位" : "");
    resultBox.className = "seat-result";
    resultBox.innerHTML =
      '<p class="seat-result__text">' + esc(g.name + "-" + r.tableNo + tableSuffix) + "</p>" +
      '<p class="seat-result__pos">' + esc(posTxt) +
      (g.note ? "　·　" + esc(g.note) : "") + "</p>" +
      (r.found ? "" : '<p class="seat-result__note">（此桌次不在目前座位圖中，請洽現場招待）</p>');
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function doSearch() {
    var q = (inputEl.value || "").trim();
    if (!q) {
      clearHit();
      resultBox.className = "seat-result";
      resultBox.innerHTML = "";
      zoom = 1; applyZoom();
      inputEl.focus();
      return { state: "empty" };
    }
    var list = findMatches(q);
    if (!list.length) { renderNotFound(q); return { state: "notfound", q: q }; }
    if (list.length === 1) { renderFound(list[0], q); return { state: "found", guest: list[0] }; }
    renderCandidates(list, q);
    return { state: "candidates", count: list.length, guests: list };
  }

  function initSearch() {
    resultBox = $("#seatResult");
    inputEl = $("#seatInput");
    if (!resultBox || !inputEl) return;
    var form = $("#seatForm");
    if (form) form.addEventListener("submit", function (e) { e.preventDefault(); doSearch(); });
    var btn = $("#seatBtn");
    if (btn) btn.addEventListener("click", function (e) { e.preventDefault(); doSearch(); });
    inputEl.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); doSearch(); } });
    inputEl.addEventListener("input", function () {
      if (!(inputEl.value || "").trim()) {
        clearHit(); resultBox.className = "seat-result"; resultBox.innerHTML = "";
        zoom = 1; applyZoom();
      }
    });
  }

  /* ══════════ 六、字級浮動鈕（Tt，三檔）══════════ */
  function initFontScale() {
    var root = document.documentElement;
    var wrap = $("#fontctl"), toggle = $("#fontctlToggle"), optsBox = $("#fontctlOpts");
    var opts = $$(".fontctl__opt", wrap || document);
    if (!wrap || !toggle || !opts.length) return;
    var KEY = "ssss-wedding-font-scale", LEVELS = ["sm", "md", "lg"], DEFAULT = "md";
    if (optsBox) optsBox.hidden = false;

    function position() {
      var m = $("#music");
      if (!m || m.offsetParent === null || !m.getBoundingClientRect().height) { wrap.style.bottom = ""; return; }
      var r = m.getBoundingClientRect();
      wrap.style.bottom = Math.max(0, window.innerHeight - r.top + 10) + "px";
    }
    function isOpen() { return wrap.getAttribute("data-open") === "true"; }
    function setOpen(open) {
      wrap.classList.toggle("is-opening", !!open);
      wrap.classList.toggle("is-closing", !open);
      wrap.setAttribute("data-open", open ? "true" : "false");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "字體大小調整，收合選項" : "字體大小調整，展開選項");
    }
    function closeLater() {
      if (reduceMotion) { setOpen(false); return; }
      var done = false;
      function go() { if (done) return; done = true; root.removeEventListener("transitionend", h); setOpen(false); }
      function h(e) { if (e.target === root && e.propertyName === "font-size") go(); }
      root.addEventListener("transitionend", h);
      window.setTimeout(go, 560);
    }
    function apply(level) {
      if (LEVELS.indexOf(level) < 0) level = DEFAULT;
      LEVELS.forEach(function (l) { root.classList.toggle("font-scale-" + l, l === level); });
      opts.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-fs") === level ? "true" : "false"); });
      try { window.localStorage.setItem(KEY, level); } catch (e) {}
      var raf = window.requestAnimationFrame || function (f) { return window.setTimeout(f, 16); };
      raf(position);
      closeLater();
    }
    var saved = DEFAULT;
    try { var s = window.localStorage.getItem(KEY); if (s && LEVELS.indexOf(s) >= 0) saved = s; } catch (e) {}
    apply(saved);
    setOpen(false);
    toggle.addEventListener("click", function (e) { e.stopPropagation(); setOpen(!isOpen()); });
    opts.forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); apply(b.getAttribute("data-fs")); try { toggle.focus(); } catch (err) {} });
    });
    document.addEventListener("click", function (e) { if (isOpen() && !wrap.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen()) { setOpen(false); try { toggle.focus(); } catch (err) {} } });
    window.addEventListener("resize", position, { passive: true });
    window.addEventListener("orientationchange", position);
    window.addEventListener("load", position);
    if (window.ResizeObserver) { try { new ResizeObserver(position).observe($("#music")); } catch (e) {} }
    window.setTimeout(position, 300);
    root.classList.add("font-anim");    /* 就緒後才啟用字級過渡，避免首次載入抖動 */
  }

  /* ══════════ 七、背景音樂浮動開關（簡化版）══════════ */
  function initMusic() {
    var audio = $("#bgm"), btn = $("#musicBtn"), label = $("#musicLabel");
    if (!audio || !btn) { var mm = $("#music"); if (mm) mm.style.display = "none"; return; }
    var userOff = false;
    function sync() {
      var playing = !audio.paused && !audio.ended;
      btn.classList.toggle("playing", playing);
      btn.setAttribute("aria-pressed", playing ? "true" : "false");
      btn.setAttribute("aria-label", playing ? "關閉背景音樂" : "播放背景音樂");
      if (label) label.textContent = playing ? "MUSIC ON" : "MUSIC OFF";
    }
    function ensure() {
      if (userOff) return;
      try { audio.muted = false; if (!audio.volume) audio.volume = 1; var p = audio.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
    ensure();
    ["pointerdown", "mousedown", "touchstart", "keydown"].forEach(function (t) { document.addEventListener(t, ensure, { capture: true, passive: true }); });
    ["loadedmetadata", "canplay", "playing"].forEach(function (ev) { audio.addEventListener(ev, function () { if (!userOff) ensure(); }); });
    audio.addEventListener("play", sync); audio.addEventListener("pause", sync); audio.addEventListener("ended", sync);
    btn.addEventListener("click", function () {
      if (audio.paused) { userOff = false; ensure(); } else { userOff = true; audio.pause(); }
      sync();
    });
    sync();
  }

  /* ══════════ 八、啟動 ══════════ */
  function boot() {
    buildMap();
    initSearch();
    initFontScale();
    initMusic();
    /* 供測試／除錯使用（不影響一般瀏覽） */
    window.seatingPage = {
      search: doSearch,
      clear: function () { clearHit(); if (resultBox) { resultBox.innerHTML = ""; } zoom = 1; applyZoom(); },
      focusNo: function (no) { var tn = tableNodes[Number(no)]; if (tn) { showHit({ name: "測試", table: Number(no), seat: 1 }); } return !!tn; },
      tables: Object.keys(tableNodes).map(Number),
      guests: GUESTS.length,
      find: findMatches
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
