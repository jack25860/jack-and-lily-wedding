/**
 * ============================================================================
 *  電子喜帖寄送流程 — Google Apps Script（綁定於「出席回覆」表單的回應試算表）
 * ============================================================================
 *
 * 【用途】
 *   賓客於婚禮網站「出席回覆」區塊填寫 Google 表單並留下電子信箱後，
 *   本腳本會在表單送出時自動寄送「電子喜帖邀請函」至該信箱。
 *
 * 【安裝步驟】
 *   1. 開啟 Google 表單 → 右上角「回應」→ 點綠色試算表圖示，開啟回應試算表。
 *   2. 試算表選單列：擴充功能（Extensions）→ Apps Script。
 *   3. 將本檔內容整份貼上，覆蓋預設的 Code.gs 內容。
 *   4. 修改下方 CONFIG：新人名稱、信件主旨、網站網址、喜帖圖片網址。
 *      ※ EMAIL_COLUMN / NAME_COLUMN 若你的表單欄位不同，請改成對應的標題名稱。
 *   5. 點左側「觸發條件」（時鐘圖示）→ 新增觸發條件：
 *        執行函式：onFormSubmit
 *        活動來源：來自試算表
 *        活動類型：提交表單時
 *        失敗通知：建議選「立即通知我」
 *   6. 儲存並完成授權（首次會要求 Gmail 寄信權限）。
 *
 * 【測試】
 *   於 Apps Script 編輯器選擇函式 `testSendInvitation` 並按「執行」，
 *   會寄出一封測試喜帖到 CONFIG.TEST_EMAIL。
 *
 * 【注意】
 *   - 目前尚無正式電子喜帖，ECARD_PHOTO_URL 暫以婚紗照 images/tl1.jpg 代替；
 *     正式喜帖完成後，只需更換此網址（或改為正式喜帖頁面網址）。
 *   - Google 表單需為「已收集電子信箱」的設定，腳本才能取得賓客信箱。
 * ============================================================================
 */

var CONFIG = {
  // 新人名稱（用於信件署名）
  COUPLE: 'Jack & Lily',

  // 信件主旨
  SUBJECT: '【三生三世・緣定今生】Jack ＆ Lily 誠摯邀請您',

  // 婚禮網站網址
  SITE_URL: 'https://jack25860.github.io/jack-and-lily-wedding/',

  // 電子喜帖圖片網址（目前為婚紗照暫代；正式喜帖完成後請更換）
  ECARD_PHOTO_URL: 'https://jack25860.github.io/jack-and-lily-wedding/images/tl1.jpg',

  // 表單回應試算表中的欄位標題（用來取得賓客信箱與稱謂；可留空自動判斷）
  EMAIL_COLUMN: '',   // 例：'電子信箱'；留空則自動尋找含「信箱 / email / mail」的欄位
  NAME_COLUMN: '',    // 例：'姓名'；留空則自動尋找含「姓名 / 稱謂 / name」的欄位

  // 測試用收件信箱（僅 testSendInvitation 使用）
  TEST_EMAIL: 'your-email@gmail.com'
};

/**
 * 表單提交時自動觸發。
 * 綁定於回應試算表的 installable trigger（活動類型：提交表單時）。
 */
function onFormSubmit(e) {
  var data = normalizeEvent(e);
  var email = data.email;
  var name = data.name;

  if (!email || email.indexOf('@') < 0) {
    Logger.log('此筆回應沒有可用電子信箱，略過寄送：' + JSON.stringify(data.raw));
    return;
  }

  sendInvitation(email, name);
}

/**
 * 手動測試用：寄一封喜帖到 CONFIG.TEST_EMAIL。
 */
function testSendInvitation() {
  sendInvitation(CONFIG.TEST_EMAIL, '測試賓客');
}

/**
 * 實際寄送電子喜帖。
 * @param {string} email 賓客電子信箱
 * @param {string} name  賓客稱謂（可為空）
 */
