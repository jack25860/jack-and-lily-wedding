/**
 * 離線驗證 scripts/seating-from-sheet.gs：
 *   以 stub 的 SpreadsheetApp / CacheService / ContentService / Utilities 載入 .gs，
 *   呼叫 doGet() 並檢查它吐出的 JSON 是否符合座位表前端預期。
 * 用法：node scripts/verify-seating-gs.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const SRC = path.join(__dirname, '..', 'scripts', 'seating-from-sheet.gs');

/* ── stub：模擬問卷回覆試算表（含實際使用的欄名與幾種邊界情況） ───────── */
const HEADER = ['時間戳記', '您的姓名', '是否能出席本次盛宴', '桌次', '座位', '備註', '餐點'];
const ROWS = [
  ['2026-09-01 10:00:00', '王大明', '我會出席', '3', '5', '素食', '全素'],
  ['2026-09-01 10:05:00', '陳小美', '我會出席', '3', '6', '', '葷食'],
  ['2026-09-01 10:09:00', '林志豪', '我會出席', '1', '1', '', '葷食'],
  ['2026-09-02 09:00:00', '張三', '不克出席', '4', '2', '', '葷食'],   // 應被剔除 + unplaced 不含
  ['2026-09-02 09:10:00', '李四', '我會出席', '', '', '尚未排桌', '葷食'], // 未分配桌次 → unplaced
  ['2026-09-03 09:10:00', '', '我會出席', '2', '3', '', '葷食'],        // 無姓名 → skipped
  ['2026-09-03 09:20:00', '王小明', '我會出席', '第 12 桌', '第 7 位', '', '葷食'] // 中文格式 → 12 / 7
];

let appended = [];
function makeSheet(name) {
  const values = [HEADER.slice(), ...ROWS.map(r => r.slice())];
  return {
    getName: () => name,
    getLastRow: () => values.length,
    getLastColumn: () => HEADER.length,
    /* 測試用：把資料列清空或還原 */
    __clearData: () => { values.length = 1; },
    __restore: (rows) => { values.length = 1; rows.forEach(r => values.push(r.slice())); },
    getRange: (r, c, nr, nc) => ({
      getValues: () => {
        const out = [];
        for (let i = 0; i < nr; i++) {
          const row = values[r - 1 + i] || [];
          const line = [];
          for (let j = 0; j < nc; j++) line.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
          out.push(line);
        }
        return out;
      },
      setValues: (v) => { v.forEach((line, i) => { values[r - 1 + i] = line.slice(); }); }
    }),
    appendRow: (line) => { values.push(line.slice()); appended.push(line); }
  };
}
const SHEET = makeSheet('表單回覆 1');
const SS = { getSheets: () => [SHEET], getSheetByName: (n) => (n === SHEET.getName() ? SHEET : null) };

