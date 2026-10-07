/**
 * 三生三世・緣定今生 ── 座位表名單 ← 問卷回覆 Google 試算表（Google Apps Script Web App）
 *
 * 功能：
 *   doGet() → 讀取「問卷回覆」試算表的姓名 / 桌次 / 座位欄位，輸出 JSON；
 *             座位表頁面（seating.html）以 fetch 取得此 JSON 後自動繪製座位圖與查詢功能。
 *
 * 與 rsvp-to-sheet.gs 的關係：
 *   本檔是「唯讀」端點（只讀試算表、不寫入，也不會寄信），可與 rsvp-to-sheet.gs
 *   指向同一個試算表（預設即是）。兩者可以放在同一個 Apps Script 專案中（各自 doGet 會衝突，
 *   請用「不同專案」部署；詳見下方部署步驟 B），或依需要分別部署。
 *
 * ★ 欄位對應（COL_*）預設已填入本專案實際使用的問卷標題：
 *     「您的姓名」→ 姓名；「桌次」→ 桌次；「座位」→ 座位；「備註」→ 備註
 *   若你的問卷標題不同，只要改下方 COL_*.header / COL_*.aliases 即可，不需改程式邏輯。
 *   若連欄名都不確定，可只設 COL_*.index（第幾欄，從 1 起算）強制以欄位位置取值。
 *
 * 部署步驟（詳見 v61 變更紀錄 CHANGES-v61.md）：
 *   A. 開啟問卷回覆試算表 → 擴充功能 → Apps Script → 貼上本檔 → 儲存。
 *   B. 部署 → 新增部署 → 類型「網頁應用程式」→ 執行身分「我」→
 *      誰可以存取「所有人」→ 部署 → 複製結尾為 /exec 的網址（不是 /dev）。
 *   C. 把該 /exec 網址填入 js/seating-config.js 的 API_URL，然後重新部署網站。
 *   D. 驗證：用瀏覽器開啟 /exec 網址，應看到 {"ok":true,...} 的 JSON。
 */

/* ── 1. 試算表設定 ─────────────────────────────────────────────── */

/** 問卷回覆試算表 ID（留空 = 使用本腳本所綁定的試算表） */
var SPREADSHEET_ID = '1oxlmhFgKS93pIWfRInJF0AXqpXRLxeU8v5ZJCnZFpW0';
/** 工作表名稱（留空 = 第一個工作表） */
var SHEET_NAME = '';
/** 標題列在第幾列（1 起算） */
var HEADER_ROW = 1;
/** 試算表為空時是否自動補上標題列（唯讀端點建議保持 false，避免動到你的資料） */
var AUTO_HEADER = false;

/* ── 2. 欄位對應（★ 需要調整時只改這一區） ─────────────────────── */

/**
 * 每個欄位有三種指定方式，解析順序為：
 *   1) header  ── 標題列完全相符的欄名（最推薦，最不易錯）
 *   2) aliases ── 別名清單：先找完全相符，再找「標題包含別名」
 *   3) index   ── 最後手段：第幾欄（從 1 起算；0 或省略 = 不使用）
 */
var COL_NAME = {
  header: '您的姓名',
  aliases: ['姓名', '您的姓名', '大名', '名字', 'name'],
  index: 0
};

var COL_TABLE = {
  header: '桌次',
  aliases: ['桌次', '桌號', '第幾桌', '桌', 'table', 'tableNo'],
  index: 0
};

var COL_SEAT = {
  header: '座位',
  aliases: ['座位', '座位號', '座位號碼', '座號', '第幾位', 'seat', 'seatNo'],
  index: 0
};

var COL_NOTE = {
  header: '備註',
  aliases: ['備註', '註記', '備注', 'note', 'remark'],
  index: 0
};

/** 出席欄位（用來篩掉「不克出席」的回覆；設 header/index 為空則不篩選） */
var COL_ATTEND = {
  header: '是否能出席本次盛宴',
  aliases: ['是否能出席本次盛宴', '是否出席', '出席', 'attend'],
  index: 0
};
/** true = 只列入會出席的賓客；false = 全部列入 */
var ONLY_ATTENDING = true;
/** 視為「不克出席」的字串（會從名單剔除） */
var ATTEND_NO_VALUES = ['不克出席', '不出席', '否', 'No', 'no', 'N', 'n', '無法出席'];

/* ── 3. 場地（可選）──────────────────────────────────────────────
   留空物件 = 沿用前端 js/seating-data.js 的 VENUE（建議）。
   若要由試算表驅動場地，填入下列其中幾項即可，未填的沿用前端設定。 */
var VENUE_OVERRIDE = {
  /* tablesPerSide: 8,
     seatsPerTable: 10,
     aisleWidthPct: 13,
     labels: { stage: '舞台', aisle: '紅毯步道', leftSide: '左側', rightSide: '右側' } */
};

