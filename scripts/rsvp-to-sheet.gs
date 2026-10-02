/**
 * 三生三世・緣定今生 — RSVP 寫入 + 電子喜帖寄送（Google Apps Script Web App）
 *
 * 功能：
 *   1) RSVP 回覆 → 依序寫入 Google 試算表（序號自動 +1）
 *   2) 電子喜帖 → 以 HTML 信件寄出，圖片「內嵌」於信件中（非連結）
 *
 * 部署：擴充功能 → Apps Script → 貼上本檔 → 部署 → 新增部署 →
 *       類型「網頁應用程式」→ 執行身分「我」→ 存取權「所有人」→ 取得 /exec 網址
 */

/** 試算表 ID（留空 = 使用本腳本所綁定的試算表） */
var SPREADSHEET_ID = '1oxlmhFgKS93pIWfRInJF0AXqpXRLxeU8v5ZJCnZFpW0';
var SHEET_NAME = '';        // 留空 = 第一個工作表
var HEADER_ROW = 1;
var AUTO_HEADER = true;     // 工作表為空時自動補標題列
var START_NO = 1;           // 序號起始值
var IGNORED_KEYS = [];

/** 標題列（同時決定欄位順序） */
var HEADERS = ['序號', '您的姓名', '您的信箱', '您是哪一方的賓客', '與新人的關係',
  '是否能出席本次盛宴', '出席人數', '出席大人人數', '出席兒童人數', '需要兒童椅數量'];

/** 電子喜帖寄件者顯示名稱 */
/** 婚禮網站域名（用於將相對路徑轉成絕對網址） */
var SITE_BASE = 'https://jack25860.github.io/jack-and-lily-wedding/';

var ECARD_SENDER_NAME = '三生三世・緣定今生';

/** 電子喜帖影片網址（留空 = 以圖片代替；填入後信件會自動改為可點擊的影片縮圖） */
var ECARD_VIDEO_URL = '';
/** 電子喜帖影片示意圖（影片尚未提供時顯示） */
var ECARD_VIDEO_POSTER = 'images/tl1.jpg';

/** 電子喜帖隨機婚紗照池：涵蓋相簿全部照片（戰國 39 + 唐代 47 + 明朝 56 = 142）
 *  前端會從 js/config.js 的 ECARD_PHOTO_POOL 隨機選一張並以 photo 傳入；
 *  若前端未傳入 photo，本腳本會從此清單自行隨機挑選，確保雙方一致。 */
