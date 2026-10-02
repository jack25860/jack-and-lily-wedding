#!/usr/bin/env node
/**
 * v38 offline verification of scripts/rsvp-to-sheet.gs
 *
 * 驗證重點（本次修復）：
 *  - doGet() 健康字串帶 v38
 *  - doGet(?diag=1) 回傳 JSON，含 mailScope / photoPool / videoPoster / videoUrl
 *  - sendEcard_ 在 GmailApp 拋「權限不足」時回傳 {ok:false,error:'mail_scope_missing'}
 *  - sendEcard_ 在 GmailApp 正常時回傳 {ok:true, inline:2}，且信件為 HTML + cid: 內嵌
 *  - 【v38 修復】videoPoster 為相對路徑時，UrlFetchApp 抓取的網址必須是絕對網址
 *  - RSVP 路徑不受影響（序號遞增、不克出席留空）
 *  - ECARD_PHOTO_POOL 仍為 142 張且與相簿一致
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = __dirname;
const SRC = fs.readFileSync(path.join(DIR, 'rsvp-to-sheet.gs'), 'utf8');

let pass = 0, fail = 0;
function chk(group, name, cond, actual) {
  if (cond) { pass++; console.log('  ok   [' + group + '] ' + name); }
  else { fail++; console.log('  FAIL [' + group + '] ' + name + '  actual=' + JSON.stringify(actual)); }
}

// ---------- sandbox ----------
function makeSandbox(opts) {
  opts = opts || {};
  const rows = [];
  const sentEmails = [];
  const fetched = [];
  const sheet = {
    getLastRow: () => rows.length,
    getRange: () => ({ setValues: (v) => { rows.push(v[0]); } }),
    appendRow: (r) => rows.push(r),
  };
  const sandbox = {
    console,
    SpreadsheetApp: { openById: () => ({ getSheets: () => [sheet], getSheetByName: () => sheet }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { TEXT: 'text/plain', JSON: 'application/json' },
      createTextOutput: (t) => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } }),
    },
    UrlFetchApp: { fetch: (url) => { fetched.push(String(url)); return { getResponseCode: () => 200, getBlob: () => ({ getContentType: () => 'image/jpeg', _url: url }) }; } },
    Session: { getActiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
    Logger: { log() {} },
    MailApp: {
      getRemainingDailyQuota: () => {
        if (opts.mailScope === false) throw new Error('The script does not have permission to perform that action.');
        return 100;
      },
    },
    GmailApp: {
      getAliases: () => {
        if (opts.mailScope === false) throw new Error('The script does not have permission to perform that action.');
        return ['owner@example.com'];
      },
      sendEmail: (to, subject, body, o) => {
        if (opts.mailScope === false) {
          throw new Error('Exception: The script does not have permission to perform that action. Required permissions: (https://mail.google.com/ || https://www.googleapis.com/auth/gmail.send)');
        }
        sentEmails.push({ to, subject, body, opts: o });
      },
    },
    __rows: rows,
    __sent: sentEmails,
    __fetched: fetched,
  };
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return sandbox;
}

function post(sb, obj) { return sb.doPost({ postData: { contents: JSON.stringify(obj) } }); }
function get(sb, params) { return sb.doGet({ parameter: params || {} }); }

console.log('== v38 Apps Script harness ==\n');

// ---------- 1. doGet ----------
{
  const sb = makeSandbox({ mailScope: true });
  chk('doGet', '健康字串帶 v38', String(get(sb).getContent()).includes('v38'), get(sb).getContent());
  const d = JSON.parse(get(sb, { diag: '1' }).getContent());
  chk('doGet', 'diag 回傳 JSON ok', d.ok === true, d);
  chk('doGet', 'diag 帶 version=v38', d.version === 'v38', d.version);
  chk('doGet', 'diag 已授權時 mailScope=true', d.mailScope === true, d.mailScope);
  chk('doGet', 'diag 帶 quota', typeof d.quota === 'number', d.quota);
  chk('doGet', 'diag 帶 photoPool=142', d.photoPool === 142, d.photoPool);
  chk('doGet', 'diag 帶 videoPoster', typeof d.videoPoster === 'string' && d.videoPoster.length > 0, d.videoPoster);
}
{
  const sb = makeSandbox({ mailScope: false });
  const d = JSON.parse(get(sb, { diag: '1' }).getContent());
  chk('doGet', 'diag 未授權時 mailScope=false', d.mailScope === false, d.mailScope);
  chk('doGet', 'diag 未授權時 quota=-1', d.quota === -1, d.quota);
}

// ---------- 2. ecard: 未授權 → 明確錯誤 ----------
{
  const sb = makeSandbox({ mailScope: false });
  const r = JSON.parse(post(sb, { type: 'ecard', to: 'guest@example.com', subject: 's', greeting: 'g', body: 'b', inviteText: 'i', photo: 'images/album/zg1.jpg', site: 'https://x/' }).getContent());
  chk('ecard-scope', '未授權時 ok=false', r.ok === false, r);
  chk('ecard-scope', '未授權時 error=mail_scope_missing', r.error === 'mail_scope_missing', r.error);
  chk('ecard-scope', '未授權時不寄出任何信', sb.__sent.length === 0, sb.__sent.length);
  chk('ecard-scope', '未授權時不寫入試算表', sb.__rows.length === 0, sb.__rows.length);
}

// ---------- 3. ecard: 已授權 → 正常寄出 ----------
{
  const sb = makeSandbox({ mailScope: true });
  const r = JSON.parse(post(sb, { type: 'ecard', to: 'guest@example.com', subject: 's', greeting: 'g', body: 'b', inviteText: '誠摯地邀請您參加本次婚禮，新郎與新娘敬上。', photo: 'images/album/zg1.jpg', site: 'https://x/' }).getContent());
  chk('ecard-ok', '已授權時 ok=true', r.ok === true, r);
  chk('ecard-ok', 'inline=2（婚紗照＋影片示意）', r.inline === 2, r.inline);
  chk('ecard-ok', '寄出一封', sb.__sent.length === 1, sb.__sent.length);
  const em = sb.__sent[0];
  chk('ecard-ok', '收件者正確', em.to === 'guest@example.com', em.to);
  chk('ecard-ok', '使用 htmlBody', !!em.opts.htmlBody, Object.keys(em.opts));
  chk('ecard-ok', 'inlineImages 2 張', Object.keys(em.opts.inlineImages).length === 2, Object.keys(em.opts.inlineImages));
  chk('ecard-ok', 'HTML 以 cid: 內嵌婚紗照', em.opts.htmlBody.includes('src="cid:couplePhoto"'), 'no cid');
  chk('ecard-ok', 'HTML 以 cid: 內嵌影片示意圖', em.opts.htmlBody.includes('src="cid:videoPoster"'), 'no cid');
  chk('ecard-ok', 'HTML 不含外部圖片連結', !/<img[^>]+src="https?:/.test(em.opts.htmlBody), 'has external img');
  chk('ecard-ok', '含邀請文字', em.opts.htmlBody.includes('誠摯地邀請您參加本次婚禮，新郎與新娘敬上。'), 'no invite');
  chk('ecard-ok', '含署名', em.opts.htmlBody.includes('新郎與新娘 敬上'), 'no sign');
  chk('ecard-ok', '不寫入試算表', sb.__rows.length === 0, sb.__rows.length);
}

// ---------- 4. 【v38 修復】videoPoster 相對路徑 → 絕對網址 ----------
{
  const sb = makeSandbox({ mailScope: true });
  post(sb, { type: 'ecard', to: 'g@example.com', subject: 's', greeting: 'g', body: 'b', inviteText: 'i', photo: 'images/album/zg1.jpg', videoPoster: 'images/tl1.jpg', site: 'https://x/' });
  const em = sb.__sent[0];
  const vpUrl = String(em.opts.inlineImages.videoPoster._url);
  chk('ecard-video', 'videoPoster 相對路徑被轉為絕對網址', vpUrl.startsWith('https://jack25860.github.io/jack-and-lily-wedding/'), vpUrl);
  chk('ecard-video', 'videoPoster 指向 images/tl1.jpg', vpUrl.endsWith('/images/tl1.jpg'), vpUrl);
  chk('ecard-video', 'UrlFetchApp 未收到相對路徑', sb.__fetched.every(u => u.indexOf('http') === 0), sb.__fetched);
}
{
  // 預設 ECARD_VIDEO_POSTER（來自 config，可能為相對路徑）也必須被轉絕對
  const sb = makeSandbox({ mailScope: true });
  post(sb, { type: 'ecard', to: 'g@example.com', subject: 's', greeting: 'g', body: 'b', inviteText: 'i', photo: 'images/album/zg1.jpg', site: 'https://x/' });
  const vpUrl = String(sb.__sent[0].opts.inlineImages.videoPoster._url);
  chk('ecard-video', '預設 videoPoster 亦為絕對網址', vpUrl.indexOf('http') === 0, vpUrl);
}

// ---------- 5. ecard: 未帶 photo → 伺服器端隨機補位 ----------
{
  const sb = makeSandbox({ mailScope: true });
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    post(sb, { type: 'ecard', to: 'g@example.com', subject: 's', greeting: 'g', body: 'b', inviteText: 'i', site: 'https://x/' });
    seen.add(String(sb.__sent[i].opts.inlineImages.couplePhoto._url));
  }
  chk('ecard-random', '未帶 photo 仍內嵌婚紗照', sb.__sent.every(e => e.opts.htmlBody.includes('cid:couplePhoto')), sb.__sent.length);
  chk('ecard-random', '隨機補位使用絕對網址', sb.__sent.every(e => String(e.opts.inlineImages.couplePhoto._url).startsWith('https://jack25860.github.io/jack-and-lily-wedding/images/album/')), String(sb.__sent[0].opts.inlineImages.couplePhoto._url));
  chk('ecard-random', '30 次抽選有變化', seen.size > 1, seen.size);
}

// ---------- 6. ecard: 無效收件者 ----------
{
  const sb = makeSandbox({ mailScope: true });
  const r = JSON.parse(post(sb, { type: 'ecard', to: 'not-an-email' }).getContent());
  chk('ecard-invalid', '無效信箱 ok=false', r.ok === false, r);
  chk('ecard-invalid', '無效信箱不寄出', sb.__sent.length === 0, sb.__sent.length);
}

// ---------- 7. RSVP 回歸 ----------
{
  const sb = makeSandbox({ mailScope: true });
  const r1 = JSON.parse(post(sb, { name: 'A', email: 'a@example.com', side: '女方', relation: '朋友', attend: '出席', adults: 2, children: 1, chairs: 1 }).getContent());
  const r2 = JSON.parse(post(sb, { name: 'B', email: 'b@example.com', side: '男方', relation: '同事', attend: '不克出席' }).getContent());
  const data = sb.__rows.slice(1);
  chk('rsvp', 'RSVP 回傳 ok', r1.ok === true && r2.ok === true, [r1, r2]);
  chk('rsvp', '自動補上標題列', sb.__rows[0][0] === '序號', sb.__rows[0][0]);
  chk('rsvp', '寫入兩列資料', data.length === 2, data.length);
  chk('rsvp', '序號 1,2 遞增', data[0][0] === 1 && data[1][0] === 2, [data[0][0], data[1][0]]);
  chk('rsvp', '出席人數=大人+兒童', data[0][6] === 3, data[0][6]);
  chk('rsvp', '不克出席：大人留空', data[1][7] === '', data[1][7]);
  chk('rsvp', '不克出席：兒童留空', data[1][8] === '', data[1][8]);
  chk('rsvp', '不克出席：兒童椅留空', data[1][9] === '', data[1][9]);
  chk('rsvp', 'RSVP 不寄信', sb.__sent.length === 0, sb.__sent.length);
}

// ---------- 8. pool ----------
{
  const sb = makeSandbox({ mailScope: true });
  const pool = sb.ECARD_PHOTO_POOL;
  chk('pool', 'pool 為陣列', Array.isArray(pool), typeof pool);
  chk('pool', 'pool 共 142 張', pool.length === 142, pool.length);
  chk('pool', 'pool 無重複', new Set(pool).size === pool.length, [pool.length, new Set(pool).size]);
  const missing = pool.filter(p => !fs.existsSync(path.join(DIR, '..', p)));
  chk('pool', 'pool 檔案皆存在', missing.length === 0, missing.slice(0, 5));
  chk('pool', 'randomPhoto_ 落在 pool 內', pool.includes(sb.randomPhoto_()), sb.randomPhoto_());
  chk('pool', 'ENDPOINT_VERSION = v38', sb.ENDPOINT_VERSION === 'v38', sb.ENDPOINT_VERSION);
}

console.log('\n== v38 result: ' + pass + ' passed, ' + fail + ' failed ==');
process.exit(fail ? 1 : 0);