/* ── 4. 輸出設定 ───────────────────────────────────────────────── */

var ENDPOINT_VERSION = 'seating-v61';
/** 伺服器端快取秒數（同一次瀏覽期間內重複請求不會一直讀試算表） */
var CACHE_SECONDS = 60;
/** 輸出時是否同時附上統計資訊（方便診斷） */
var INCLUDE_STATS = true;

/* ══════════════════════════════════════════════════════════════════
   doGet：回傳座位表 JSON
   → GET /exec                      純 JSON
   → GET /exec?format=health        只回健康檢查
   → GET /exec?callback=fn          JSONP（若某些環境 CORS 受限時可用）
   ══════════════════════════════════════════════════════════════════ */
function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};

  var payload;
  try {
    payload = CACHE_SECONDS > 0 ? readCached_() : null;
    if (!payload) {
      payload = buildPayload_();
      if (CACHE_SECONDS > 0) writeCache_(payload);
    }
  } catch (err) {
    payload = {
      ok: false,
      version: ENDPOINT_VERSION,
      error: String(err && err.message ? err.message : err),
      tables: [],
      guests: [],
      unplaced: []
    };
  }

  if (p.format === 'health') {
    return json_({
      ok: payload.ok === true,
      version: ENDPOINT_VERSION,
      guests: (payload.guests || []).length,
      updatedAt: payload.updatedAt || '',
      error: payload.error || ''
    });
  }

  /* JSONP：callback=函式名（限定英數字與 _ . 以避免注入） */
  if (p.callback && /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/.test(p.callback)) {
    return ContentService
      .createTextOutput(p.callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return json_(payload);
}

/* ══════════════════════════════════════════════════════════════════
   內部：組出座位表資料
   ══════════════════════════════════════════════════════════════════ */
function buildPayload_() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(1, sheet.getLastColumn());

  if (lastRow < HEADER_ROW) {
    return { ok: true, version: ENDPOINT_VERSION, updatedAt: nowIso_(), guests: [], tables: [], stats: { raw: 0, placed: 0, skipped: 0 } };
  }

  var headerRow = sheet.getRange(HEADER_ROW, 1, 1, lastCol)
    .getValues()[0]
    .map(function (h) { return String(h == null ? '' : h).trim(); });

  var iName = resolveCol_(headerRow, COL_NAME);
  var iTable = resolveCol_(headerRow, COL_TABLE);
  var iSeat = resolveCol_(headerRow, COL_SEAT);
  var iNote = resolveCol_(headerRow, COL_NOTE);
  var iAttend = resolveCol_(headerRow, COL_ATTEND);

  if (iName < 0) {
    throw new Error('找不到「姓名」欄位，請檢查 COL_NAME.header 或 COL_NAME.index（目前標題列：' + headerRow.join(' / ') + '）');
  }

  var dataRows = lastRow - HEADER_ROW;
  var guests = [];
  var unplaced = [];   /* 已回覆但尚未分配桌次的姓名（不進座位圖，但會在 payload 中列出） */
  var skipped = 0;
  var raw = 0;

  if (dataRows > 0) {
    var values = sheet.getRange(HEADER_ROW + 1, 1, dataRows, lastCol).getValues();
    for (var r = 0; r < values.length; r++) {
      var row = values[r];
      raw++;

      var name = cell_(row, iName);
      if (!name) { skipped++; continue; }

      /* 出席與否 */
      if (ONLY_ATTENDING && iAttend >= 0) {
        var attend = cell_(row, iAttend);
        if (attend && isAttendNo_(attend)) { skipped++; continue; }
      }

      var tableNo = toTableNo_(cell_(row, iTable));
      var seatNo = toSeatNo_(cell_(row, iSeat));
      var note0 = iNote >= 0 ? cell_(row, iNote) : '';

      /* 座位圖只能容納已分配桌次的賓客；未填桌次者不放入圖中，
         但仍會列在「尚未分配桌次」名單裡（見 unplaced），不會被默默丟掉。 */
      if (!tableNo) { unplaced.push(name + (note0 ? '（' + note0 + '）' : '')); continue; }

      var g = { name: name, table: tableNo, seat: seatNo || 1 };
      if (note0) { g.note = note0; }
      guests.push(g);
    }
  }

  /* 依桌次、座位排序，讓輸出穩定 */
  guests.sort(function (a, b) {
    return Number(a.table) - Number(b.table) || Number(a.seat) - Number(b.seat) || String(a.name).localeCompare(String(b.name));
  });

  /* 依實際出現的桌號產生 TABLES（桌名可在試算表另設欄位後自行擴充） */
  var tables = buildTables_(guests);

  var payload = {
    ok: true,
    version: ENDPOINT_VERSION,
    updatedAt: nowIso_(),
    source: 'google-sheet',
    sheetName: sheet.getName(),
    headerRow: headerRow,
    map: {
      name: iName >= 0 ? headerRow[iName] : null,
      table: iTable >= 0 ? headerRow[iTable] : null,
      seat: iSeat >= 0 ? headerRow[iSeat] : null,
      note: iNote >= 0 ? headerRow[iNote] : null,
      attend: iAttend >= 0 ? headerRow[iAttend] : null
    },
    tables: tables,
    guests: guests
  };

  if (unplaced.length) { payload.unplaced = unplaced; }

  if (Object.keys(VENUE_OVERRIDE).length) { payload.venue = VENUE_OVERRIDE; }

  if (INCLUDE_STATS) {
    payload.stats = {
      raw: raw,
      placed: guests.length,
      unplaced: unplaced.length,
      skipped: skipped,
      tables: tables.length
    };
  }
  return payload;
}

