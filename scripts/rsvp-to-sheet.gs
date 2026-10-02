/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  出席回覆（RSVP）自動寫入 Google 試算表 — Google Apps Script Web App (doPost)
 *  婚禮網站：https://jack25860.github.io/jack-and-lily-wedding/
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 【這個腳本做什麼】
 *   婚禮網站的「出席回覆」表單送出後，前端會把填寫內容 POST 到本腳本，
 *   本腳本會把資料「依序往下寫入」指定試算表，並自動產生序號（1、2、3…）。
 *
 * 【欄位順序】（與試算表標題列完全一致）
 *   A 序號 | B 您的姓名 | C 您的信箱 | D 您是哪一方的賓客 | E 與新人的關係
 *   F 是否能出席本次盛宴 | G 出席人數 | H 出席大人人數 | I 出席兒童人數 | J 需要兒童椅數量
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 【一次性安裝步驟 — 約 5 分鐘】
 *
 * 1. 開啟你的回覆試算表：
 *    https://docs.google.com/spreadsheets/d/1oxlmhFgKS93pIWfRInJF0AXqpXRLxeU8v5ZJCnZFpW0/edit
 *    → 上方選單「擴充功能 (Extensions)」→「Apps Script」
 *
 * 2. 刪除編輯器裡預設的程式碼，把本檔案「全部內容」貼上，按 💾 儲存。
 *    ※ 若腳本是從試算表直接開啟的，下方 SPREADSHEET_ID 可留空（會自動使用本試算表）。
 *
 * 3. 右上角「部署 (Deploy)」→「新增部署 (New deployment)」
 *      · 類型：選「網頁應用程式 (Web app)」
 *      · 說明：RSVP 寫入
 *      · 執行身分 (Execute as)：**我 (Me)**
 *      · 具有存取權的使用者 (Who has access)：**所有人 (Anyone)**
 *      → 按「部署」，並在跳出的視窗「授予存取權」完成授權（選你的帳號 → 進階 → 前往… → 允許）
 *
 * 4. 複製產生的「網頁應用程式網址」，它長這樣：
 *    https://script.google.com/macros/s/AKfycb................/exec
 *    ⚠️ 一定要是結尾是「/exec」的那一串（不是結尾 /dev）。
 *
 * 5. 把該網址填進網站設定檔 js/config.js 的 SHEET_WEBAPP_URL：
 *    SHEET_WEBAPP_URL:"https://script.google.com/macros/s/AKfycb......../exec",
 *    儲存後重新部署網站即可。
 *
 * ※ 驗證：在瀏覽器直接開啟該 /exec 網址，若出現「RSVP endpoint is running.」表示部署成功。
 * ※ 之後若修改本腳本，需「管理部署」→ 編輯 → 版本選「新版本」→ 部署，網址才會生效。
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/** 試算表 ID（留空 = 使用「本腳本所綁定的試算表」）。若為獨立腳本，請填入 ID。 */
var SPREADSHEET_ID = '';

/** 工作表名稱（留空 = 使用第一個工作表）。 */
var SHEET_NAME = '';

/** 標題列在第幾列。 */
var HEADER_ROW = 1;

/** 是否在寫入前自動補上標題列（當工作表為空時）。 */
var AUTO_HEADER = true;

/** 序號從幾號開始。 */
var START_NO = 1;

/** 寫入時要忽略的前端欄位（不出現在試算表欄位中的輔助欄位）。 */
var IGNORED_KEYS = [];

/** 標題列（同時決定欄位順序）。 */
var HEADERS = [
  '序號',
  '您的姓名',
  '您的信箱',
  '您是哪一方的賓客',
  '與新人的關係',
  '是否能出席本次盛宴',
  '出席人數',
  '出席大人人數',
  '出席兒童人數',
  '需要兒童椅數量'
];

/* ═══════════════════════════════════════════════════════════════════════════
   以下不需修改
   ═══════════════════════════════════════════════════════════════════════════ */

/** GET：用瀏覽器開啟 /exec 時的健康檢查。 */
function doGet() {
  return ContentService
    .createTextOutput('RSVP endpoint is running.')
    .setMimeType(ContentService.MimeType.TEXT);
}

