/* ══════════════════════════════════════════════════════════════════════════════
   seating.js ── 座位表頁面邏輯（v68）
   ──────────────────────────────────────────────────────────────────────────────
   這個檔案「不需要」在替換座位資料時修改。
   資料來源（依序嘗試）：
     • 主來源 1 = 問卷回覆的 Google 試算表 gviz JSON（js/seating-config.js 的 SHEET_GVIZ_URL）
     • 主來源 2 = 問卷回覆的 Google 試算表 CSV（SHEET_CSV_URL）
     • 主來源 3 = Apps Script Web App JSON（API_URL）
     • 備援     = js/seating-data.js（window.SEATING_DATA；前三者皆失敗時回退）

   功能：
     1. 依 VENUE 參數繪製「全場座位圖」：
        中央 12 人主桌 + 左右兩側共 15 桌（左 8、右 7）
        （v71：已移除舞台與紅毯步道圖形；場地上緣留白縮減，座位區向上讓出空間。）
     2. 姓名查詢（模糊／部分比對、同名候選、查無資料三種情境）
     3. 查到時：座位變色 + 呼吸燈、顯示「姓名-幾桌」、自動捲動聚焦到該桌
     4. 右下角「Tt」字級浮動鈕（三檔 sm/md/lg，沿用主站 localStorage 記憶）
     5. 支援 prefers-reduced-motion

   v67 變更（資料模型與人數一致性）：
     1. 每一筆問卷回覆視為一個「同行團體（party）」，新增欄位：
          partySize  出席人數（大人＋兒童）
          adults     出席大人人數
          children   出席兒童人數
          childSeats 需要兒童椅數量
        修正「表單填寫人數與查詢結果不匹配」：查詢結果卡會顯示該團體的
        大人／兒童人數，且座位圖會依 partySize 連續配位（不再一人一格）。
     2. 資料讀取改為多層（gviz → CSV → Apps Script → 本機備援），
        直接讀取問卷回覆試算表的「出席人數／大人／兒童／兒童椅」欄位。
     3. 兒童椅標示：座位圖上以專屬顏色 + 兒童椅圖示標示，並新增圖例；
        查詢結果卡顯示兒童椅數量。
     4. 桌數固定 16 桌（1 主桌 + 15 側桌），畫面桌數不得大於 16。
     5. 每桌人數上限檢查：某桌填寫人數超過該桌上限時，超額者改由現場人員安排。

   v68 變更（座位查詢操作介面重新設計）：
     1. 查詢結果卡改以「同行人數」為主視覺：大字人數 + 大人／兒童分項徽章，
        即使只有 1 人也會顯示，與問卷表單填寫完全一致。
     2. 兒童椅改為「圖示 + 標籤 + 顏色」三重編碼：
        座位圖上兒童椅座位加上高腳椅圖示與外環；該桌顯示「圖示 + 椅N」膠囊徽章；
        圖例新增兒童椅圖示色票；結果卡以專屬色塊顯示「兒童椅 N 張」。
     3. 響應式強化：手機（360/390）與電腦（768/1440）皆易讀、無水平溢位。
   ══════════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var VB_W = 1200, VB_H = 620;      /* SVG 內部座標系（與裝置無關） */

  var DATA   = window.SEATING_DATA || {};
  var CFG    = window.SEATING_CONFIG || {};
  /* v64：桌次一律以「前端備援資料」為準（固定 16 桌），API 不得覆寫桌數。
     這裡在載入時先記住基準 VENUE / TABLES，之後任何遠端名單都沿用它們。 */
  var BASE_VENUE  = DATA.VENUE || {};
  var BASE_TABLES = Array.isArray(DATA.TABLES) ? DATA.TABLES.slice() : [];
  var BASE_OPTIONS = DATA.OPTIONS || {};
  var VENUE, TABLES, GUESTS, OPT;
  var validTableNos = {};   /* v64：有效桌號集合（由 BASE_TABLES 產生） */
  var unassignedText = "由現場人員安排";   /* v64：桌號無效時的顯示文字 */
  var childSeatText = "兒童椅";            /* v67：兒童椅標示文字 */
  var partyText = "同行人數";              /* v67：人數標示文字 */
  var tablesPerSide, seatsPerTable, aisleWidthPct, LABELS, tableSuffix, notFoundText, candText;
  var defaultSeatsPerTable = 10, capacityText = "";   /* v65：每桌人數上限與超額提示 */
  var statusEl = null, capacityEl = null;

  /* v65：硬性桌數上限（1 主桌 + 15 側桌）。任何來源都不得讓畫面桌數大於此值。 */
  var MAX_TABLES = 16;

  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ── 小工具 ────────────────────────────────────────────────────────────── */
  function $(s, sc) { return (sc || document).querySelector(s); }
  function $$(s, sc) { return Array.prototype.slice.call((sc || document).querySelectorAll(s)); }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) { for (var k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]); } }
    if (parent) parent.appendChild(n);
    return n;
  }
  function norm(s) { return String(s == null ? "" : s).replace(/\s+/g, "").toLowerCase(); }
  function intOr(v, d) { var n = parseInt(String(v == null ? "" : v).replace(/[^\d-]/g, ""), 10); return isNaN(n) ? d : n; }

  /* ══════════ 一、計算場地幾何 ══════════ */
  var STAGE = { x: 0, y: 8, w: 0, h: 0 };   /* v71：不再繪製舞台，僅保留場地上緣留白 */
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
    unassignedText = OPT.unassignedText || "由現場人員安排";
    childSeatText  = OPT.childSeatText || "兒童椅";
    partyText      = OPT.partyText || "同行人數";
    /* v65：每桌人數上限（預設沿用 VENUE.seatsPerTable；單桌可用 TABLES[].seats 覆寫） */
    defaultSeatsPerTable = Math.max(1, parseInt(VENUE.seatsPerTable, 10) || 10);
    capacityText = OPT.capacityText || "部分桌次人數已達上限，超額賓客將由現場人員安排。";

    /* v65：硬性上限 16 桌（1 主桌 + 15 側桌），畫面桌數不得大於 16 */
    if (TABLES.length > MAX_TABLES) TABLES = TABLES.slice(0, MAX_TABLES);

    /* v64：有效桌號集合（固定 16 桌：1 主桌 + 15 側桌） */
    validTableNos = {};
    for (var vi = 0; vi < TABLES.length; vi++) {
      var vno = parseInt(TABLES[vi].no, 10);
      if (vno && !isNaN(vno)) validTableNos[vno] = true;
    }

    /* v62：主桌（舞台正前方、紅毯末端）。VENUE.mainTable 為 null 時不畫主桌。 */
    var mt = VENUE.mainTable;
    mainTableNo    = (mt && mt.no != null) ? parseInt(mt.no, 10) : 0;
    if (isNaN(mainTableNo)) mainTableNo = 0;
    mainTableSeats = (mt && mt.seats) ? Math.max(1, parseInt(mt.seats, 10) || 12) : 12;
    mainTableName  = (mt && mt.name) ? String(mt.name) : (LABELS.mainTable || "主桌");

    /* v67：正規化同行團體欄位，並依 partySize 連續配位 */
    normalizeParties();
    assignSeats();

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

  /* v67：把每一筆賓客正規化為「同行團體」。
     partySize = 出席人數（大人＋兒童）；adults / children / childSeats 為明細。
     _childMark = 該團體中需要標示為兒童椅的座位數。
     v70：一律以問卷「需要兒童椅數量」（childSeats）為唯一依據；未填就不標示。
           不再由「出席兒童人數」（children）推導兒童椅，避免勾選與圖示不一致。 */
  function normalizeParties() {
    for (var i = 0; i < GUESTS.length; i++) {
      var g = GUESTS[i];
      var size     = intOr(g.partySize, 0);
      var adults   = intOr(g.adults, 0);
      var children = intOr(g.children, 0);
      var childSeats = intOr(g.childSeats, 0);
      if (adults < 0) adults = 0;
      if (children < 0) children = 0;
      if (childSeats < 0) childSeats = 0;
      if (size < 1) size = (adults + children) || 1;
      if (!adults && !children) adults = size;
      if (adults + children > size) size = adults + children;
      g.partySize  = size;
      g.adults     = adults;
      g.children   = children;
      g.childSeats = childSeats;
      g._childMark = Math.min(childSeats, size);
    }
  }

  /* v67：依 partySize 連續配位。
     同一桌的團體依「原座位號 → 姓名」排序後，從第 1 位起連續佔位；
     若某團體放不進該桌剩餘座位（超過該桌人數上限），該團體改標記為
     「未分配（overflow）」，查詢時顯示「由現場人員安排」。 */
  function assignSeats() {
    var byTable = {};
    for (var i = 0; i < GUESTS.length; i++) {
      var g = GUESTS[i];
      if (g.unassigned || !g.table) continue;
      var tno = Number(g.table);
      if (!validTableNos[tno]) { g.unassigned = true; g.table = null; g.seat = null; continue; }
      (byTable[tno] = byTable[tno] || []).push(g);
    }
    Object.keys(byTable).forEach(function (k) {
      var tno = Number(k);
      var cap = capOfTable(tno);
      var arr = byTable[k];
      arr.sort(function (a, b) {
        return (Number(a.seat) || 0) - (Number(b.seat) || 0) ||
               String(a.name).localeCompare(String(b.name));
      });
      var cursor = 1;
      for (var j = 0; j < arr.length; j++) {
        var p = arr[j];
        var size = Math.max(1, parseInt(p.partySize, 10) || 1);
        if (cursor + size - 1 > cap) {
          p.unassigned = true; p.overflow = true; p.table = null; p.seat = null;
          continue;
        }
        p.seat = cursor;
        p.seatEnd = cursor + size - 1;
        p.childSeatFrom = p._childMark > 0 ? (p.seatEnd - p._childMark + 1) : 0;
        cursor += size;
      }
    });
  }

  function capOfTable(no) {
    for (var i = 0; i < TABLES.length; i++) {
      if (Number(TABLES[i].no) === Number(no)) {
        return Math.max(1, parseInt(TABLES[i].seats, 10) || defaultSeatsPerTable);
      }
    }
    return defaultSeatsPerTable;
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
      "aria-label": "全場座位圖：左右兩側共 " + TABLES.length + " 桌"
    });
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    /* 漸層定義 */
    var defs = el("defs", null, svg);
    /* v71：已移除舞台／紅毯漸層定義（座位圖不再繪製舞台與紅毯步道） */

    /* 場地底板 */
    el("rect", { class: "venue-bg", x: 6, y: 6, width: VB_W - 12, height: VB_H - 12, rx: 14 }, svg);

    /* 左右兩側區塊（v62：上緣讓開主桌高度） */
    var islandTop  = AISLE.y + 8 + (mainTableNo ? mainTableH : 0);
    var sideBlockH = AISLE.h - (mainTableNo ? mainTableH : 0);
    el("rect", { class: "tbl__island", x: 16, y: islandTop, width: aisleX - 32, height: sideBlockH - 16, rx: 18 }, svg);
    el("rect", { class: "tbl__island", x: VB_W - aisleX + 16, y: islandTop, width: aisleX - 32, height: sideBlockH - 16, rx: 18 }, svg);

    /* v71：已移除舞台與紅毯步道圖形（含標示文字與中央裝飾線）。
       座位區的左右分欄與中央走道寬度仍由 aisleX / aisleW 決定，故版面維持不變。 */

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

    /* v69：整團外框弧線（預設隱藏，查到時依座位區間顯示） */
    var partyArc = el("path", { class: "tbl-partyarc" }, g);

    /* 座位點 */
    var seatNodes = [];
    var step = 360 / seats;
    for (var s = 0; s < seats; s++) {
      var a = (-90 + s * step) * Math.PI / 180;
      var sx = cx + Math.cos(a) * rR;
      var sy = cy + Math.sin(a) * rR;
      var sc = el("circle", { class: "tbl-seat", cx: sx.toFixed(2), cy: sy.toFixed(2), r: sR, "data-seat": s + 1 }, g);
      var owner = guestAt(t.no, s + 1);
      if (owner) {
        var isChild = owner.childSeatFrom && (s + 1) >= owner.childSeatFrom;
        if (isChild) {
          /* v70：只以「專屬顏色 + 外環 + 座位上的兒童椅圖示」標示兒童椅座位本身。
             「椅N」文字標籤已全部移出版面（改到桌面圓環正下方），
             因此座位點與兒童椅圖示不會再被任何文字遮擋。 */
          sc.classList.add("seat-child");
          var ic = el("g", { class: "tbl-childseat", "data-seat": s + 1 }, g);
          el("circle", { class: "tbl-childseat__ring", cx: sx.toFixed(2), cy: sy.toFixed(2), r: (sR + 1.5).toFixed(2) }, ic);
          var k = (sR * 1.65) / 24;
          var ip = el("path", {
            class: "tbl-childseat__ico",
            transform: "translate(" + (sx - 12 * k).toFixed(2) + "," + (sy - 12 * k).toFixed(2) + ") scale(" + k.toFixed(4) + ")"
          }, ic);
          ip.setAttribute("d", CHILD_ICON_D);
          var cti = el("title", null, ic);
          cti.textContent = owner.name + " · " + (s + 1) + "號（" + childSeatText + "）";
        }
        var ti = el("title", null, sc);
        ti.textContent = owner.name + " · " + (s + 1) + "號" + (isChild ? "（" + childSeatText + "）" : "");
      }
      seatNodes.push(sc);
    }

    el("circle", { class: "tbl__ring", cx: cx, cy: cy, r: tR }, g);
    var num = el("text", { class: "tbl__num", x: cx, y: cy + tR * 0.20, "text-anchor": "middle" }, g);
    num.textContent = String(t.no);
    if (t.name) {
      var nm = el("text", { class: "tbl__name", x: cx, y: cy + tR * 0.66, "text-anchor": "middle" }, g);
      nm.textContent = t.name;
    }

    /* v67：該桌兒童椅數量標籤（僅在該桌有兒童椅時顯示；childSeats 未填則完全不顯示）
       v70：位置改到「桌面圓環正下方、所有座位點之外」——
            原本固定於桌號右上方，會壓到右上角座位點與座位上的兒童椅圖示。 */
    /* v71：已移除桌次「椅N」文字標籤（原本置於桌面圓環下方）。
       兒童椅仍以「專屬顏色 + 外環 + 座位上的高腳椅圖示」標示，不再有任何文字標籤遮擋或佔位。 */

    /* 命中標籤（預設隱藏，查到時顯示「姓名-幾桌」） */
    var lg = el("g", { class: "tbl-hitlabel" }, g);
    var bg = el("rect", { class: "tbl__hitlabel-bg", rx: 6, height: 26 }, lg);
    var lt = el("text", { class: "tbl__hitlabel", "text-anchor": "middle", y: 18 }, lg);

    tableNodes[t.no] = {
      gEl: g, ring: g.querySelector(".tbl__ring"), hitLabel: lg, hitLabelBg: bg, hitLabelText: lt,
      cx: cx, cy: cy, ringR: rR, seatR: sR, isMain: isMain, seats: seatNodes, partyArc: partyArc, data: t
    };
  }

  function guestAt(tableNo, seatNo) {
    for (var i = 0; i < GUESTS.length; i++) {
      var g = GUESTS[i];
      if (g.unassigned) continue;   /* v64：未分配桌次者不佔座位點 */
      if (Number(g.table) !== Number(tableNo)) continue;
      var from = Number(g.seat), to = Number(g.seatEnd || g.seat);
      if (Number(seatNo) >= from && Number(seatNo) <= to) return g;
    }
    return null;
  }

  /* v70：每桌兒童椅張數＝該桌各團體「需要兒童椅數量」（childSeats）之總和。
     未填 childSeats 者一律不計入，因此沒有填兒童椅的桌子不會出現「椅N」標籤。 */
  function childSeatsAtTable(tableNo) {
    var n = 0;
    for (var i = 0; i < GUESTS.length; i++) {
      var g = GUESTS[i];
      if (g.unassigned || Number(g.table) !== Number(tableNo)) continue;
      n += Math.max(0, parseInt(g.childSeats, 10) || 0);
    }
    return n;
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
      /* v64：未分配桌次者排在最後 */
      var au = a.guest.unassigned ? 1 : 0, bu = b.guest.unassigned ? 1 : 0;
      if (au !== bu) return au - bu;
      return Number(a.guest.table) - Number(b.guest.table) || Number(a.guest.seat) - Number(b.guest.seat);
    });
    return hits.map(function (h) { return h.guest; });
  }

  function clearHit() {
    Object.keys(tableNodes).forEach(function (no) {
      var tn = tableNodes[no];
      tn.gEl.classList.remove("is-hit");
      tn.hitLabel.classList.remove("is-on");
      tn.seats.forEach(function (s) { s.classList.remove("seat-hit"); s.classList.remove("seat-hit--child"); });
      if (tn.partyArc) { tn.partyArc.classList.remove("is-on"); tn.partyArc.removeAttribute("d"); }
    });
    if (svg) svg.classList.remove("venue-dim");
  }

  function showHit(g, opts) {
    opts = opts || {};
    clearHit();
    /* v64：未分配桌次者不做座位高亮，只回報文字 */
    if (g.unassigned) {
      return { label: String(g.name) + "-" + unassignedText, tableNo: null, seat: null, found: false, unassigned: true };
    }
    var tn = tableNodes[g.table];
    var label = String(g.name) + "-" + g.table + tableSuffix;

    if (tn) {
      tn.gEl.classList.add("is-hit");
      /* v69：整團高亮 —— 依 seat..seatEnd 連續區間，逐一標示「所有」座位（含兒童椅座位），
         修正 v68 只高亮 g.seat 單一座位、導致同團其他大人座位未變色的問題。 */
      var from = Math.max(1, Number(g.seat) || 1);
      var to   = Math.max(from, Number(g.seatEnd) || from);
      var childFrom = Number(g.childSeatFrom) || 0;
      for (var si = from; si <= to; si++) {
        var sn = tn.seats[si - 1];
        if (!sn) continue;
        sn.classList.add("seat-hit");
        if (childFrom && si >= childFrom) sn.classList.add("seat-hit--child");
      }
      /* v69：整團外框弧線，讓「同一團」在座位圖上被視為一個群組 */
      if (tn.partyArc) {
        if (to > from) {
          tn.partyArc.setAttribute("d", partyArcPath(tn.cx, tn.cy, (tn.ringR || ringR) + (tn.seatR || seatR) + 2.5, tn.seats.length, from, to));
          tn.partyArc.classList.add("is-on");
        } else {
          tn.partyArc.removeAttribute("d");
          tn.partyArc.classList.remove("is-on");
        }
      }
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

  /* v69：依座位區間（from..to）產生沿桌緣的弧線路徑，將整團座位圈成一個視覺群組。
     座位編號為順時針遞增，故 sweep-flag 固定為 1。 */
  function partyArcPath(cx, cy, r, seats, from, to) {
    var step = 360 / Math.max(1, seats);
    var a1 = (-90 + (from - 1) * step) * Math.PI / 180;
    var a2 = (-90 + (to - 1) * step) * Math.PI / 180;
    var x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    var x2 = cx + Math.cos(a2) * r, y2 = cy + Math.sin(a2) * r;
    var span = (to - from) * step;
    var large = span > 180 ? 1 : 0;
    return "M" + x1.toFixed(2) + " " + y1.toFixed(2) +
           " A" + r.toFixed(2) + " " + r.toFixed(2) + " 0 " + large + " 1 " + x2.toFixed(2) + " " + y2.toFixed(2);
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

  /* ══════════ 五、搜尋 UI（v66：combobox + 四態結果卡 + 語音 + 近期查詢）══════════ */
  var resultBox, inputEl, suggestBox, clearBtn, voiceBtn, recentBox, recentList, fabBtn;
  var searchBound = false;
  var activeIdx = -1;          /* combobox 目前反白的建議項 */
  var suggestItems = [];       /* 目前建議清單對應的賓客物件 */
  var LAST_QUERY = "";         /* 最近一次查詢字串 */
  var RECENT_KEY = "ssss-seating-recent-v1";
  var RECENT_MAX = 3;          /* v71：最近查詢最多顯示 3 筆 */

  /* ── 共用小工具 ── */
  function badgeText(state) {
    if (state === "found") return "找到座位";
    if (state === "wait") return "由現場人員安排";
    if (state === "miss") return "查無此姓名";
    return "多筆符合";
  }

  /* 把姓名中命中的片段以 <mark> 標示，讓使用者理解「為什麼是這一筆」 */
  function hiName(name, q) {
    var s = String(name == null ? "" : name);
    var nq = norm(q);
    if (!nq) return esc(s);
    var at = norm(s).indexOf(nq);
    if (at < 0) return esc(s);
    return esc(s.slice(0, at)) + "<mark>" + esc(s.slice(at, at + nq.length)) + "</mark>" + esc(s.slice(at + nq.length));
  }

  function posText(g) {
    return g.table + tableSuffix + (OPT.showSeatLabel !== false && g.seat ? " · 第" + g.seat + "位" : "");
  }

  /* v68：兒童椅圖示（inline SVG；結果卡、座位圖徽章、圖例共用同一造型）
     造型＝高腳兒童椅：椅背 + 座面 + 餐盤 + 椅腳，24×24 viewBox。 */
  var CHILD_ICON_D = "M8 3.4v6.6M8 10h7.4a2.6 2.6 0 0 1 2.6 2.6V16M5.8 16h12.4M9 16v4.2M15 16v4.2";
  function childSeatIcon(cls) {
    return '<svg class="' + (cls || "cs-ico") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="' + CHILD_ICON_D + '"/></svg>';
  }

  /* v68：同行人數區塊（結果卡主視覺）。
     與問卷表單填寫一致：即使只有 1 人也會顯示，並拆出大人／兒童人數。 */
  function partyBlock(g) {
    var size = Math.max(1, parseInt(g.partySize, 10) || 1);
    var adults = Math.max(0, parseInt(g.adults, 10) || 0);
    var children = Math.max(0, parseInt(g.children, 10) || 0);
    if (!adults && !children) adults = size;
    return '<div class="seat-rc__party">' +
        '<span class="seat-rc__party-label">' + esc(partyText) + '</span>' +
        '<span class="seat-rc__party-num">' + size + '</span>' +
        '<span class="seat-rc__party-unit">人</span>' +
        '<span class="seat-rc__party-break">' +
          '<span class="seat-rc__pchip seat-rc__pchip--adult">大人 ' + adults + '</span>' +
          (children > 0 ? '<span class="seat-rc__pchip seat-rc__pchip--child">兒童 ' + children + '</span>' : '') +
        '</span>' +
      '</div>';
  }

  /* v68：兒童椅區塊（圖示＋標籤＋顏色三重編碼；無兒童椅時不顯示）
     v70：一律以問卷「需要兒童椅數量」（childSeats）為唯一依據。
          未填 childSeats 就完全不出現此區塊（即使同行有兒童）；
          有填則張數與座位圖標示的兒童椅座位數完全對應。 */
  function childBlock(g) {
    var n = Math.max(0, parseInt(g.childSeats, 10) || 0);
    if (n <= 0) return "";
    /* v69：明確標出兒童椅的座位號碼，與座位圖上標示的座位完全對應 */
    var seatNote = "";
    if (g.childSeatFrom && g.seatEnd) {
      seatNote = '（第 ' + esc(String(g.childSeatFrom)) + '～' + esc(String(g.seatEnd)) + ' 號）';
    }
    return '<div class="seat-rc__child">' + childSeatIcon("seat-rc__child-ico") +
        '<span class="seat-rc__child-text">' + esc(childSeatText) + ' <b>' + n + '</b> 張' + seatNote + '</span>' +
        '<span class="seat-rc__child-note">座位圖已以專屬顏色標示</span></div>';
  }

  /* ── 結果卡：找到座位（含桌次、座位號、人數、兒童椅、說明與行動按鈕）── */
  function renderFound(g, q) {
    var r = showHit(g);
    resultBox.className = "seat-result";
    /* v64：桌號無效／查無對應桌次 → 顯示「由現場人員安排」，不顯示錯誤桌號 */
    if (g.unassigned) {
      resultBox.innerHTML =
        '<div class="seat-rc seat-rc--wait">' +
          '<span class="seat-rc__badge">' + esc(badgeText("wait")) + '</span>' +
          '<p class="seat-rc__name">' + esc(g.name) + '</p>' +
          '<p class="seat-rc__where">' + esc(unassignedText) + '</p>' +
          partyBlock(g) + childBlock(g) +
          (g.note ? '<p class="seat-rc__note">備註：' + esc(g.note) + '</p>' : '') +
          '<p class="seat-rc__hint">您的桌次尚未安排，請於現場洽詢<b>接待人員</b>，由現場人員為您帶位。</p>' +
        '</div>';
      return;
    }
    resultBox.innerHTML =
      '<div class="seat-rc seat-rc--found">' +
        '<span class="seat-rc__badge">' + esc(badgeText("found")) + '</span>' +
        '<p class="seat-rc__name">' + esc(g.name) + '</p>' +
        '<p class="seat-rc__where">您的桌次：<b>' + esc(String(r.tableNo)) + '</b>' + esc(tableSuffix) + '</p>' +
        (OPT.showSeatLabel !== false && g.seat ? '<p class="seat-rc__seat">座位號碼：' + (g.seatEnd && g.seatEnd > g.seat ? '第 ' + esc(String(g.seat)) + '～' + esc(String(g.seatEnd)) + ' 號（本團體共 ' + esc(String(g.partySize)) + ' 位）' : '第 ' + esc(String(g.seat)) + ' 位') + '</p>' : '') +
        partyBlock(g) + childBlock(g) +
        (g.note ? '<p class="seat-rc__note">備註：' + esc(g.note) + '</p>' : '') +
        (r.found
          ? '<p class="seat-rc__hint">下方座位圖已為您標示並聚焦到 <b>' + esc(String(r.tableNo)) + esc(tableSuffix) + '</b>，本團體 <b>' + esc(String(g.partySize)) + '</b> 個座位（第 ' + esc(String(g.seat)) + '～' + esc(String(g.seatEnd || g.seat)) + ' 號；大人 <b>' + esc(String(Math.max(0, parseInt(g.adults, 10) || g.partySize))) + '</b> 位' + ((parseInt(g.children, 10) || 0) > 0 ? '、兒童 <b>' + esc(String(g.children)) + '</b> 位' : '') + '）將以金色閃爍。' + (g.childSeatFrom ? '其中第 ' + esc(String(g.childSeatFrom)) + '～' + esc(String(g.seatEnd)) + ' 號為' + esc(childSeatText) + '。' : '') + '</p>'
          : '<p class="seat-rc__hint">（此桌次不在目前座位圖中，請於現場洽詢接待人員。）</p>') +
      '</div>';
  }

  /* ── 結果卡：查無（含相似姓名建議，降低打錯字的挫折）── */
  function renderNotFound(q) {
    clearHit();
    if (inputEl) inputEl.setAttribute("aria-invalid", "true");
    var sim = similarNames(q);
    var html =
      '<div class="seat-rc seat-rc--miss">' +
        '<span class="seat-rc__badge">' + esc(badgeText("miss")) + '</span>' +
        '<p class="seat-rc__name">查無「' + esc(q) + '」</p>' +
        '<p class="seat-rc__hint">請確認姓名是否輸入正確，或只輸入名字的一部分（例如只打「小明」）。' +
          '也可以直接在現場洽詢接待人員協助找位。</p>';
    if (sim.length) {
      html += '<p class="seat-rc__similar-title">您是不是要找：</p><div class="seat-rc__chips">';
      sim.forEach(function (nm, i) {
        html += '<button type="button" class="seat-rc__chip" data-sim="' + i + '"><span>' + esc(nm) + "</span></button>";
      });
      html += "</div>";
    }
    html += "</div>";
    resultBox.className = "seat-result";
    resultBox.innerHTML = html;
    $$(".seat-rc__chip[data-sim]", resultBox).forEach(function (b) {
      b.addEventListener("click", function () {
        var nm = sim[parseInt(b.getAttribute("data-sim"), 10)];
        if (nm) { if (inputEl) inputEl.value = nm; doSearch(); }
      });
    });
  }

  /* ── 結果卡：多筆候選（同名／相似，以桌次作為辨識參考）── */
  function renderCandidates(list, q) {
    clearHit();
    if (inputEl) inputEl.removeAttribute("aria-invalid");
    var html = '<div class="seat-rc seat-rc--cands">' +
      '<span class="seat-rc__badge">' + esc(badgeText("cands")) + '</span>' +
      '<p class="seat-rc__name">「' + esc(q) + '」共 ' + list.length + ' 筆</p>' +
      '<p class="seat-rc__hint">' + esc(candText) + '請點選正確的那一位，右側資訊可協助辨識。</p>' +
      '<div class="seat-rc__chips">';
    list.forEach(function (g, i) {
      var meta = g.unassigned ? unassignedText : posText(g);
      html += '<button type="button" class="seat-rc__chip" data-cand="' + i + '">' +
        '<span>' + hiName(g.name, q) + "</span><i>" + esc(meta) + "</i></button>";
    });
    html += "</div></div>";
    resultBox.className = "seat-result";
    resultBox.innerHTML = html;
    $$(".seat-rc__chip[data-cand]", resultBox).forEach(function (b) {
      b.addEventListener("click", function () {
        var g = list[parseInt(b.getAttribute("data-cand"), 10)];
        if (g) renderFound(g, q);
      });
    });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ════════ v66：即時建議清單（combobox listbox）════════ */
  function closeSuggest() {
    activeIdx = -1; suggestItems = [];
    if (suggestBox) { suggestBox.hidden = true; suggestBox.innerHTML = ""; }
    if (inputEl) { inputEl.setAttribute("aria-expanded", "false"); inputEl.removeAttribute("aria-activedescendant"); }
  }

  function suggestLabel(g) {
    if (g.unassigned) return unassignedText;
    return g.table + tableSuffix + (OPT.showSeatLabel !== false && g.seat ? " · 第" + g.seat + "位" : "");
  }

  function openSuggest(q) {
    if (!suggestBox || !inputEl) return;
    if (!norm(q)) { closeSuggest(); return; }
    var list = findMatches(q).slice(0, 6);
    suggestItems = list;
    activeIdx = -1;
    if (!list.length) {
      suggestBox.innerHTML = '<li class="seat-suggest__empty">尚無符合的姓名，可直接按「查詢座位」，或只輸入名字的一部分。</li>';
      suggestBox.hidden = false;
      inputEl.setAttribute("aria-expanded", "true");
      return;
    }
    var html = "";
    list.forEach(function (g, i) {
      html += '<li class="seat-suggest__item" role="option" id="seatOpt-' + i + '" data-i="' + i + '" aria-selected="false">' +
        '<span class="seat-suggest__name">' + hiName(g.name, q) + "</span>" +
        '<span class="seat-suggest__meta">' + esc(suggestLabel(g)) + "</span></li>";
    });
    suggestBox.innerHTML = html;
    suggestBox.hidden = false;
    inputEl.setAttribute("aria-expanded", "true");
    $$(".seat-suggest__item", suggestBox).forEach(function (li) {
      /* 以 mousedown 攔截，避免 blur 先關閉清單 */
      li.addEventListener("mousedown", function (e) { e.preventDefault(); });
      li.addEventListener("click", function () { chooseSuggest(parseInt(li.getAttribute("data-i"), 10)); });
    });
  }

  function setActive(i) {
    if (!suggestBox) return;
    var items = $$(".seat-suggest__item", suggestBox);
    if (!items.length) return;
    if (i < 0) i = items.length - 1;
    if (i >= items.length) i = 0;
    activeIdx = i;
    items.forEach(function (li, k) {
      var on = (k === i);
      li.classList.toggle("is-active", on);
      li.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (inputEl) inputEl.setAttribute("aria-activedescendant", items[i].id);
    if (items[i].scrollIntoView) items[i].scrollIntoView({ block: "nearest" });
  }

  /* 選取建議項：帶入完整姓名並直接顯示結果（一次點擊即得答案） */
  function chooseSuggest(i) {
    var g = suggestItems[i];
    if (!g) return;
    closeSuggest();
    if (inputEl) inputEl.value = g.name;
    renderFound(g, g.name);
    pushRecent(g.name);
    LAST_QUERY = g.name;
  }

  /* ════════ v66：最近查詢（同一次瀏覽內快速再查）════════ */
  function readRecent() {
    try {
      var arr = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (x) { return typeof x === "string" && x; }).slice(0, RECENT_MAX);
    } catch (e) { return []; }
  }
  function writeRecent(arr) {
    try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, RECENT_MAX))); } catch (e) {}
  }
  function pushRecent(name) {
    name = String(name == null ? "" : name).trim();
    if (!name) return;
    var arr = readRecent().filter(function (x) { return norm(x) !== norm(name); });
    arr.unshift(name);
    writeRecent(arr);
    renderRecent();
  }
  function renderRecent() {
    if (!recentBox || !recentList) return;
    var arr = readRecent();
    if (!arr.length) { recentBox.hidden = true; recentList.innerHTML = ""; return; }
    recentList.innerHTML = arr.map(function (nm, i) {
      return '<button type="button" class="seat-recent__item" data-recent="' + i + '"><span>' + esc(nm) + "</span></button>";
    }).join("");
    recentBox.hidden = false;
    $$(".seat-recent__item[data-recent]", recentList).forEach(function (b) {
      b.addEventListener("click", function () {
        var nm = arr[parseInt(b.getAttribute("data-recent"), 10)];
        if (!nm) return;
        if (inputEl) inputEl.value = nm;
        doSearch();
      });
    });
  }

  /* ════════ v66：相似姓名建議（模糊比對姓名，用於查無時）════════ */
  function bigrams(s) {
    var out = [], i;
    for (i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    if (!out.length) out.push(s);
    return out;
  }
  function editDist(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }
  function similarNames(q) {
    var nq = norm(q);
    if (!nq || !GUESTS.length) return [];
    var seen = {}, scored = [], i, k;
    for (i = 0; i < GUESTS.length; i++) {
      var g = GUESTS[i];
      var n = norm(g.name);
      if (!n || n === nq || seen[n]) continue;
      var d = editDist(nq, n);
      var bg = bigrams(nq), shared = 0;
      for (k = 0; k < bg.length; k++) if (n.indexOf(bg[k]) >= 0) shared++;
      var charHit = 0;
      for (k = 0; k < nq.length; k++) if (n.indexOf(nq.charAt(k)) >= 0) charHit++;
      /* 相關性門檻：字元重疊足夠、或有共同雙字詞，才列入建議，避免噪音 */
      if (!(charHit >= Math.max(1, nq.length - 1) || shared > 0)) continue;
      seen[n] = true;
      scored.push({ name: String(g.name), d: d, shared: shared, len: Math.abs(n.length - nq.length), unassigned: !!g.unassigned });
    }
    scored.sort(function (a, b) {
      if (a.unassigned !== b.unassigned) return a.unassigned ? 1 : -1;
      return a.d - b.d || b.shared - a.shared || a.len - b.len;
    });
    return scored.slice(0, 6).map(function (x) { return x.name; });
  }

  /* ════════ v66：查詢動作 ════════ */
  function resetQuery(focus) {
    if (inputEl) { inputEl.value = ""; inputEl.removeAttribute("aria-invalid"); }
    clearHit();
    closeSuggest();
    if (resultBox) { resultBox.className = "seat-result"; resultBox.innerHTML = ""; }
    if (clearBtn) clearBtn.hidden = true;
    if (focus && inputEl) inputEl.focus();
  }

  function doSearch() {
    var q = (inputEl && inputEl.value ? inputEl.value : "").trim();
    if (!q) { resetQuery(true); return { state: "empty" }; }
    closeSuggest();
    LAST_QUERY = q;
    var list = findMatches(q);
    if (!list.length) { renderNotFound(q); return { state: "notfound", q: q }; }
    /* 完全同名只有一筆、或僅一筆符合 → 直接給答案；否則列候選讓使用者選 */
    var exact = list.filter(function (g) { return norm(g.name) === norm(q); });
    var target = (exact.length === 1) ? exact[0] : ((list.length === 1) ? list[0] : null);
    if (target) { renderFound(target, q); pushRecent(target.name); return { state: "found", guest: target }; }
    renderCandidates(list, q);
    return { state: "candidates", count: list.length, guests: list };
  }

  /* ════════ v66：語音輸入（Web Speech API；不支援的瀏覽器自動隱藏）════════ */
  function initVoice() {
    if (!voiceBtn || !inputEl) return;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { voiceBtn.hidden = true; return; }
    voiceBtn.hidden = false;
    var rec = null, listening = false;
    function stopUI() {
      listening = false;
      voiceBtn.classList.remove("is-listening");
      voiceBtn.setAttribute("aria-pressed", "false");
      voiceBtn.setAttribute("aria-label", "用語音輸入姓名");
    }
    voiceBtn.addEventListener("click", function () {
      if (listening) { try { rec.stop(); } catch (e) {} return; }
      try {
        rec = new SR();
        rec.lang = "zh-TW";
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.onstart = function () {
          listening = true;
          voiceBtn.classList.add("is-listening");
          voiceBtn.setAttribute("aria-pressed", "true");
          voiceBtn.setAttribute("aria-label", "停止語音輸入");
        };
        rec.onresult = function (ev) {
          var t = "";
          try { t = (ev.results[0][0].transcript || ""); } catch (e) {}
          t = t.replace(/[\s，。、,.]/g, "");
          if (t) {
            inputEl.value = t;
            if (clearBtn) clearBtn.hidden = false;
            closeSuggest();
            doSearch();
          }
        };
        rec.onerror = function () { stopUI(); };
        rec.onend = function () { stopUI(); };
        rec.start();
      } catch (e) { stopUI(); }
    });
  }

  /* ════════ v66：快速查詢浮動鈕（捲離查詢區後出現，一鍵回到查詢）════════ */
  function initFab() {
    if (!fabBtn) return;
    fabBtn.hidden = false;
    var hero = $("#seatHero");
    function update() {
      var past = hero ? (hero.getBoundingClientRect().bottom < window.innerHeight * 0.35) : (window.scrollY > 520);
      fabBtn.classList.toggle("show", past);
    }
    fabBtn.addEventListener("click", function () {
      var target = $("#seatSearch") || hero;
      if (target) {
        try { target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }); }
        catch (e) { target.scrollIntoView(); }
      }
      window.setTimeout(function () {
        if (inputEl) { try { inputEl.focus({ preventScroll: true }); } catch (e) { inputEl.focus(); } }
      }, reduceMotion ? 0 : 420);
    });
    var raf = window.requestAnimationFrame || function (f) { return window.setTimeout(f, 16); };
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      raf(function () { ticking = false; update(); });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  function initSearch() {
    resultBox = $("#seatResult");
    inputEl = $("#seatInput");
    suggestBox = $("#seatSuggest");
    clearBtn = $("#seatClear");
    voiceBtn = $("#seatVoice");
    recentBox = $("#seatRecent");
    recentList = $("#seatRecentList");
    fabBtn = $("#seatFab");
    if (!resultBox || !inputEl) return;
    if (searchBound) return;      /* v62：重繪時不重複綁定事件 */
    searchBound = true;

    var form = $("#seatForm");
    if (form) form.addEventListener("submit", function (e) { e.preventDefault(); doSearch(); });
    var btn = $("#seatBtn");
    if (btn) btn.addEventListener("click", function (e) { e.preventDefault(); doSearch(); });

    /* 輸入：即時建議清單 */
    inputEl.addEventListener("input", function () {
      var v = (inputEl.value || "").trim();
      if (clearBtn) clearBtn.hidden = !(inputEl.value || "").length;
      if (!v) { closeSuggest(); clearHit(); resultBox.className = "seat-result"; resultBox.innerHTML = ""; return; }
      openSuggest(v);
    });

    inputEl.addEventListener("focus", function () {
      var v = (inputEl.value || "").trim();
      if (v) openSuggest(v);
      else if (readRecent().length) renderRecent();
    });

    /* 鍵盤操作：↑↓ 移動、Enter 選取、Esc 關閉、Tab 離開 */
    inputEl.addEventListener("keydown", function (e) {
      var open = suggestBox && !suggestBox.hidden;
      if (e.key === "ArrowDown") { e.preventDefault(); if (!open) openSuggest((inputEl.value || "").trim()); else setActive(activeIdx + 1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); if (open) setActive(activeIdx - 1); return; }
      if (e.key === "Escape") { if (open) { e.preventDefault(); closeSuggest(); } else { resetQuery(false); } return; }
      if (e.key === "Enter") { e.preventDefault(); if (open && activeIdx >= 0) chooseSuggest(activeIdx); else doSearch(); return; }
      if (e.key === "Tab" && open) closeSuggest();
    });

    inputEl.addEventListener("blur", function () { window.setTimeout(closeSuggest, 120); });

    /* 行動裝置的搜尋鍵清除（type=text 時不會觸發，僅為保險） */
    inputEl.addEventListener("search", function () { if (!(inputEl.value || "").trim()) resetQuery(false); });

    if (clearBtn) clearBtn.addEventListener("click", function () { resetQuery(true); });

    initVoice();
    initFab();
    renderRecent();
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

  /* ══════════ 七、背景音樂浮動開關（v66：預設靜音，絕不自動播放）══════════ */
  function initMusic() {
    var audio = $("#bgm"), btn = $("#musicBtn"), label = $("#musicLabel");
    if (!audio || !btn) { var mm = $("#music"); if (mm) mm.style.display = "none"; return; }
    /* v66：預設靜音（絕不自動播放）。只有使用者「自己按了音樂鈕」才出聲，
       並把選擇記在 localStorage，下次造訪沿用；未記錄 = 靜音。 */
    var BGM_KEY = "ssss-wedding-bgm";
    var wantOn = false;
    try { wantOn = (window.localStorage.getItem(BGM_KEY) === "on"); } catch (e) {}

    function sync() {
      var playing = !audio.paused && !audio.ended;
      btn.classList.toggle("playing", playing);
      btn.setAttribute("aria-pressed", playing ? "true" : "false");
      btn.setAttribute("aria-label", playing ? "關閉背景音樂" : "播放背景音樂");
      if (label) label.textContent = playing ? "MUSIC ON" : "MUSIC OFF";
    }
    function tryPlay() {
      try { audio.muted = false; if (!audio.volume) audio.volume = 1; var p = audio.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
    function save(on) { try { window.localStorage.setItem(BGM_KEY, on ? "on" : "off"); } catch (e) {} }

    /* 以媒體事件（真的開始／停止播放）驅動鈕的狀態，不憑自己的旗標猜測 */
    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    audio.addEventListener("ended", sync);
    btn.addEventListener("click", function () {
      if (audio.paused) { save(true); tryPlay(); } else { save(false); audio.pause(); }
      sync();
    });

    /* 只有「上次造訪已明確開啟」才嘗試續播；被瀏覽器阻擋就維持靜音。 */
    if (wantOn) tryPlay();
    sync();
  }

  /* ══════════ 七之二、名單來源：問卷回覆（v67 多層讀取）══════════
     目標：不需手動替換 js/seating-data.js，即可自動使用問卷回覆的名單。

     流程：
       1) 若 localStorage 有未過期的快取名單 → 先立即用快取繪製（秒開）。
       2) 依序嘗試：試算表 gviz → 試算表 CSV → Apps Script JSON；
          成功 → 重繪並更新快取。
       3) 全部失敗／逾時 → 維持目前名單（快取或 js/seating-data.js 備援），
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

  /* ── CSV 解析（支援引號、逗號、換行）── */
  function parseCSV(text) {
    var rows = [], row = [], cur = "", inQ = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text.charAt(i);
      if (inQ) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ",") { row.push(cur); cur = ""; }
        else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
        else if (c === "\r") { /* 略過 */ }
        else cur += c;
      }
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  /* ── gviz JSON → 二維陣列（含欄名標題列）── */
  function parseGviz(text) {
    var s = String(text || "");
    var i = s.indexOf("{");
    if (i < 0) return null;
    var json;
    try { json = JSON.parse(s.slice(i)); } catch (e) { return null; }
    if (!json || !json.table || !Array.isArray(json.table.cols)) return null;
    var cols = json.table.cols;
    var header = cols.map(function (c) { return String((c && c.label) || "").trim(); });
    var rows = [header];
    var raw = json.table.rows || [];
    for (var r = 0; r < raw.length; r++) {
      var cells = (raw[r] && raw[r].c) || [];
      var row = [];
      for (var c2 = 0; c2 < cols.length; c2++) {
        var cell = cells[c2];
        var v = (cell && cell.v != null) ? cell.v : "";
        row.push(v == null ? "" : String(v));
      }
      rows.push(row);
    }
    return rows;
  }

  /* ── 欄位解析（與 Apps Script 端同邏輯）── */
  function resolveCol(headerRow, spec) {
    if (!spec) return -1;
    var i, a, c;
    if (spec.header) { i = headerRow.indexOf(spec.header); if (i >= 0) return i; }
    var aliases = spec.aliases || [];
    for (a = 0; a < aliases.length; a++) { i = headerRow.indexOf(aliases[a]); if (i >= 0) return i; }
    for (a = 0; a < aliases.length; a++) {
      for (c = 0; c < headerRow.length; c++) {
        if (headerRow[c] && headerRow[c].indexOf(aliases[a]) >= 0) return c;
      }
    }
    var idx = parseInt(spec.index, 10);
    if (!isNaN(idx) && idx > 0) return idx - 1;
    return -1;
  }

  function cellOf(row, i) {
    if (i < 0 || i >= row.length) return "";
    var v = row[i];
    return v == null ? "" : String(v).trim();
  }

  function isAttendNo(v) {
    var s = String(v == null ? "" : v).trim();
    var list = CFG.ATTEND_NO_VALUES || ["不克出席", "不出席", "否", "No", "no", "N", "n", "無法出席"];
    for (var i = 0; i < list.length; i++) { if (s === list[i]) return true; }
    return false;
  }

  /* ── 由試算表列（CSV 或 gviz 轉出的二維陣列）建立賓客名單 ── */
  function guestsFromSheet(rows) {
    if (!rows || rows.length < 2) return null;
    var header = rows[0].map(function (h) { return String(h == null ? "" : h).trim(); });
    var C = CFG.SHEET_COLS || {};
    var iName = resolveCol(header, C.name);
    if (iName < 0) return null;
    var iAttend    = resolveCol(header, C.attend);
    var iParty     = resolveCol(header, C.partySize);
    var iAdults    = resolveCol(header, C.adults);
    var iChildren  = resolveCol(header, C.children);
    var iChildSeat = resolveCol(header, C.childSeats);
    var iTable     = resolveCol(header, C.table);
    var iSeat      = resolveCol(header, C.seat);
    var iNote      = resolveCol(header, C.note);

    var list = [], unplaced = [];
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r] || [];
      var name = cellOf(row, iName);
      if (!name) continue;
      if (iAttend >= 0) {
        var at = cellOf(row, iAttend);
        if (at && isAttendNo(at)) continue;
      }
      var partySize  = intOr(cellOf(row, iParty), 0);
      var adults     = intOr(cellOf(row, iAdults), 0);
      var children   = intOr(cellOf(row, iChildren), 0);
      var childSeats = intOr(cellOf(row, iChildSeat), 0);
      if (partySize < 1) partySize = (adults + children) || 1;
      if (!adults && !children) adults = partySize;
      var tableNo = intOr(cellOf(row, iTable), 0);
      var seatNo  = intOr(cellOf(row, iSeat), 0);
      var note    = iNote >= 0 ? cellOf(row, iNote) : "";
      var valid   = (tableNo >= 1 && tableNo <= MAX_TABLES);
      var g = {
        name: name,
        table: valid ? tableNo : null,
        seat: valid ? (seatNo || 0) : null,
        partySize: partySize, adults: adults, children: children, childSeats: childSeats
      };
      if (note) g.note = note;
      if (!valid) { g.unassigned = true; unplaced.push(name); }
      list.push(g);
    }
    if (!list.length) return null;
    return { guests: list, unplaced: unplaced };
  }

  /* ── 由 Apps Script JSON 建立賓客名單（v67：含人數／兒童椅欄位）── */
  function normalizeRemote(json) {
    if (!json || typeof json !== "object") return null;
    var K = CFG.KEYS || {};
    var guests = json[K.guests || "guests"];
    if (!Array.isArray(guests)) return null;

    var unplaced = json[K.unplaced || "unplaced"];
    if (!Array.isArray(unplaced)) unplaced = [];
    unplaced = unplaced.map(function (x) { return String(x == null ? "" : x).trim(); }).filter(Boolean);

    var list = [], i;
    for (i = 0; i < guests.length; i++) {
      var g = guests[i] || {};
      var name = g.name == null ? "" : String(g.name).trim();
      if (!name) continue;
      var table = parseInt(g.table, 10);
      var seat = parseInt(g.seat, 10);
      var partySize  = intOr(g.partySize, 0);
      var adults     = intOr(g.adults, 0);
      var children   = intOr(g.children, 0);
      var childSeats = intOr(g.childSeats, 0);
      if (partySize < 1) partySize = (adults + children) || 1;
      if (!adults && !children) adults = partySize;
      var item;
      /* v64：桌號必須是「目前座位圖上存在的桌次」才算有效；
         無效／查無對應桌次／未填 → 標記為未分配（顯示「由現場人員安排」）。 */
      if (!table || isNaN(table) || !validTableNos[table]) {
        item = { name: name, table: null, seat: null, unassigned: true };
      } else {
        item = { name: name, table: table, seat: (!seat || isNaN(seat)) ? 0 : seat };
      }
      item.partySize = partySize; item.adults = adults; item.children = children; item.childSeats = childSeats;
      if (g.note) item.note = String(g.note);
      list.push(item);
    }

    /* 已回覆但尚未分配桌次者 → 同樣列為未分配，仍可被查詢 */
    for (i = 0; i < unplaced.length; i++) {
      var nm = String(unplaced[i]).replace(/（[^）]*）\s*$/, "").trim();
      if (!nm) continue;
      list.push({ name: nm, table: null, seat: null, unassigned: true, partySize: 1, adults: 1, children: 0, childSeats: 0 });
    }

    /* API 正常但試算表完全沒有可用名單 → 回報 empty，由呼叫端保留備援名單（頁面不空白） */
    if (!list.length) return { empty: true, unplaced: unplaced };

    /* v64：桌次固定沿用前端配置；API 的桌名僅併入，不改變桌數 */
    var tables = json[K.tables || "tables"];
    return { guests: list, unplaced: unplaced, tables: tables };
  }

  /* ── 固定桌次（沿用前端 BASE_TABLES，16 桌）── */
  function fixedTables(remoteTables) {
    var names = {};
    if (Array.isArray(remoteTables)) {
      for (var i = 0; i < remoteTables.length; i++) {
        var tb = remoteTables[i] || {};
        var no = parseInt(tb.no, 10);
        if (no && !isNaN(no) && tb.name) names[no] = String(tb.name);
      }
    }
    var out = [];
    for (var j = 0; j < BASE_TABLES.length; j++) {
      var bt = BASE_TABLES[j] || {};
      var bno = parseInt(bt.no, 10);
      var rec = { no: bno, name: names[bno] || bt.name || "" };
      if (bt.seats) rec.seats = bt.seats;
      if (bt.side) rec.side = bt.side;
      if (bt.main) rec.main = true;
      out.push(rec);
    }
    return out;
  }

  function buildData(res) {
    return {
      VENUE: BASE_VENUE,
      TABLES: fixedTables(res.tables),
      GUESTS: res.guests,
      OPTIONS: BASE_OPTIONS
    };
  }

  /* ── 網路取文字（含逾時）── */
  function fetchText(url, timeout) {
    return new Promise(function (resolve, reject) {
      var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
      var timer = window.setTimeout(function () {
        if (ctrl) { try { ctrl.abort(); } catch (e) {} }
        reject(new Error("timeout"));
      }, timeout);
      fetch(url, { method: "GET", cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) {
          if (!r.ok) { throw new Error("HTTP " + r.status); }
          return r.text();
        })
        .then(function (t) { window.clearTimeout(timer); resolve(t); })
        .catch(function (e) { window.clearTimeout(timer); reject(e); });
    });
  }

  /* ── 依序嘗試各來源：gviz → CSV → Apps Script ── */
  function trySources(done) {
    var gvizUrl = String(CFG.SHEET_GVIZ_URL || "");
    var csvUrl  = String(CFG.SHEET_CSV_URL || "");
    var apiUrl  = String(CFG.API_URL || "");
    var timeout = parseInt(CFG.API_TIMEOUT_MS, 10) || 20000;

    function fromGviz() {
      if (!/^https?:\/\//i.test(gvizUrl)) return Promise.reject(new Error("no gviz url"));
      return fetchText(gvizUrl, timeout).then(function (text) {
        var res = guestsFromSheet(parseGviz(text));
        if (!res) throw new Error("bad gviz");
        return res;
      });
    }
    function fromCsv() {
      if (!/^https?:\/\//i.test(csvUrl)) return Promise.reject(new Error("no csv url"));
      return fetchText(csvUrl, timeout).then(function (text) {
        var res = guestsFromSheet(parseCSV(text));
        if (!res) throw new Error("bad csv");
        return res;
      });
    }
    function fromApi() {
      if (!/^https?:\/\//i.test(apiUrl)) return Promise.reject(new Error("no api url"));
      return fetchText(apiUrl, timeout).then(function (text) {
        var json = JSON.parse(text);
        if (json && json.ok === false) throw new Error(json.error || "api error");
        var res = normalizeRemote(json);
        if (!res) throw new Error("bad format");
        return res;
      });
    }

    fromGviz()
      .catch(function () { return fromCsv(); })
      .catch(function () { return fromApi(); })
      .then(function (res) {
        if (!res || res.empty) { done(false); return; }
        var data = buildData(res);
        writeCache(data);
        applyData(data, null, "live");   /* v64：成功時不顯示狀態文字 */
        if (retryTimer) { window.clearInterval(retryTimer); retryTimer = null; }
        done(true);
      })
      .catch(function () { done(false); });
  }

  /* 套用新名單並重繪（搜尋事件不會重複綁定）。
     v64：statusText 為空時「不」顯示狀態文字（成功取得名單時不再顯示「已連線 X 位賓客」）。 */
  function applyData(next, statusText, kind) {
    DATA = next;
    deriveAll();
    if (resultBox) { resultBox.className = "seat-result"; resultBox.innerHTML = ""; }
    buildMap();
    /* v65：每桌人數上限提示（僅在偵測到超額時顯示） */
    var overflow = GUESTS.filter(function (g) { return !!g.overflow; }).length;
    if (capacityEl) {
      if (overflow > 0) { capacityEl.textContent = fmtN(capacityText, overflow); capacityEl.hidden = false; }
      else { capacityEl.textContent = ""; capacityEl.hidden = true; }
    }
    if (window.seatingPage) {
      window.seatingPage.tables = Object.keys(tableNodes).map(Number);
      window.seatingPage.guests = GUESTS.length;
      window.seatingPage.unassigned = GUESTS.filter(function (g) { return !!g.unassigned; }).length;
      window.seatingPage.overflow = overflow;
    }
    if (statusText) setStatus(fmtN(statusText, GUESTS.length), kind);
  }

  var retryTimer = null;

  function startRetry() {
    var ms = parseInt(CFG.RETRY_MS, 10) || 0;
    if (ms <= 0 || retryTimer) return;
    retryTimer = window.setInterval(function () {
      trySources(function () {});   /* 靜默重試，成功後自動停掉 */
    }, ms);
  }

  function loadRemote() {
    var cached = readCache();
    if (cached) {
      applyData(cached, null, "cached");     /* 先秒開，再更新（不顯示狀態文字） */
    }
    trySources(function (ok) {
      if (!ok) {
        setStatus(fmtN(CFG.TEXT_FALLBACK, GUESTS.length), "fallback");
        startRetry();
      }
    });
  }

  /* ══════════ 八、啟動 ══════════ */
  function boot() {
    statusEl = document.getElementById((CFG.STATUS_ID || "seatDataStatus"));
    capacityEl = document.getElementById("seatCapacity");
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
      find: findMatches,
      data: function () { return { VENUE: VENUE, TABLES: TABLES, GUESTS: GUESTS, OPTIONS: OPT }; },
      childSeatsAt: childSeatsAtTable,
      /* v70：供自動化驗證計算「整團弧線」路徑，以便確認弧線只落在該團座位之間 */
      arcPath: partyArcPath
    };

    /* v62：已設定來源 → 載入問卷回覆名單；未設定 → 明確提示目前使用備援名單。 */
    var hasGviz = /^https?:\/\//i.test(String(CFG.SHEET_GVIZ_URL || ""));
    var hasCsv  = /^https?:\/\//i.test(String(CFG.SHEET_CSV_URL || ""));
    var hasApi  = /^https?:\/\//i.test(String(CFG.API_URL || ""));
    if (hasGviz || hasCsv || hasApi) {
      loadRemote();
    } else {
      setStatus(CFG.TEXT_LOCAL, "local");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