global.SpreadsheetApp = { getActiveSpreadsheet: () => SS, openById: () => SS };
global.CacheService = {
  getScriptCache: () => {
    const store = {};
    return {
      get: (k) => (k in store ? store[k] : null),
      put: (k, v) => { store[k] = v; }
    };
  }
};
global.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
global.ContentService = {
  MimeType: { TEXT: 'text/plain', JSON: 'application/json', JAVASCRIPT: 'application/javascript' },
  createTextOutput: (s) => { const o = { setMimeType: () => o, getContent: () => s }; return o; }
};
global.Utilities = {
  formatDate: (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
};
global.Session = { getScriptTimeZone: () => 'Asia/Taipei' };
global.Logger = { log: () => {} };

vm.runInThisContext(fs.readFileSync(SRC, 'utf8'), { filename: 'seating-from-sheet.gs' });

/* ── 斷言工具 ───────────────────────────────────────────────────────── */
let fails = 0;
function check(label, cond, got) {
  if (cond) { console.log(`PASS  ${label}`); }
  else { fails++; console.log(`FAIL  ${label}   got=${JSON.stringify(got)}`); }
}

console.log('=== 1) GET /exec（無參數）===');
const res = doGet({ parameter: {} });
const raw = res.getContent();
check('回應可被 JSON.parse', (() => { try { JSON.parse(raw); return true; } catch (e) { return false; } })(), raw.slice(0, 120));
const j = JSON.parse(raw);
check('ok === true', j.ok === true, j.ok);
check('version 標記存在', j.version === 'seating-v61', j.version);
check('guests 為陣列', Array.isArray(j.guests), j.guests);
check('guests 共 4 位（剔除不克出席 1、未排桌 1、無姓名 1）', j.guests.length === 4, j.guests.map(g => g.name));
check('不克出席者被剔除', !j.guests.some(g => g.name === '張三'), j.guests.map(g => g.name));
check('未分配桌次者不進座位圖', !j.guests.some(g => g.name === '李四'), j.guests.map(g => g.name));
check('未分配桌次者列在 unplaced', Array.isArray(j.unplaced) && j.unplaced.some(s => s.indexOf('李四') === 0), j.unplaced);
check('「第 12 桌」解析為 12', j.guests.some(g => g.name === '王小明' && g.table === 12), j.guests.find(g => g.name === '王小明'));
check('「第 7 位」解析為 7', j.guests.some(g => g.name === '王小明' && g.seat === 7), j.guests.find(g => g.name === '王小明'));
check('備註有帶出（素食）', j.guests.some(g => g.name === '王大明' && g.note === '素食'), j.guests.find(g => g.name === '王大明'));
check('已依桌次排序（第一筆為 1 桌）', j.guests[0].table === 1, j.guests.map(g => g.table));
check('欄位對應有回報', j.map && j.map.name === '您的姓名' && j.map.table === '桌次' && j.map.seat === '座位', j.map);
check('stats 統計正確', j.stats && j.stats.placed === 4 && j.stats.unplaced === 1 && j.stats.raw === 7, j.stats);
check('tables 至少到 12 桌', j.tables.length === 12, j.tables.length);

console.log('\n=== 2) 座位表前端可直接使用的形狀檢查 ===');
check('每筆都有 name/table/seat', j.guests.every(g => typeof g.name === 'string' && g.name && Number.isInteger(g.table) && g.table > 0 && Number.isInteger(g.seat) && g.seat > 0), j.guests);
check('tables 每筆都有 no', j.tables.every(t => Number.isInteger(t.no) && t.no > 0), j.tables.slice(0, 3));

console.log('\n=== 3) GET /exec?format=health ===');
const h = JSON.parse(doGet({ parameter: { format: 'health' } }).getContent());
check('health ok', h.ok === true, h);
check('health 帶出人數', h.guests === 4, h.guests);

console.log('\n=== 4) GET /exec?callback=cb（JSONP）===');
const jp = doGet({ parameter: { callback: 'ssssSeatingCb' } }).getContent();
check('JSONP 包住 callback', jp.startsWith('ssssSeatingCb(') && jp.trim().endsWith(');'), jp.slice(0, 40));
check('JSONP 內容為合法 JSON', (() => { try { JSON.parse(jp.replace(/^ssssSeatingCb\(/, '').replace(/\);$/, '')); return true; } catch (e) { return false; } })(), '');

console.log('\n=== 5) 欄位對應：只靠 index（欄名完全不一樣）===');
(function () {
  const saved = [COL_NAME.header, COL_TABLE.header, COL_SEAT.header, COL_NOTE.header, COL_ATTEND.header];
  COL_NAME.header = '誰'; COL_TABLE.header = '哪一桌'; COL_SEAT.header = '位子'; COL_NOTE.header = '吃什麼'; COL_ATTEND.header = '要來嗎';
  COL_NAME.index = 2; COL_TABLE.index = 4; COL_SEAT.index = 5; COL_NOTE.index = 6;   // 1 起算
  const out = JSON.parse(doGet({ parameter: {} }).getContent());
  check('index 對應可運作（姓名/桌次/座位仍正確）', out.ok === true && out.guests.some(g => g.name === '王大明' && g.table === 3 && g.seat === 5), out.guests);
  check('index 模式下出席欄位被關閉（不克出席者仍會被列出）', out.guests.some(g => g.name === '林志豪'), out.guests.map(g => g.name));
  COL_NAME.header = saved[0]; COL_TABLE.header = saved[1]; COL_SEAT.header = saved[2]; COL_NOTE.header = saved[3]; COL_ATTEND.header = saved[4];
  COL_NAME.index = COL_TABLE.index = COL_SEAT.index = COL_NOTE.index = 0;
})();

console.log('\n=== 6) 找不到姓名欄 → 回傳 ok:false 而非拋錯 ===');
(function () {
  const saved = COL_NAME.header, savedAlias = COL_NAME.aliases.slice();
  COL_NAME.header = '不存在的欄名'; COL_NAME.aliases = ['也不存在'];
  const out = JSON.parse(doGet({ parameter: {} }).getContent());
  check('缺少姓名欄時 ok === false', out.ok === false, out.ok);
  check('錯誤訊息可讀', typeof out.error === 'string' && out.error.indexOf('姓名') >= 0, out.error);
  COL_NAME.header = saved; COL_NAME.aliases = savedAlias;
})();

console.log('\n=== 7) 空試算表（只有標題列）===');
(function () {
  /* 注意：此斷言測的是「空名單仍回 ok:true 且 guests 為空陣列」，這是前端回退邏輯的依據。
     必須真的清空 stub 試算表的資料列（先前版本忘了清，結果一直在測有資料的情況）。
     另：doGet 有 60 秒伺服器端快取，測試前要先清掉快取，否則會拿到上一回的 payload。 */
  SHEET.__clearData();
  try { CacheService.getScriptCache().put(cacheKey_(), '', 1); } catch (e) {}
  const out = JSON.parse(readThrough_());
  const ok = out.ok === true && Array.isArray(out.guests) && out.guests.length === 0;
  check('空名單仍回 ok:true 且 guests 為空陣列', ok, { ok: out.ok, n: (out.guests || []).length });
  check('空名單的 stats 為 0', out.stats && out.stats.placed === 0 && out.stats.raw === 0, out.stats);
  SHEET.__restore(ROWS);
  try { CacheService.getScriptCache().put(cacheKey_(), '', 1); } catch (e) {}
})();

/* 繞過快取直接組 payload，讓每個測試都是獨立情境 */
function readThrough_() {
  var prev = CACHE_SECONDS;
  CACHE_SECONDS = 0;                 /* 0 → doGet 不讀也不寫快取，永遠讀試算表 */
  try { return doGet({ parameter: {} }).getContent(); }
  finally { CACHE_SECONDS = prev; }
}

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILED'} (${fails} failures)`);
process.exit(fails === 0 ? 0 : 1);