var ECARD_PHOTO_POOL = [
  // 戰國 WARRING STATES (39)
  'images/album/zg1.jpg',
  'images/album/zg2.jpg',
  'images/album/zg3.jpg',
  'images/album/zg4.jpg',
  'images/album/zg5.jpg',
  'images/album/zg6.jpg',
  'images/album/n01.jpg',
  'images/album/n02.jpg',
  'images/album/n03.jpg',
  'images/album/n04.jpg',
  'images/album/n05.jpg',
  'images/album/n06.jpg',
  'images/album/n07.jpg',
  'images/album/n08.jpg',
  'images/album/n50.jpg',
  'images/album/n51.jpg',
  'images/album/n52.jpg',
  'images/album/n53.jpg',
  'images/album/n54.jpg',
  'images/album/n55.jpg',
  'images/album/n56.jpg',
  'images/album/n57.jpg',
  'images/album/n58.jpg',
  'images/album/n59.jpg',
  'images/album/n60.jpg',
  'images/album/n61.jpg',
  'images/album/n62.jpg',
  'images/album/n63.jpg',
  'images/album/n64.jpg',
  'images/album/n65.jpg',
  'images/album/n66.jpg',
  'images/album/n67.jpg',
  'images/album/n68.jpg',
  'images/album/n69.jpg',
  'images/album/n70.jpg',
  'images/album/n71.jpg',
  'images/album/n72.jpg',
  'images/album/n73.jpg',
  'images/album/n74.jpg',
  // 唐代 TANG DYNASTY (47)
  'images/album/tg1.jpg',
  'images/album/tg2.jpg',
  'images/album/tg3.jpg',
  'images/album/tg4.jpg',
  'images/album/tg5.jpg',
  'images/album/tg6.jpg',
  'images/album/n09.jpg',
  'images/album/n10.jpg',
  'images/album/n11.jpg',
  'images/album/n12.jpg',
  'images/album/n13.jpg',
  'images/album/n14.jpg',
  'images/album/n15.jpg',
  'images/album/n16.jpg',
  'images/album/n17.jpg',
  'images/album/n18.jpg',
  'images/album/n19.jpg',
  'images/album/n20.jpg',
  'images/album/n21.jpg',
  'images/album/n22.jpg',
  'images/album/n23.jpg',
  'images/album/n24.jpg',
  'images/album/n25.jpg',
  'images/album/n26.jpg',
  'images/album/n27.jpg',
  'images/album/n28.jpg',
  'images/album/n29.jpg',
  'images/album/n30.jpg',
  'images/album/n31.jpg',
  'images/album/n32.jpg',
  'images/album/n33.jpg',
  'images/album/n34.jpg',
  'images/album/n35.jpg',
  'images/album/n36.jpg',
  'images/album/n37.jpg',
  'images/album/n38.jpg',
  'images/album/n39.jpg',
  'images/album/n40.jpg',
  'images/album/n41.jpg',
  'images/album/n42.jpg',
  'images/album/n43.jpg',
  'images/album/n44.jpg',
  'images/album/n45.jpg',
  'images/album/n46.jpg',
  'images/album/n47.jpg',
  'images/album/n48.jpg',
  'images/album/n49.jpg',
  // 明朝 MING DYNASTY (56)
  'images/album/p01.jpg',
  'images/album/p02.jpg',
  'images/album/p03.jpg',
  'images/album/p04.jpg',
  'images/album/p05.jpg',
  'images/album/p06.jpg',
  'images/album/p07.jpg',
  'images/album/p08.jpg',
  'images/album/p09.jpg',
  'images/album/p10.jpg',
  'images/album/p11.jpg',
  'images/album/p12.jpg',
  'images/album/p13.jpg',
  'images/album/p14.jpg',
  'images/album/p15.jpg',
  'images/album/p16.jpg',
  'images/album/p17.jpg',
  'images/album/p18.jpg',
  'images/album/p19.jpg',
  'images/album/p20.jpg',
  'images/album/p21.jpg',
  'images/album/p22.jpg',
  'images/album/p23.jpg',
  'images/album/p24.jpg',
  'images/album/p25.jpg',
  'images/album/p26.jpg',
  'images/album/p27.jpg',
  'images/album/p28.jpg',
  'images/album/p29.jpg',
  'images/album/p30.jpg',
  'images/album/p31.jpg',
  'images/album/p32.jpg',
  'images/album/p33.jpg',
  'images/album/p34.jpg',
  'images/album/p35.jpg',
  'images/album/p36.jpg',
  'images/album/p37.jpg',
  'images/album/p38.jpg',
  'images/album/p39.jpg',
  'images/album/p40.jpg',
  'images/album/p41.jpg',
  'images/album/p42.jpg',
  'images/album/p43.jpg',
  'images/album/p44.jpg',
  'images/album/p45.jpg',
  'images/album/p46.jpg',
  'images/album/p47.jpg',
  'images/album/p48.jpg',
  'images/album/p49.jpg',
  'images/album/p50.jpg',
  'images/album/p51.jpg',
  'images/album/p52.jpg',
  'images/album/p53.jpg',
  'images/album/p54.jpg',
  'images/album/p55.jpg',
  'images/album/p56.jpg'
];

/** 隨機選一張婚紗照網址 */
function randomPhoto_() {
  if (!ECARD_PHOTO_POOL.length) return '';
  return ECARD_PHOTO_POOL[Math.floor(Math.random() * ECARD_PHOTO_POOL.length)];
}

var ENDPOINT_VERSION = 'v41';

/**
 * 電子喜帖去重（僅防「同一瞬間連點」造成的重複寄信）：
 * 同一收件人 + 主旨於此秒數內只寄一次。
 * v41：由 90 秒縮短為 8 秒 —— 90 秒會把「刻意連續寄送給同一人」誤判為重複點擊而擋掉；
 * 8 秒足以涵蓋連點／網路重試，且使用者送出完成後稍候即可再次寄送給同一人。
 */
var ECARD_DEDUPE_SECONDS = 8;
/** 最近一次電子喜帖寄送結果（供 doGet?diag=1 遠端診斷） */
var LAST_SEND_KEY = 'ECARD_LAST_SEND';

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  // 健康檢查：GET /exec?diag=1 → 回傳 JSON（含是否已取得 Gmail 寄信權限）
  if (p.diag) {
    return json_({
      ok: true,
      version: ENDPOINT_VERSION,
      mailScope: mailScopeOk_(),
      sender: ECARD_SENDER_NAME,
      quota: mailQuota_(),
      photoPool: ECARD_PHOTO_POOL.length,
      videoPoster: ECARD_VIDEO_POSTER,
      videoUrl: ECARD_VIDEO_URL || '',
      siteBase: SITE_BASE,
      dedupeSeconds: ECARD_DEDUPE_SECONDS,
      lastEcard: readLastSend_()
    });
  }
  return ContentService.createTextOutput('RSVP endpoint is running. ' + ENDPOINT_VERSION)
    .setMimeType(ContentService.MimeType.TEXT);
}

