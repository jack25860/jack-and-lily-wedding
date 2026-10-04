/* ============================================================================
 * v32 本機驗證：rsvp-to-sheet.gs 的 doPost 是否「依序往下寫入 + 序號自動遞增」
 * ----------------------------------------------------------------------------
 * 用法：node scripts/verify-v32-sheet.js
 * 原理：以 stub 取代 Apps Script 的全域物件（SpreadsheetApp / LockService /
 *       ContentService），用 vm.runInThisContext 載入 .gs（讓頂層 var 成為
 *       global），接著連續呼叫 doPost 三次並斷言寫入的每一列。
 * 注意：Node 的 `node --check` 不接受 .gs 副檔名，語法檢查請見檔尾說明。
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- 1. 假試算表：appendRow 會讓 getLastRow() 成長，才能驗證序號遞增 ----
let rows = [];
const sheet = {
  appendRow: v => { rows.push(v); },
  getLastRow: () => rows.length,
  getRange: () => ({ setValues: vals => { vals.forEach(v => rows.push(v)); } })
};
const ss = { getSheets: () => [sheet], getSheetByName: () => sheet };

global.SpreadsheetApp = { getActiveSpreadsheet: () => ss, openById: () => ss };
global.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
global.ContentService = {
  MimeType: { TEXT: 'text/plain', JSON: 'application/json' },
  // 回傳物件同時支援 doGet() 與 doPost()；setMimeType 需可鏈結（回傳自身）
  createTextOutput: s => {
    const out = { setMimeType: () => out, getContent: () => s };
    return out;
  }
};

// ---- 2. 載入 Apps Script（runInThisContext ⇒ 頂層 var 變成 global）----
const gsPath = path.join(__dirname, 'rsvp-to-sheet.gs');
vm.runInThisContext(fs.readFileSync(gsPath, 'utf8'), { filename: 'rsvp-to-sheet.gs' });

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label +
    (ok ? '' : `\n          expected: ${JSON.stringify(expected)}\n          actual:   ${JSON.stringify(actual)}`));
}
function post(o) {
  return JSON.parse(doPost({ postData: { contents: JSON.stringify(o) } }).getContent());
}

console.log('== v32 Apps Script harness ==\n');

// ---- 3. 設定值 ----
check('SPREADSHEET_ID 已帶入目標試算表', SPREADSHEET_ID,
  '1oxlmhFgKS93pIWfRInJF0AXqpXRLxeU8v5ZJCnZFpW0');
check('HEADERS 為 10 欄且順序正確', HEADERS,
  ['序號', '您的姓名', '您的信箱', '您是哪一方的賓客', '與新人的關係',
   '是否能出席本次盛宴', '出席人數', '出席大人人數', '出席兒童人數', '需要兒童椅數量']);

// ---- 4. 健康檢查 ----
check('doGet() 回傳健康字串', /endpoint is running\./.test(doGet().getContent()), true);

// ---- 5. 連續三筆寫入 ----
const r1 = post({ name: '王小明', email: 'a@example.com', side: '女方', relation: '朋友',
                  attend: '出席', adults: 2, children: 1, chairs: 1 });
const r2 = post({ name: '陳大文', email: 'b@example.com', side: '男方', relation: '同事',
                  attend: '不克出席', adults: 0, children: 0, chairs: 0 });
const r3 = post({ name: '林小華', email: 'c@example.com', side: '女方', relation: '家人',
                  attend: '出席', adults: 3, children: 2, chairs: 2 });

check('三次呼叫皆回 ok:true', [r1.ok, r2.ok, r3.ok], [true, true, true]);

// ---- 6. 標題列自動建立 ----
check('第 1 列 = 標題列', rows[0], HEADERS);

// ---- 7. 第 1 筆（出席 2 大 1 小 1 椅）----
check('第 1 筆 序號 = 1', rows[1][0], 1);
check('第 1 筆 姓名/信箱/賓客方/關係',
  [rows[1][1], rows[1][2], rows[1][3], rows[1][4]],
  ['王小明', 'a@example.com', '女方', '朋友']);
check('第 1 筆 出席狀態 + 出席人數(2+1=3)', [rows[1][5], rows[1][6]], ['出席', 3]);
check('第 1 筆 大人/兒童/兒童椅', [rows[1][7], rows[1][8], rows[1][9]], [2, 1, 1]);

// ---- 8. 第 2 筆（不克出席 ⇒ 人數欄位留空，不是 0）----
check('第 2 筆 序號自動 +1 = 2', rows[2][0], 2);
check('第 2 筆 出席狀態 + 出席人數 0', [rows[2][5], rows[2][6]], ['不克出席', 0]);
check('第 2 筆 大人/兒童/兒童椅 皆留空', [rows[2][7], rows[2][8], rows[2][9]], ['', '', '']);

// ---- 9. 第 3 筆（出席 3 大 2 小 2 椅）----
check('第 3 筆 序號自動 +1 = 3', rows[3][0], 3);
check('第 3 筆 出席人數(3+2=5)', rows[3][6], 5);
check('第 3 筆 大人/兒童/兒童椅', [rows[3][7], rows[3][8], rows[3][9]], [3, 2, 2]);

// ---- 10. 總列數 = 1 標題 + 3 資料 ----
check('工作表總列數 = 4', rows.length, 4);

// ---- 11. 若前端改送中文 key 也能對應 ----
rows = [];
post({ '您的姓名': '測試中文', '您的信箱': 'z@example.com', '您是哪一方的賓客': '男方',
       '與新人的關係': '親戚', '是否能出席本次盛宴': '出席', '出席大人人數': '4',
       '出席兒童人數': '0', '需要兒童椅數量': '0' });
check('中文 key 也能寫入（姓名）', rows[1][1], '測試中文');
check('中文 key 也能寫入（大人數）', rows[1][7], 4);

console.log('\n== ' + (failed ? failed + ' 項失敗 ==' : '全部通過 =='));
process.exit(failed ? 1 : 0);
