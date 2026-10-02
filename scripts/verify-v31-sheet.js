// v31: run the Apps Script doPost against a fake sheet to prove serial increment + column mapping.
const fs = require('fs');
const src = fs.readFileSync('/workspace/webpages/jack-and-lily-wedding-v31/scripts/rsvp-to-sheet.gs', 'utf8');

// --- minimal Apps Script shims ---
let SHEET = [];
const fakeSheet = {
  getLastRow: () => SHEET.length,
  getRange: (r, c, nr, nc) => ({
    setValues: (vals) => { vals.forEach((row, i) => { SHEET[r - 1 + i] = row.slice(); }); },
  }),
  appendRow: (row) => { SHEET.push(row.slice()); },
};
const SpreadsheetApp = {
  getActiveSpreadsheet: () => ({ getSheets: () => [fakeSheet], getSheetByName: () => null }),
  openById: () => ({ getSheets: () => [fakeSheet], getSheetByName: () => null }),
};
const ContentService = {
  MimeType: { TEXT: 'text/plain', JSON: 'application/json' },
  createTextOutput: (t) => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } }),
};
const LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };

const sandbox = { SpreadsheetApp, ContentService, LockService, console };
const fn = new Function(...Object.keys(sandbox), src + '\n; return { doPost, doGet };');
const api = fn(...Object.values(sandbox));

function post(payload) {
  const res = api.doPost({ postData: { contents: JSON.stringify(payload) } });
  return JSON.parse(res.getContent());
}

const cases = [
  { name: '出席 2大1小1椅', p: { name: '王小明', email: 'a@x.com', side: '男方', relation: '朋友', attend: '出席', adults: 2, children: 1, chairs: 1 } },
  { name: '不克出席', p: { name: '陳大文', email: 'b@x.com', side: '女方', relation: '親戚', attend: '不克出席', adults: 0, children: 0, chairs: 0 } },
  { name: '出席 3大2小2椅', p: { name: '林小美', email: 'c@x.com', side: '女方', relation: '同事', attend: '出席', adults: 3, children: 2, chairs: 2 } },
];

const out = [];
for (const c of cases) out.push({ case: c.name, result: post(c.p) });

console.log(JSON.stringify({ responses: out, sheet: SHEET }, null, 2));