function sendInvitation(email, name) {
  var greeting = name ? ('親愛的 ' + name + '，您好：') : '親愛的朋友，您好：';

  var plainBody = [
    greeting,
    '',
    '誠摯邀請您一同見證我們的重要時刻。',
    '三生三世，緣定今生，期待與您相見。',
    '',
    '婚禮資訊',
    '  日期：2027 年 4 月 17 日（星期六）11:30',
    '  地點：饗婚婚宴館',
    '  地址：510 彰化縣員林市三條里忠孝街115號',
    '',
    '電子喜帖（示意）：' + CONFIG.ECARD_PHOTO_URL,
    '婚禮網站：' + CONFIG.SITE_URL,
    '',
    '（目前電子喜帖暫以婚紗照代替，正式喜帖將另行寄送。）',
    '',
    '— ' + CONFIG.COUPLE + ' 敬邀'
  ].join('\n');

  var htmlBody = [
    '<div style="max-width:600px;margin:0 auto;font-family:\'Noto Sans TC\',\'PingFang TC\',sans-serif;color:#3a2b28;line-height:1.9">',
    '  <div style="background:#6E1626;color:#F2E7CF;padding:26px 24px;text-align:center;border-radius:8px 8px 0 0">',
    '    <div style="font-size:13px;letter-spacing:.32em;color:#C9A961">THREE LIVES, ONE LOVE</div>',
    '    <h1 style="margin:14px 0 6px;font-size:24px;letter-spacing:.14em;font-weight:400">三生三世・緣定今生</h1>',
    '    <div style="font-size:15px;letter-spacing:.2em">' + escapeHtml(CONFIG.COUPLE) + '</div>',
    '  </div>',
    '  <div style="border:1px solid #C9A961;border-top:none;border-radius:0 0 8px 8px;padding:28px 24px;background:#FBF7EF">',
    '    <p style="margin:0 0 16px">' + escapeHtml(greeting) + '</p>',
    '    <p style="margin:0 0 16px">誠摯邀請您一同見證我們的重要時刻。<br>三生三世，緣定今生，期待與您相見。</p>',
    '    <p style="margin:0 0 6px"><strong>婚禮資訊</strong></p>',
    '    <p style="margin:0 0 18px">日期：2027 年 4 月 17 日（星期六）11:30<br>地點：饗婚婚宴館<br>地址：510 彰化縣員林市三條里忠孝街115號</p>',
    '    <div style="text-align:center;margin:0 0 18px">',
    '      <img src="' + escapeAttr(CONFIG.ECARD_PHOTO_URL) + '" alt="電子喜帖示意圖" style="max-width:100%;height:auto;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.18)">',
    '      <div style="font-size:12px;color:#8a7d78;margin-top:8px">［電子喜帖示意圖：暫以婚紗照代替，正式喜帖待提供］</div>',
    '    </div>',
    '    <div style="text-align:center;margin:22px 0">',
    '      <a href="' + escapeAttr(CONFIG.SITE_URL) + '" style="display:inline-block;background:#6E1626;color:#F2E7CF;text-decoration:none;padding:12px 28px;border-radius:100px;letter-spacing:.14em;font-size:14px">前往婚禮網站</a>',
    '    </div>',
    '    <p style="margin:0;font-size:13px;color:#8a7d78">— ' + escapeHtml(CONFIG.COUPLE) + ' 敬邀</p>',
    '  </div>',
    '</div>'
  ].join('\n');

  MailApp.sendEmail({
    to: email,
    subject: CONFIG.SUBJECT,
    body: plainBody,
    htmlBody: htmlBody,
    name: CONFIG.COUPLE
  });

  Logger.log('電子喜帖已寄送至：' + email);
}

/**
 * 將觸發事件的內容整理成 {email, name, raw}。
 */
function normalizeEvent(e) {
  var email = '';
  var name = '';
  var raw = {};

  if (e && e.namedValues) {
    var keys = Object.keys(e.namedValues);
    keys.forEach(function (k) {
      var v = e.namedValues[k];
      raw[k] = v;
      var val = String(Array.isArray(v) ? v.join(' ') : v).trim();
      if (!email && matchesColumn(k, CONFIG.EMAIL_COLUMN, ['信箱', '郵件', 'email', 'e-mail', 'mail'])) email = val;
      if (!name && matchesColumn(k, CONFIG.NAME_COLUMN, ['姓名', '稱謂', '大名', 'name'])) name = val;
    });
  } else if (e && e.values) {
    raw.values = e.values;
    // 沒有標題時，退而求其次：找第一個像 email 的字串
    e.values.forEach(function (v) {
      if (!email && typeof v === 'string' && v.indexOf('@') > 0) email = v.trim();
    });
  }

  // 若仍未取得信箱，掃描整份內容
  if (!email) {
    var joined = JSON.stringify(raw);
    var m = joined.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (m) email = m[0];
  }

  return { email: email, name: name, raw: raw };
}

function matchesColumn(key, configured, keywords) {
  var k = String(key).toLowerCase();
  if (configured) return k === String(configured).toLowerCase();
  for (var i = 0; i < keywords.length; i++) {
    if (k.indexOf(String(keywords[i]).toLowerCase()) >= 0) return true;
  }
  return false;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function escapeAttr(s) {
  return escapeHtml(s);
}