/** 是否已取得 Gmail 寄信權限（未授權時回傳 false，不拋錯） */
function mailScopeOk_() {
  try { MailApp.getRemainingDailyQuota(); return true; } catch (e1) {}
  try { GmailApp.getAliases(); return true; } catch (e2) {}
  return false;
}

/** 剩餘寄信配額（-1 = 無法取得，通常代表尚未授權） */
function mailQuota_() {
  try { return MailApp.getRemainingDailyQuota(); } catch (e) { return -1; }
}

/**
 * 【一次性授權用】在 Apps Script 編輯器選擇本函式並按「執行」，
 * 會跳出 Google 授權視窗（要求 Gmail 寄信權限），同意後即完成授權。
 * 授權完成後請至「部署 → 管理部署 → 編輯 → 版本：新版本 → 部署」。
 */
function testEcard() {
  var to = Session.getActiveUser().getEmail();
  var r = sendEcard_({
    to: to,
    subject: '【測試】電子喜帖寄送測試',
    greeting: '測試：',
    body: '若您收到本信，代表 Gmail 寄信權限已正確授權。',
    inviteText: '誠摯地邀請您參加本次婚禮，新郎與新娘敬上。',
    site: SITE_BASE
  });
  Logger.log(JSON.stringify(r));
  return r;
}