/** POST：前端送出的 JSON → 寫入試算表。 */
function doPost(e) {
  try {
    var data = parseIncoming_(e);

    var lock = LockService.getScriptLock();
    lock.waitLock(20000); // 併發送出時排隊，避免兩筆搶到同一個序號
    try {
      var sheet = getSheet_();
      ensureHeader_(sheet);

      var row = buildRow_(sheet, data);
      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** 解析前端送來的內容（支援 JSON 與一般表單編碼）。 */
function parseIncoming_(e) {
  var data = {};

  if (e && e.postData && e.postData.contents) {
    var raw = e.postData.contents;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      data = {};
    }
  }

  // 兼容 application/x-www-form-urlencoded 或 FormSubmit 風格的繞送
  if (e && e.parameter) {
    for (var k in e.parameter) {
      if (!Object.prototype.hasOwnProperty.call(data, k) || data[k] === '' || data[k] == null) {
        data[k] = e.parameter[k];
      }
    }
  }

  if (typeof data === 'string') {
    data = {};
  }
  return data || {};
}

function getSheet_() {
  var ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('找不到試算表，請在 SPREADSHEET_ID 填入試算表 ID。');
  }
  if (SHEET_NAME) {
    var named = ss.getSheetByName(SHEET_NAME);
    if (named) return named;
  }
  return ss.getSheets()[0];
}

/** 工作表若為空，補上標題列。 */
function ensureHeader_(sheet) {
  if (!AUTO_HEADER) return;
  if (sheet.getLastRow() === 0) {
    sheet.getRange(HEADER_ROW, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

/**
 * 組出要寫入的一列：
 * 序號 = 資料列數 + 起始值（第一筆為 1，之後自動 +1）
 */
function buildRow_(sheet, data) {
  var values = mapFields_(data);
  var nextNo = nextSerial_(sheet);
  var row = [];
  for (var i = 0; i < HEADERS.length; i++) {
    if (HEADERS[i] === '序號') {
      row.push(nextNo);
    } else {
      row.push(values[HEADERS[i]] == null ? '' : values[HEADERS[i]]);
    }
  }
  return row;
}

/** 序號：既有資料筆數（不含標題列）+ 起始值。 */
function nextSerial_(sheet) {
  var last = sheet.getLastRow();
  var dataRows = last >= HEADER_ROW ? last - HEADER_ROW : 0;
  return START_NO + dataRows;
}

/** 前端欄位 → 試算表欄位值。 */
function mapFields_(data) {
  var attend = pick_(data, ['attend', '是否能出席本次盛宴', 'ATTEND']);
  var attending = attend !== '不克出席';

  var adults = attending ? toInt_(pick_(data, ['adults', '出席大人人數', 'ADULTS'])) : 0;
  var children = attending ? toInt_(pick_(data, ['children', '出席兒童人數', 'CHILDREN'])) : 0;
  var chairs = attending ? toInt_(pick_(data, ['chairs', '需要兒童椅數量', 'CHAIRS'])) : 0;

  var guests = pick_(data, ['guests', '出席人數', 'GUESTS']);
  if (guests === '' || guests == null) {
    guests = attending ? adults + children : 0;
  }

  var out = {};
  out['您的姓名'] = pick_(data, ['name', '您的姓名', 'NAME']);
  out['您的信箱'] = pick_(data, ['email', '您的信箱', 'EMAIL']);
  out['您是哪一方的賓客'] = pick_(data, ['side', '您是哪一方的賓客', 'SIDE']);
  out['與新人的關係'] = pick_(data, ['relation', '與新人的關係', 'RELATION']);
  out['是否能出席本次盛宴'] = attend;
  out['出席人數'] = guests;
  out['出席大人人數'] = attending ? adults : '';
  out['出席兒童人數'] = attending ? children : '';
  out['需要兒童椅數量'] = attending ? chairs : '';

  // 自訂欄位（若你之後在 HEADERS 增加欄位，前端同名欄位會自動帶入）
  for (var k in data) {
    if (IGNORED_KEYS.indexOf(k) !== -1) continue;
    if (!out[k]) out[k] = data[k];
  }
  return out;
}

function pick_(obj, keys) {
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (obj && obj[k] != null && String(obj[k]).trim() !== '') {
      return String(obj[k]).trim();
    }
  }
  return '';
}

function toInt_(v) {
  var n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