/** 依賓客實際佔用的桌號產生桌次清單（維持 1..N 連續，缺號也保留） */
function buildTables_(guests) {
  var maxNo = 0;
  for (var i = 0; i < guests.length; i++) {
    var n = Number(guests[i].table) || 0;
    if (n > maxNo) maxNo = n;
  }
  var out = [];
  for (var t = 1; t <= maxNo; t++) { out.push({ no: t, name: '' }); }
  return out;
}

/* ── 欄位解析 ─────────────────────────────────────────────────── */
function resolveCol_(headerRow, spec) {
  if (!spec) { return -1; }
  var i;

  /* 1) 指定欄名（完全相符） */
  if (spec.header) {
    i = headerRow.indexOf(spec.header);
    if (i >= 0) { return i; }
  }

  /* 2) 別名（先完全相符，再允許「標題包含別名」） */
  var aliases = spec.aliases || [];
  var a, j, c;
  for (a = 0; a < aliases.length; a++) {
    j = headerRow.indexOf(aliases[a]);
    if (j >= 0) { return j; }
  }
  for (a = 0; a < aliases.length; a++) {
    for (c = 0; c < headerRow.length; c++) {
      if (headerRow[c] && headerRow[c].indexOf(aliases[a]) >= 0) { return c; }
    }
  }

  /* 3) 以欄位位置取值（1 起算） */
  var idx = parseInt(spec.index, 10);
  if (!isNaN(idx) && idx > 0) { return idx - 1; }

  return -1;
}

/** 取得某一列某一欄的字串（欄位不存在時回傳空字串） */
function cell_(row, i) {
  if (i < 0 || i >= row.length) { return ''; }
  var v = row[i];
  if (v == null) { return ''; }
  if (v instanceof Date) { return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
  return String(v).trim();
}

function isAttendNo_(v) {
  var s = String(v == null ? '' : v).trim();
  for (var i = 0; i < ATTEND_NO_VALUES.length; i++) {
    if (s === ATTEND_NO_VALUES[i]) { return true; }
  }
  return false;
}

/** 「5」「5桌」「第5桌」「table 5」→ 5；無法解析回傳 0 */
function toTableNo_(v) {
  return firstInt_(v);
}

/** 「6」「第6位」「6號」→ 6；無法解析回傳 0 */
function toSeatNo_(v) {
  return firstInt_(v);
}

function firstInt_(v) {
  var s = String(v == null ? '' : v);
  var m = s.match(/\d+/);
  if (!m) { return 0; }
  var n = parseInt(m[0], 10);
  return isNaN(n) ? 0 : n;
}

/* ── 試算表存取 ────────────────────────────────────────────────── */
function getSheet_() {
  var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID)
                          : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) { throw new Error('找不到試算表，請在 SPREADSHEET_ID 填入試算表 ID。'); }
  if (SHEET_NAME) {
    var named = ss.getSheetByName(SHEET_NAME);
    if (named) { return named; }
    throw new Error('找不到工作表：' + SHEET_NAME);
  }
  return ss.getSheets()[0];
}

/* ── 伺服器端快取（降低讀取次數） ─────────────────────────────── */
function cacheKey_() {
  return 'seating-' + SPREADSHEET_ID + '-' + SHEET_NAME + '-' + HEADER_ROW;
}

function readCached_() {
  try {
    var raw = CacheService.getScriptCache().get(cacheKey_());
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function writeCache_(payload) {
  try {
    var s = JSON.stringify(payload);
    /* CacheService 單一鍵值上限約 100KB；超過就放棄快取，不影響輸出 */
    if (s.length < 95000) { CacheService.getScriptCache().put(cacheKey_(), s, CACHE_SECONDS); }
  } catch (e) {}
}

/* ── 小工具 ───────────────────────────────────────────────────── */
function nowIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
