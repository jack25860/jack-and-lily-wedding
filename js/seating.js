/* ═══════════════════════════════════════════════════════════════════════════
   seating.js  ── 座位表頁面邏輯（v62）
   ───────────────────────────────────────────────────────────────────────────
   這個檔案「不需要」在替換座位資料時修改。
   資料來源：
     • 主來源 = 問卷回覆的 Google 線上表單（經 Apps Script Web App 取得 JSON，
                設定於 js/seating-config.js 的 API_URL）
     • 備援   = js/seating-data.js（window.SEATING_DATA；API 未設定／逾時／失敗時回退）

   功能：
     1. 依 VENUE 參數繪製「全場座位圖」（v62）：
        前方大舞台 + 中間紅毯步道 + 紅毯末端（舞台正前方）12 人主桌
        + 紅毯左右兩側共 15 桌（左 8、右 7）
     2. 姓名查詢（模糊／部分比對、同名候選、查無資料三種情境）
     3. 查到時：座位變色 + 呼吸燈、顯示「姓名-幾桌」、自動捲動聚焦到該桌
     4. 右下角「Tt」字級浮動鈕（三檔 sm/md/lg，沿用主站 localStorage 記憶）
     5. 支援 prefers-reduced-motion

   v63 變更：移除「＋／－」縮放功能（#seatZoomIn / #seatZoomOut / #seatZoomVal /
     #seatZoomReset 按鈕，以及 zoom、baseWidth、applyZoom、bindZoom 等相關邏輯）。
     座位圖改為固定寬度、隨裝置自適應；查詢後仍會自動捲動聚焦，超出畫面可用滑動瀏覽。
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var VB_W = 1200, VB_H = 620;      /* SVG 內部坐標系（與裝置無關） */      /* SVG 內部座標系（與裝置無關） */

  var DATA   = window.SEATING_DATA || {};
  var CFG    = window.SEATING_CONFIG || {};
  var VENUE, TABLES, GUESTS, OPT;
  var tablesPerSide, seatsPerTable, aisleWidthPct, LABELS, tableSuffix, notFoundText, candText;
  var statusEl = null;

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
  var boardY, boardH, aisleW, aisleX, sideW, nCols, nRows, pad, colW, rowH, tableR, ringR, seatR;
  /* v62：主桌（舞台正前方、紅毯末端）幾何 */
  var mainTableNo = 0, mainTableSeats = 12, mainTableName = "主桌";
  var mainTableR = 0, mainTableRing = 0, mainTableY = 0, mainTableH = 0, mainTablePos = { x: 0, y: 0 };

  /* 依目前的 DATA 重新計算所有衍生變數與場地幾何。
     遠端名單載入後會再呼叫一次，因此不需要重新載入頁面。 */
  function deriveAll() {
    VENUE  = DATA.VENUE  || {};
    TABLES = Array.isArray(DATA.TABLES) ? DATA.TABLES : [];
    GUESTS = Array.isArray(DATA.GUESTS) ? DATA.GUESTS : [];
    OPT    = DATA.OPTIONS || {};

    tablesPerSide  = Math.max(1, parseInt(VENUE.tablesPerSide, 10) || 8);
    seatsPerTable  = Math.max(1, parseInt(VENUE.seatsPerTable, 10) || 10);
    aisleWidthPct  = Math.min(40, Math.max(6, parseFloat(VENUE.aisleWidthPct) || 13));
    LABELS         = VENUE.labels || {};
    tableSuffix    = OPT.tableSuffix || "桌";
    notFoundText   = OPT.notFoundText || "查無此姓名，請確認輸入或洽現場招待";
    candText       = OPT.candidatesText || "找到多位同名或相似的賓客，請選擇：";

    /* v62：主桌（舞台正前方、紅毯末端）。VENUE.mainTable 為 null 時不畫主桌。 */
    var mt = VENUE.mainTable;
    mainTableNo    = (mt && mt.no != null) ? parseInt(mt.no, 10) : 0;
    if (isNaN(mainTableNo)) mainTableNo = 0;
    mainTableSeats = (mt && mt.seats) ? Math.max(1, parseInt(mt.seats, 10) || 12) : 12;
    mainTableName  = (mt && mt.name) ? String(mt.name) : (LABELS.mainTable || "主桌");

    boardY   = STAGE.y + STAGE.h + 14;          /* 座位區上緣 */
    boardH   = VB_H - boardY - 14;              /* 座位區高度 */
    aisleW   = VB_W * aisleWidthPct / 100;
    aisleX   = (VB_W - aisleW) / 2;
    sideW    = aisleX;                          /* 單側寬度 */
    nCols    = Math.max(1, Math.ceil(tablesPerSide / 2));
    nRows    = Math.min(2, tablesPerSide);
    pad      = 12;
    colW     = (sideW - pad * 2) / nCols;
    rowH     = boardH / nRows;
    tableR   = Math.max(20, Math.min(colW * 0.30, rowH * 0.20, 40));
    ringR    = tableR + 11;
    seatR    = Math.max(4.2, Math.min(6, ringR * 0.115));

    STAGE.w = VB_W * 0.5;
    STAGE.x = VB_W / 2 - STAGE.w / 2;

    AISLE.x = aisleX;
    AISLE.y = STAGE.y + STAGE.h;
    AISLE.w = aisleW;
    AISLE.h = VB_H - AISLE.y - 14;

    /* v62：主桌佔用紅毯最前段（舞台正前方），側桌格位因此往下讓開主桌高度。 */
    mainTableR    = mainTableNo ? Math.max(24, Math.min(aisleW * 0.30, 40)) : 0;
    mainTableRing = mainTableR + 12;
    mainTableY    = AISLE.y + mainTableRing + 16;
    mainTableH    = mainTableNo ? (mainTableRing * 2 + 26) : 0;
    mainTablePos  = { x: VB_W / 2, y: mainTableY };

    posLeft  = sidePositions(false);
    posRight = sidePositions(true);
  }

  /* 產生每一側的座標：col 0 為最靠近紅毯的內側欄，由內往外編號 */
  function sidePositions(mirror) {
    var out = [];
    /* v62：主桌佔用的高度往下讓開，側桌格位改由主桌下方起算 */
    var top = boardY + (mainTableNo ? mainTableH : 0);
    var h   = boardH - (mainTableNo ? mainTableH : 0);
    var rh  = h / nRows;
    for (var c = 0; c < nCols; c++) {
      for (var r = 0; r < nRows; r++) {
        var cx = pad + colW * (c + 0.5);
        if (mirror) cx = VB_W - cx;
        out.push({ x: cx, y: top + rh * (r + 0.5) });
      }
    }
    return out;
  }
  var posLeft, posRight;

  /* ══════════ 二、繪製全場座位圖 ══════════ */
  var svg, canvas, scrollBox, dimmer = null;
  var tableNodes = {};   /* no -> { gEl, ring, hitLabel, cx, cy, seats:[] , data } */

  function buildMap() {
    canvas = $("#seatMapCanvas");
    scrollBox = $("#seatMapScroll");
    if (!canvas) return;

    /* v62：buildMap 必須是「可重複呼叫」的（遠端名單載入後會再畫一次）。
       原本只 append 新的 <svg>，會讓畫布疊上第二張圖、tableNodes 也殘留舊桌次，
       造成桌數倍增（16 → 32）與 is-hit 找不到節點。這裡先清空畫布與節點索引。 */
    if (svg && svg.parentNode) { svg.parentNode.removeChild(svg); }
    while (canvas.firstChild) { canvas.removeChild(canvas.firstChild); }
    tableNodes = {};

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

    /* 左右兩側區塊（v62：上緣讓開主桌高度） */
    var islandTop  = AISLE.y + 8 + (mainTableNo ? mainTableH : 0);
    var sideBlockH = AISLE.h - (mainTableNo ? mainTableH : 0);
    el("rect", { class: "tbl__island", x: 16, y: islandTop, width: aisleX - 32, height: sideBlockH - 16, rx: 18 }, svg);
    el("rect", { class: "tbl__island", x: VB_W - aisleX + 16, y: islandTop, width: aisleX - 32, height: sideBlockH - 16, rx: 18 }, svg);

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
    var aisleLabelY = AISLE.y + (mainTableNo ? mainTableH + 30 : 34);
    var aisleTx = el("text", {
      class: "aisle__text", x: VB_W / 2, y: aisleLabelY, "text-anchor": "middle",
      transform: "rotate(90 " + (VB_W / 2) + " " + aisleLabelY + ")"
    }, svg);
    aisleTx.textContent = LABELS.aisle || "紅毯步道";

    /* 左右側標示 */
    var sideLabelY = islandTop + 14;
    var lft = el("text", { class: "side-label", x: aisleX / 2, y: sideLabelY, "text-anchor": "middle" }, svg);
    lft.textContent = LABELS.leftSide || "左側";
    var rgt = el("text", { class: "side-label", x: VB_W - aisleX / 2, y: sideLabelY, "text-anchor": "middle" }, svg);
    rgt.textContent = LABELS.rightSide || "右側";

    /* 主桌（v62：舞台正前方、紅毯末端） */
    if (mainTableNo) {
      var mtRec = null;
      for (var mi = 0; mi < TABLES.length; mi++) {
        if (Number(TABLES[mi].no) === mainTableNo) { mtRec = TABLES[mi]; break; }
      }
      if (!mtRec) mtRec = { no: mainTableNo, name: mainTableName, seats: mainTableSeats, main: true };
      buildTable(mtRec, mainTablePos.x, mainTablePos.y, "main");
    }

    /* 側桌（v62：依實際側桌順序取格位，主桌不佔側桌格位） */
    var li = 0, ri = 0;
    TABLES.forEach(function (t) {
      if (Number(t.no) === mainTableNo) return;
      var side = (t.side === "right" || t.side === "left") ? t.side : (li <= ri ? "left" : "right");
      var list = side === "left" ? posLeft : posRight;
      var idx = side === "left" ? li++ : ri++;
      if (!list[idx]) idx = idx % list.length;
      var p = list[idx];
      buildTable(t, p.x, p.y, side);
    });

    canvas.appendChild(svg);

    /* 圖例 / 資料來源註記（SVG 內） */
    var srcTx = el("text", { class: "venue-caption", x: 24, y: VB_H - 14 }, svg);
    srcTx.textContent = "SEATING CHART · JACK & LILY";
  }

  function buildTable(t, cx, cy, side) {
    var isMain = (side === "main") || (Number(t.no) === mainTableNo);
    var g = el("g", { class: "tbl" + (isMain ? " tbl--main" : ""), "data-table": String(t.no), "data-side": side }, svg);
    var seats = Math.max(1, parseInt(t.seats, 10) || (isMain ? mainTableSeats : seatsPerTable));
    var tR = isMain ? mainTableR : tableR;
    var rR = isMain ? mainTableRing : ringR;
    var sR = isMain ? Math.max(4.6, Math.min(6.4, rR * 0.115)) : seatR;

    /* 座位點 */
    var seatNodes = [];
    var step = 360 / seats;
    for (var s = 0; s < seats; s++) {
      var a = (-90 + s * step) * Math.PI / 180;
      var sx = cx + Math.cos(a) * rR;
      var sy = cy + Math.sin(a) * rR;
      var sc = el("circle", { class: "tbl-seat", cx: sx.toFixed(2), cy: sy.toFixed(2), r: sR, "data-seat": s + 1 }, g);
      var owner = guestAt(t.no, s + 1);
      if (owner) { var ti = el("title", null, sc); ti.textContent = owner.name + " · " + (s + 1) + "號"; }
      seatNodes.push(sc);
    }

    el("circle", { class: "tbl__ring", cx: cx, cy: cy, r: tR }, g);
    var num = el("text", { class: "tbl__num", x: cx, y: cy + tR * 0.20, "text-anchor": "middle" }, g);
    num.textContent = String(t.no);
    if (t.name) {
      var nm = el("text", { class: "tbl__name", x: cx, y: cy + tR * 0.66, "text-anchor": "middle" }, g);
      nm.textContent = t.name;
    }

    /* 命中標籤（預設隱藏，查到時顯示「姓名-幾桌」） */
    var lg = el("g", { class: "tbl-hitlabel" }, g);
    var bg = el("rect", { class: "tbl__hitlabel-bg", rx: 6, height: 26 }, lg);
    var lt = el("text", { class: "tbl__hitlabel", "text-anchor": "middle", y: 18 }, lg);

    tableNodes[t.no] = {
      gEl: g, ring: g.querySelector(".tbl__ring"), hitLabel: lg, hitLabelBg: bg, hitLabelText: lt,
      cx: cx, cy: cy, ringR: rR, isMain: isMain, seats: seatNodes, data: t
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
      var ty = tn.cy - (tn.ringR || ringR) - 34;
      if (ty < 8) ty = tn.cy + (tn.ringR || ringR) + 12;
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

  /* ══════════ 四、聚焦 ══════════ */
  /* v63：縮放變數（zoom / ZOOM_MIN / ZOOM_MAX）與 applyZoom() 已移除。
     只保留「查詢後自動捲動聚焦」；座位圖固定寬度，隨裝置自適應。 */
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

  /* v63：bindZoom()、lastBase、zoomBound 已移除（縮放鈕不再存在）。 */

  /* ══════════ 五、搜尋 UI ══════════ */
  var resultBox, inputEl;
  var searchBound = false;

  function renderNotFound(q) {
    clearHit();
    resultBox.className = "seat-result seat-result--miss";
    resultBox.innerHTML =
      '<p class="seat-result__text">' + esc(notFoundText) + "</p>" +
      '<p class="seat-result__pos">查詢：' + esc(q) + "</p>";
  }

  function renderCandidates(list, q) {
    clearHit();
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
    if (searchBound) return;      /* v62：重繪時不重複綁定事件 */
    searchBound = true;
    var form = $("#seatForm");
    if (form) form.addEventListener("submit", function (e) { e.preventDefault(); doSearch(); });
    var btn = $("#seatBtn");
    if (btn) btn.addEventListener("click", function (e) { e.preventDefault(); doSearch(); });
    inputEl.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); doSearch(); } });
    inputEl.addEventListener("input", function () {
      if (!(inputEl.value || "").trim()) {
        clearHit(); resultBox.className = "seat-result"; resultBox.innerHTML = "";
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

  /* ══════════ 七之二、名單來源：問卷回覆（Google Apps Script）══════════
     目標：不需手動替換 js/seating-data.js，即可自動使用問卷回覆的名單。

     流程：
       1) 若 localStorage 有未過期的快取名單 → 先立即用快取繪製（秒開）。
       2) 同時向 API 取得最新名單；成功 → 重繪並更新快取。
       3) 失敗／逾時 → 維持目前名單（快取或 js/seating-data.js 備援），
          在座位圖下方以不打擾的方式提示，並依 RETRY_MS 自動重試。
     任何環節發生錯誤都不會讓頁面空白或停止運作。 */

  function setStatus(text, kind) {
    if (!statusEl || !text) return;
    statusEl.textContent = text;
    statusEl.setAttribute("data-kind", kind || "");
  }

  function fmtN(text, n) { return String(text == null ? "" : text).replace(/\{n\}/g, String(n)); }

  function readCache() {
    try {
      var raw = window.localStorage.getItem(CFG.CACHE_KEY || "ssss-seating-remote-v1");
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.ts || !o.data) return null;
      if ((Date.now() - o.ts) > (parseInt(CFG.CACHE_TTL_MS, 10) || 300000)) return null;
      return o.data;
    } catch (e) { return null; }
  }

  function writeCache(data) {
    try {
      window.localStorage.setItem(CFG.CACHE_KEY || "ssss-seating-remote-v1",
        JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) {}
  }

  /* 將 API 回傳的 JSON 轉成本檔使用的 DATA 格式；格式不符回傳 null（→ 回退備援）。 */
  function normalizeRemote(json) {
    if (!json || typeof json !== "object") return null;
    var K = CFG.KEYS || {};
    var guests = json[K.guests || "guests"];
    if (!Array.isArray(guests)) return null;

    /* v62：已回覆但尚未分配桌次的姓名（座位圖上不會出現，但會提示） */
    var unplaced = json[K.unplaced || "unplaced"];
    if (!Array.isArray(unplaced)) unplaced = [];
    unplaced = unplaced.map(function (x) { return String(x == null ? "" : x).trim(); }).filter(Boolean);

    var list = [], i;
    for (i = 0; i < guests.length; i++) {
      var g = guests[i] || {};
      var name = g.name == null ? "" : String(g.name).trim();
      var table = parseInt(g.table, 10);
      if (!name || !table || isNaN(table)) continue;
      var seat = parseInt(g.seat, 10);
      var item = { name: name, table: table, seat: (!seat || isNaN(seat)) ? 1 : seat };
      if (g.note) item.note = String(g.note);
      list.push(item);
    }
    /* v62：API 正常但尚無「已分配桌次」的賓客（例如試算表還沒填桌次欄）
       → 回報 empty，由呼叫端保留備援名單並提示，不視為失敗。 */
    if (!list.length) return { empty: true, unplaced: unplaced };

    var next = { VENUE: DATA.VENUE, TABLES: null, GUESTS: list, OPTIONS: DATA.OPTIONS || {} };

    /* 場地覆寫（可省略）：只覆蓋有提供的欄位，其餘沿用前端設定 */
    var venue = json[K.venue || "venue"];
    if (venue && typeof venue === "object") {
      var merged = {}, base = DATA.VENUE || {}, k;
      for (k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) merged[k] = base[k]; }
      for (k in venue) { if (Object.prototype.hasOwnProperty.call(venue, k)) merged[k] = venue[k]; }
      next.VENUE = merged;
    }

    var tables = json[K.tables || "tables"];
    if (Array.isArray(tables) && tables.length) {
      var tl = [];
      for (i = 0; i < tables.length; i++) {
        var tb = tables[i] || {};
        var no = parseInt(tb.no, 10);
        if (!no || isNaN(no)) continue;
        var rec = { no: no, name: tb.name ? String(tb.name) : "" };
        var s = parseInt(tb.seats, 10);
        if (s && !isNaN(s)) rec.seats = s;
        if (tb.side === "left" || tb.side === "right") rec.side = tb.side;
        tl.push(rec);
      }
      if (tl.length) next.TABLES = tl;
    }
    if (!next.TABLES) {
      /* API 未提供桌次清單 → 依實際有人坐的桌號產生，並至少保留 VENUE 的桌數 */
      var maxNo = 0, m;
      for (m = 0; m < list.length; m++) { if (list[m].table > maxNo) maxNo = list[m].table; }
      var minNo = Math.max(1, tablesPerSide ? tablesPerSide * 2 : 16);
      var out = [];
      for (m = 1; m <= Math.max(maxNo, minNo); m++) out.push({ no: m, name: "" });
      next.TABLES = out;
    }
    return { data: next, unplaced: unplaced };
  }

  /* 套用新名單並重繪（搜尋與縮放事件不會重複綁定）。 */
  function applyData(next, statusText, kind) {
    DATA = next;
    deriveAll();
    if (resultBox) { resultBox.className = "seat-result"; resultBox.innerHTML = ""; }
    buildMap();
    if (window.seatingPage) {
      window.seatingPage.tables = Object.keys(tableNodes).map(Number);
      window.seatingPage.guests = GUESTS.length;
    }
    setStatus(fmtN(statusText, GUESTS.length), kind);
  }

  var retryTimer = null;

  function fetchRemote() {
    var url = String(CFG.API_URL);
    var timeout = parseInt(CFG.API_TIMEOUT_MS, 10) || 8000;
    return new Promise(function (resolve, reject) {
      var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
      var timer = window.setTimeout(function () {
        if (ctrl) { try { ctrl.abort(); } catch (e) {} }
        reject(new Error("timeout"));
      }, timeout);
      fetch(url, { method: "GET", cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) {
          if (!r.ok) { throw new Error("HTTP " + r.status); }
          return r.json();
        })
        .then(function (json) {
          window.clearTimeout(timer);
          if (json && json.ok === false) { throw new Error(json.error || "api error"); }
          resolve(json);
        })
        .catch(function (err) { window.clearTimeout(timer); reject(err); });
    });
  }

  function requestRemote(onFail) {
    fetchRemote().then(function (json) {
      var res = normalizeRemote(json);
      if (!res) { throw new Error("bad format"); }
      if (res.empty) {
        /* v62：API 正常但尚無已分配桌次的賓客 → 保留備援名單，僅提示未排桌者 */
        setStatus(unplacedText(res.unplaced), "fallback");
        return;
      }
      writeCache(res.data);
      applyData(res.data, CFG.TEXT_LIVE, "live");
      if (res.unplaced && res.unplaced.length) appendUnplaced(res.unplaced);
      if (retryTimer) { window.clearInterval(retryTimer); retryTimer = null; }
    }).catch(function () {
      if (typeof onFail === "function") onFail();
    });
  }

  /* v62：未分配桌次的提示文字（不干擾、不遮擋座位圖） */
  function unplacedText(list) {
    list = list || [];
    var t = CFG.TEXT_UNPLACED || "另有 {n} 位已回覆、尚未分配桌次：{names}";
    var names = list.slice(0, 12).join("、");
    if (list.length > 12) names += " 等";
    return String(t).replace(/\{n\}/g, String(list.length)).replace(/\{names\}/g, names);
  }

  function appendUnplaced(list) {
    if (!statusEl || !list || !list.length) return;
    statusEl.textContent = statusEl.textContent + "　" + unplacedText(list);
  }

  function startRetry() {
    var ms = parseInt(CFG.RETRY_MS, 10) || 0;
    if (ms <= 0 || retryTimer) return;
    retryTimer = window.setInterval(function () {
      requestRemote(function () {});   /* 靜默重試，成功後自動停掉 */
    }, ms);
  }

  function loadRemote() {
    var cached = readCache();
    if (cached) {
      applyData(cached, CFG.TEXT_CACHED, "cached");     /* 先秒開，再更新 */
      requestRemote(function () {
        setStatus(fmtN(CFG.TEXT_FALLBACK, GUESTS.length), "fallback");
        startRetry();
      });
      return;
    }
    requestRemote(function () {
      setStatus(fmtN(CFG.TEXT_FALLBACK, GUESTS.length), "fallback");   /* 維持備援名單，畫面不變 */
      startRetry();
    });
  }

  /* ══════════ 八、啟動 ══════════ */
  function boot() {
    statusEl = document.getElementById((CFG.STATUS_ID || "seatDataStatus"));
    deriveAll();
    buildMap();
    initSearch();
    initFontScale();
    initMusic();
    /* 供測試／除錯使用（不影響一般瀏覽） */
    window.seatingPage = {
      search: doSearch,
      clear: function () { clearHit(); if (resultBox) { resultBox.innerHTML = ""; } },
      focusNo: function (no) { var tn = tableNodes[Number(no)]; if (tn) { showHit({ name: "測試", table: Number(no), seat: 1 }); } return !!tn; },
      tables: Object.keys(tableNodes).map(Number),
      guests: GUESTS.length,
      find: findMatches
    };

    /* v62：已設定 API_URL → 載入問卷回覆名單；未設定 → 明確提示目前使用備援名單。 */
    if (CFG.API_URL && /^https?:\/\//i.test(String(CFG.API_URL))) {
      loadRemote();
    } else {
      setStatus(CFG.TEXT_LOCAL, "local");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();