function doPost(e) {
  try {
    var data = parseIncoming_(e);
    if (String(data.type || '').toLowerCase() === 'ecard') {
      return json_(sendEcard_(data));
    }
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);          // 併發送出時排隊，避免搶同一個序號
    try {
      var sheet = getSheet_();
      ensureHeader_(sheet);
      sheet.appendRow(buildRow_(sheet, data));
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ------------------------------------------------------------------ *
 *  RSVP → 試算表
 * ------------------------------------------------------------------ */

function parseIncoming_(e) {
  var data = {};
  if (e && e.postData && e.postData.contents) {
    try { data = JSON.parse(e.postData.contents); } catch (err) { data = {}; }
  }
  if (e && e.parameter) {
    for (var k in e.parameter) {
      if (!Object.prototype.hasOwnProperty.call(data, k) || data[k] === '' || data[k] == null) {
        data[k] = e.parameter[k];
      }
    }
  }
  if (typeof data === 'string') data = {};
  return data || {};
}

function getSheet_() {
  var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID)
                          : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('找不到試算表，請在 SPREADSHEET_ID 填入試算表 ID。');
  if (SHEET_NAME) { var named = ss.getSheetByName(SHEET_NAME); if (named) return named; }
  return ss.getSheets()[0];
}

function ensureHeader_(sheet) {
  if (!AUTO_HEADER) return;
  if (sheet.getLastRow() === 0) {
    sheet.getRange(HEADER_ROW, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function buildRow_(sheet, data) {
  var values = mapFields_(data), nextNo = nextSerial_(sheet), row = [];
  for (var i = 0; i < HEADERS.length; i++) {
    row.push(HEADERS[i] === '序號' ? nextNo
      : (values[HEADERS[i]] == null ? '' : values[HEADERS[i]]));
  }
  return row;
}

function nextSerial_(sheet) {
  var last = sheet.getLastRow();
  var dataRows = last >= HEADER_ROW ? last - HEADER_ROW : 0;
  return START_NO + dataRows;
}

function mapFields_(data) {
  var attend = pick_(data, ['attend', '是否能出席本次盛宴', 'ATTEND']);
  var attending = attend !== '不克出席';
  var adults   = attending ? toInt_(pick_(data, ['adults', '出席大人人數', 'ADULTS'])) : 0;
  var children = attending ? toInt_(pick_(data, ['children', '出席兒童人數', 'CHILDREN'])) : 0;
  var chairs   = attending ? toInt_(pick_(data, ['chairs', '需要兒童椅數量', 'CHAIRS'])) : 0;
  var guests = pick_(data, ['guests', '出席人數', 'GUESTS']);
  if (guests === '' || guests == null) guests = attending ? adults + children : 0;

  var out = {};
  out['您的姓名']         = pick_(data, ['name', '您的姓名', 'NAME']);
  out['您的信箱']         = pick_(data, ['email', '您的信箱', 'EMAIL']);
  out['您是哪一方的賓客'] = pick_(data, ['side', '您是哪一方的賓客', 'SIDE']);
  out['與新人的關係']     = pick_(data, ['relation', '與新人的關係', 'RELATION']);
  out['是否能出席本次盛宴'] = attend;
  out['出席人數']         = guests;
  out['出席大人人數']     = attending ? adults : '';
  out['出席兒童人數']     = attending ? children : '';
  out['需要兒童椅數量']   = attending ? chairs : '';

  for (var k in data) {
    if (IGNORED_KEYS.indexOf(k) !== -1) continue;
    if (!out[k]) out[k] = data[k];
  }
  return out;
}

/* ------------------------------------------------------------------ *
 *  電子喜帖 → HTML 內嵌圖片信件
 * ------------------------------------------------------------------ */

function sendEcard_(data) {
  var to = pick_(data, ['to', 'email']);
  if (!to || to.indexOf('@') < 0) return { ok: false, error: 'invalid_recipient' };

  // 冪等性：同一收件人 + 主旨於 ECARD_DEDUPE_SECONDS 內只寄一次（避免連點重複寄信）
  var dkey = dedupeKey_(to, pick_(data, ['subject']));
  var cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e0) { cache = null; }
  if (cache && cache.get(dkey)) {
    var prev = readLastSend_();
    return { ok: true, deduped: true, inline: (prev && prev.inline != null) ? prev.inline : 0 };
  }

  var subject = pick_(data, ['subject']) || '【三生三世・緣定今生】誠摯邀請您參加我們的婚禮';
  var greeting = pick_(data, ['greeting']) || '親愛的朋友，您好：';
  var body = pick_(data, ['body']) || '誠摯地邀請您一同見證我們的婚禮。三生三世，緣定今生，期待與您相見。';
  var inviteText = pick_(data, ['inviteText']) || '誠摯地邀請您參加本次婚禮，新郎與新娘敬上。';
  var photoUrl = pick_(data, ['photo']) || randomPhoto_();
  if (photoUrl && photoUrl.indexOf('http') !== 0) photoUrl = SITE_BASE + photoUrl;
  var videoUrl = pick_(data, ['videoUrl']) || ECARD_VIDEO_URL;
  var videoPoster = pick_(data, ['videoPoster']) || ECARD_VIDEO_POSTER;
  // 修正：相對路徑（如 images/tl1.jpg）必須轉成絕對網址，否則 UrlFetchApp 抓不到圖 → 信件缺影片示意圖
  if (videoPoster && videoPoster.indexOf('http') !== 0) videoPoster = SITE_BASE + videoPoster;
  var site = pick_(data, ['site']);

  var inlineImages = {};
  var photoTag = '';
  if (photoUrl) {
    var pb = fetchBlob_(photoUrl);
    if (pb) { inlineImages['couplePhoto'] = pb; photoTag = '<img src="cid:couplePhoto" alt="婚紗照" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:2px">'; }
  }

  // 影片：目前以圖片代替；之後只要在 ECARD_VIDEO_URL 填入影片網址即可自動改為可點擊的影片縮圖
  var videoTag = '';
  if (videoUrl) {
    var vb = videoPoster ? fetchBlob_(videoPoster) : null;
    if (vb) {
      inlineImages['videoPoster'] = vb;
      videoTag = '<a href="' + esc_(videoUrl) + '" target="_blank" style="text-decoration:none">' +
        '<img src="cid:videoPoster" alt="電子喜帖影片" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:2px">' +
        '<div style="margin-top:8px;font-size:13px;color:#6E1626;letter-spacing:.08em">▶ 點此觀看電子喜帖影片</div></a>';
    } else {
      videoTag = '<a href="' + esc_(videoUrl) + '" target="_blank" style="color:#6E1626">▶ 點此觀看電子喜帖影片</a>';
    }
  } else if (videoPoster) {
    var vpb = fetchBlob_(videoPoster);
    if (vpb) {
      inlineImages['videoPoster'] = vpb;
      videoTag = '<img src="cid:videoPoster" alt="電子喜帖影片（示意圖）" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:2px">' +
        '<div style="margin-top:8px;font-size:12px;color:#8a7a5c;letter-spacing:.06em">［電子喜帖影片示意圖：目前以圖片代替，之後可替換為影片］</div>';
    }
  }

  var html = '' +
    '<div style="margin:0;padding:24px 12px;background:#f5f0e7;font-family:\'Noto Serif TC\',\'PingFang TC\',\'Microsoft JhengHei\',serif;color:#3a2a2a">' +
      '<div style="max-width:600px;margin:0 auto;background:#fffdf8;border:1px solid #C9A961;padding:28px 24px">' +
        '<div style="text-align:center;font-size:12px;letter-spacing:.4em;color:#C9A961">WEDDING INVITATION</div>' +
        '<h1 style="margin:14px 0 6px;text-align:center;font-size:22px;font-weight:400;letter-spacing:.18em;color:#6E1626">三生三世・緣定今生</h1>' +
        '<div style="width:52px;height:1px;margin:14px auto;background:#C9A961"></div>' +
        (videoTag ? '<div style="margin:18px 0">' + videoTag + '</div>' : '') +
        (photoTag ? '<div style="margin:18px 0">' + photoTag + '</div>' : '') +
        '<p style="margin:18px 0 0;font-size:15px;line-height:2;letter-spacing:.06em">' + esc_(greeting) + '</p>' +
        '<p style="margin:10px 0 0;font-size:15px;line-height:2;letter-spacing:.06em">' + esc_(body) + '</p>' +
        '<p style="margin:16px 0 0;font-size:15px;line-height:2;letter-spacing:.06em;color:#6E1626">' + esc_(inviteText) + '</p>' +
        (site ? '<p style="margin:22px 0 0;text-align:center"><a href="' + esc_(site) + '" style="display:inline-block;padding:12px 26px;background:#6E1626;color:#EFE5D2;text-decoration:none;letter-spacing:.16em;font-size:14px;border:1px solid #C9A961">前往婚禮網站</a></p>' : '') +
        '<p style="margin:24px 0 0;text-align:center;font-size:12px;color:#8a7a5c;letter-spacing:.1em">新郎與新娘 敬上</p>' +
      '</div>' +
    '</div>';

  try {
    GmailApp.sendEmail(to, subject, plainFallback_(greeting, body, inviteText, site), {
      htmlBody: html,
      name: ECARD_SENDER_NAME,
      inlineImages: inlineImages
    });
  } catch (err) {
    var msg = String(err);
    // 錯誤分類：讓前端能區分「授權未完成／配額用盡／收件者無效／其他」
    var code = 'mail_send_failed';
    if (/permission|authoriz|scope/i.test(msg)) code = 'mail_scope_missing';
    else if (/quota|limit|exceeded|too many/i.test(msg)) code = 'mail_quota_exceeded';
    else if (/invalid|not a valid|recipient/i.test(msg)) code = 'invalid_recipient';
    var fail = { ok: false, error: code, detail: msg };
    recordLastSend_(to, fail);
    return fail;
  }
  var result = { ok: true, inline: Object.keys(inlineImages).length, photo: !!photoTag, poster: !!videoTag };
  if (cache) { try { cache.put(dkey, '1', ECARD_DEDUPE_SECONDS); } catch (e2) {} }
  recordLastSend_(to, result);
  return result;
}

function plainFallback_(greeting, body, inviteText, site) {
  return greeting + '\n\n' + body + '\n\n' + inviteText + '\n\n' + (site || '') + '\n\n新郎與新娘 敬上';
}

function fetchBlob_(url) {
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;
    var blob = res.getBlob();
    var ct = blob.getContentType() || '';
    if (ct.indexOf('image/') !== 0) return null;
    return blob;
  } catch (err) {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 *  共用
 * ------------------------------------------------------------------ */

/** 去重鍵：收件人（小寫）+ 主旨前 60 字 */
function dedupeKey_(to, subject) {
  return 'ecard:' + String(to).toLowerCase() + ':' + String(subject || '').slice(0, 60);
}

/** 記錄最近一次電子喜帖寄送結果（供遠端診斷） */
function recordLastSend_(to, result) {
  try {
    PropertiesService.getScriptProperties().setProperty(LAST_SEND_KEY, JSON.stringify({
      at: new Date().toISOString(),
      to: to,
      ok: !!result.ok,
      error: result.error || '',
      inline: (result.inline != null) ? result.inline : null,
      deduped: !!result.deduped
    }));
  } catch (e) {}
}

/** 讀取最近一次電子喜帖寄送結果 */
function readLastSend_() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(LAST_SEND_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function pick_(obj, keys) {
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (obj && obj[k] != null && String(obj[k]).trim() !== '') return String(obj[k]).trim();
  }
  return '';
}
function toInt_(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
