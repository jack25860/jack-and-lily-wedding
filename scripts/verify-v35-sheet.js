#!/usr/bin/env node
/**
 * v35 offline verification of scripts/rsvp-to-sheet.gs
 *  - doPost RSVP path writes rows with auto-incrementing 序號
 *  - 不克出席 leaves 大人/兒童/兒童椅 blank
 *  - doPost ecard path builds an HTML email with INLINE images (cid:) + invitation text
 *  - v35: ECARD_PHOTO_POOL covers ALL 142 gallery photos; server-side random fallback works
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = __dirname;
const SRC = fs.readFileSync(path.join(DIR, 'rsvp-to-sheet.gs'), 'utf8');

let pass = 0, fail = 0;
const results = [];
function chk(tag, name, cond, extra) {
  results.push([tag, name, !!cond, extra]);
  if (cond) { pass++; console.log('PASS [' + tag + '] ' + name); }
  else { fail++; console.log('FAIL [' + tag + '] ' + name + '  ' + JSON.stringify(extra)); }
}

function makeSheet() {
  const rows = [];
  return {
    rows,
    getLastRow: () => rows.length,
    getRange: (r, c, nr, nc) => ({ setValues: (v) => { v.forEach((row, i) => { rows[r - 1 + i] = row.slice(); }); } }),
    appendRow: (row) => rows.push(row.slice()),
  };
}
const sheet = makeSheet();
const sentEmails = [];

const sandbox = {
  console,
  SpreadsheetApp: { openById: () => ({ getSheets: () => [sheet], getSheetByName: () => null }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: {
    MimeType: { TEXT: 'text/plain', JSON: 'application/json' },
    createTextOutput: (t) => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } }),
  },
  GmailApp: { sendEmail: (to, subject, body, opts) => { sentEmails.push({ to, subject, body, opts }); } },
  UrlFetchApp: { fetch: (url) => ({ getResponseCode: () => 200, getBlob: () => ({ getContentType: () => 'image/jpeg', _url: url }) }) },
};
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox);

function post(obj) { return sandbox.doPost({ postData: { contents: JSON.stringify(obj) } }); }

// ---------- v35: pool coverage ----------
const pool = sandbox.ECARD_PHOTO_POOL;
chk('pool', 'ECARD_PHOTO_POOL 存在且為陣列', Array.isArray(pool), typeof pool);
chk('pool', 'pool 共 142 張（全部婚紗照）', pool.length === 142, pool.length);
chk('pool', 'pool 無重複', new Set(pool).size === pool.length, [pool.length, new Set(pool).size]);
const albumDir = path.join(DIR, '..', 'images', 'album');
const poolFiles = pool.map(p => p.replace('images/album/', ''));
const missing = poolFiles.filter(f => !fs.existsSync(path.join(albumDir, f)));
chk('pool', 'pool 每個檔案都存在', missing.length === 0, missing);
const onDisk = fs.readdirSync(albumDir).filter(f => f.endsWith('.jpg'));
chk('pool', 'pool 涵蓋磁碟上全部 142 張', onDisk.length === 142 && onDisk.every(f => poolFiles.includes(f)), [onDisk.length, poolFiles.length]);
chk('pool', 'pool 含 戰國相關 zg/n01-08', ['images/album/zg1.jpg', 'images/album/n01.jpg', 'images/album/n08.jpg'].every(p => pool.includes(p)), 'missing warring states');
chk('pool', 'pool 含 唐代相關 tg/n09-49', ['images/album/tg1.jpg', 'images/album/n09.jpg', 'images/album/n49.jpg'].every(p => pool.includes(p)), 'missing tang');
chk('pool', 'pool 含 明朝相關 p/n50-74', ['images/album/p01.jpg', 'images/album/n50.jpg', 'images/album/n74.jpg'].every(p => pool.includes(p)), 'missing ming');
chk('pool', 'ENDPOINT_VERSION = v35', sandbox.ENDPOINT_VERSION === 'v35', sandbox.ENDPOINT_VERSION);
chk('pool', 'randomPhoto_ 回傳 pool 內路徑', pool.includes(sandbox.randomPhoto_()), sandbox.randomPhoto_());
chk('pool', 'doGet 標記 v35', String(sandbox.doGet().getContent()).includes('v35'), sandbox.doGet().getContent());

// ---------- RSVP ----------
post({ name: 'QA-A', email: 'a@example.com', side: '女方', relation: '朋友', attend: '出席', adults: 2, children: 1, chairs: 1 });
post({ name: 'QA-B', email: 'b@example.com', side: '男方', relation: '同事', attend: '不克出席' });
post({ name: 'QA-C', email: 'c@example.com', side: '男方', relation: '親戚', attend: '出席', adults: 3, children: 2, chairs: 2 });

chk('sheet', '標題列自動建立', JSON.stringify(sheet.rows[0]) === JSON.stringify(['序號', '您的姓名', '您的信箱', '您是哪一方的賓客', '與新人的關係', '是否能出席本次盛宴', '出席人數', '出席大人人數', '出席兒童人數', '需要兒童椅數量']), sheet.rows[0]);
chk('sheet', '序號 1/2/3 遞增', sheet.rows[1][0] === 1 && sheet.rows[2][0] === 2 && sheet.rows[3][0] === 3, sheet.rows.slice(1).map(r => r[0]));
chk('sheet', '出席人數 = 大人+兒童', sheet.rows[1][6] === 3 && sheet.rows[3][6] === 5, [sheet.rows[1][6], sheet.rows[3][6]]);
chk('sheet', '不克出席：大人/兒童/椅留空', sheet.rows[2][7] === '' && sheet.rows[2][8] === '' && sheet.rows[2][9] === '', sheet.rows[2]);
chk('sheet', '不克出席：出席人數 0', sheet.rows[2][6] === 0, sheet.rows[2][6]);
chk('sheet', '欄位對應正確（姓名/信箱/關係）', sheet.rows[1][1] === 'QA-A' && sheet.rows[1][2] === 'a@example.com' && sheet.rows[1][4] === '朋友', sheet.rows[1]);

// ---------- ecard with explicit photo ----------
const r = post({
  type: 'ecard', to: 'guest@example.com',
  subject: '【三生三世・緣定今生】誠摯邀請您參加我們的婚禮',
  greeting: '親愛的朋友，您好：', body: '誠摯地邀請您一同見證我們的婚禮。',
  inviteText: '誠摯地邀請您參加本次婚禮，新郎與新娘敬上。',
  photo: 'https://jack25860.github.io/jack-and-lily-wedding/images/album/n03.jpg',
  videoUrl: '', videoPoster: 'https://jack25860.github.io/jack-and-lily-wedding/images/tl1.jpg',
  site: 'https://jack25860.github.io/jack-and-lily-wedding/',
});
const parsed = JSON.parse(r.getContent());
chk('ecard', 'doPost 回傳 ok', parsed.ok === true, parsed);
chk('ecard', '寄出一封 email', sentEmails.length === 1, sentEmails.length);
const em = sentEmails[0];
chk('ecard', '收件者正確', em.to === 'guest@example.com', em.to);
chk('ecard', '使用 htmlBody', !!em.opts.htmlBody, Object.keys(em.opts));
chk('ecard', 'inlineImages 有 2 張（婚紗照＋影片示意）', Object.keys(em.opts.inlineImages).length === 2, Object.keys(em.opts.inlineImages));
chk('ecard', 'HTML 以 cid: 內嵌婚紗照', em.opts.htmlBody.includes('src="cid:couplePhoto"'), 'no cid:couplePhoto');
chk('ecard', 'HTML 以 cid: 內嵌影片示意圖', em.opts.htmlBody.includes('src="cid:videoPoster"'), 'no cid:videoPoster');
chk('ecard', 'HTML 不含外部圖片連結（非連結形式）', !/<img[^>]+src="https?:/.test(em.opts.htmlBody), 'has external img');
chk('ecard', '含邀請文字', em.opts.htmlBody.includes('誠摯地邀請您參加本次婚禮，新郎與新娘敬上。'), 'missing invite text');
chk('ecard', '含新郎與新娘敬上', em.opts.htmlBody.includes('新郎與新娘 敬上'), 'missing sign-off');
chk('ecard', '純文字備援存在', typeof em.body === 'string' && em.body.length > 0, em.body);
chk('ecard', '寄件者名稱設定', em.opts.name === '三生三世・緣定今生', em.opts.name);

// ---------- v35: ecard WITHOUT photo -> server-side random fallback ----------
sentEmails.length = 0;
const seen = new Set();
for (let i = 0; i < 40; i++) {
  post({ type: 'ecard', to: 'g' + i + '@example.com', videoPoster: 'https://x/p.jpg' });
  const html = sentEmails[i].opts.htmlBody;
  const m = html.match(/cid:couplePhoto/);
  if (!m) { chk('fallback', '未傳 photo 時仍內嵌婚紗照', false, html.slice(0, 200)); break; }
  seen.add(JSON.stringify(sentEmails[i].opts.inlineImages.couplePhoto._url));
}
chk('fallback', '未傳 photo 時仍內嵌婚紗照（伺服器端隨機補位）', sentEmails.length === 40 && sentEmails.every(e => e.opts.htmlBody.includes('cid:couplePhoto')), sentEmails.length);
chk('fallback', '隨機補位使用絕對網址', sentEmails.every(e => String(e.opts.inlineImages.couplePhoto._url).startsWith('https://jack25860.github.io/jack-and-lily-wedding/images/album/')), String(sentEmails[0].opts.inlineImages.couplePhoto._url));
chk('fallback', '40 次隨機挑選有變化（非固定一張）', seen.size > 1, seen.size);

// ---------- ecard with video URL set (future) ----------
sentEmails.length = 0;
post({ type: 'ecard', to: 'g2@example.com', photo: 'https://x/y.jpg', videoUrl: 'https://example.com/v.mp4', videoPoster: 'https://x/p.jpg', inviteText: '誠摯地邀請您參加本次婚禮，新郎與新娘敬上。' });
chk('ecard', '有影片網址時產生可點擊影片連結', sentEmails[0].opts.htmlBody.includes('https://example.com/v.mp4'), 'no video link');

// ---------- invalid recipient ----------
const bad = JSON.parse(post({ type: 'ecard', to: 'nope' }).getContent());
chk('ecard', '無效信箱回傳 ok:false', bad.ok === false, bad);

console.log('\n==== ' + pass + '/' + (pass + fail) + ' PASSED ====');
results.filter(x => !x[2]).forEach(x => console.log('  FAIL [' + x[0] + '] ' + x[1] + ' :: ' + JSON.stringify(x[3])));
process.exit(fail === 0 ? 0 : 1);
