#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v109 patch
==========
Two independent problems, both fixed here.

1) scripts/rsvp-to-sheet.gs in the repo was still v49.
   The live Apps Script endpoint is v50 (saveMessage / listMessages / phone in
   column L / optional email), but the repo copy never got that code, so the
   repo was not a truthful record of what runs in production. This patch brings
   the repo file up to v51 = v50 + the row-growth fix below.

2) The 1000-row ceiling.
   * Front end: js/app.js read the message board with MSG_RANGE="N1:R1000".
     Any message written past row 1000 was invisible on every device.
     -> open-ended range "N:R".
   * Apps Script: RSVP used appendRow() (already fine) but nothing guaranteed
     the sheet had a free row, and saveMessage_ scanned getMaxRows() and then
     wrote at lastMsg+1 without ever growing the grid. A sheet that reaches its
     last row would start failing.
     -> ensureRows_() grows the grid in 500-row steps before any write.

No new fields, no new features. RSVP columns A:L, message columns N:R, the
phone field, optional email, gallery, video and the iPhone typing CSS are all
untouched.
"""
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(rel):
    with io.open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def write(rel, text):
    with io.open(os.path.join(ROOT, rel), "w", encoding="utf-8", newline="") as f:
        f.write(text)


def sub_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        sys.exit("FAIL [%s]: expected exactly 1 occurrence, found %d" % (label, n))
    return text.replace(old, new, 1)


# ---------------------------------------------------------------- .gs -------
GS = "scripts/rsvp-to-sheet.gs"
gs = read(GS)

VERSION_BLOCK = """var ENDPOINT_VERSION = 'v51';

/**
 * v51：移除「1000 列」上限。
 *  - RSVP 寫入前先確認工作表列數足夠（不足就自動擴充），appendRow 不會因滿列而失敗。
 *  - 留言寫入前同樣確認列數，並以 N 欄最後一列 +1 定位，可無限成長。
 *  - 前端 gviz 讀取改為開放式範圍（N:R），不再寫死 N1:R1000。
 */
var ROW_GROWTH_STEP = 500;   // 每次擴充的列數

/** 確保工作表至少有 needRows 列；不足時自動擴充。 */
function ensureRows_(sheet, needRows) {
  var max = sheet.getMaxRows();
  if (needRows <= max) return max;
  var add = Math.ceil((needRows - max) / ROW_GROWTH_STEP) * ROW_GROWTH_STEP;
  sheet.insertRowsAfter(max, add);
  return sheet.getMaxRows();
}

/**
 * v50：留言功能「跨裝置共用儲存」。
 * 留言寫入「第一個工作表」的 N:R 區塊（與 RSVP 的 A:L 完全分離，不會互相干擾）。
 * 前端讀取用 gviz（免授權、跨裝置）；寫入用本端點 type=saveMessage。
 */
var MSG_SHEET_NAME = '';        // 留空 = 第一個工作表
var MSG_HEADER_ROW = 1;
var MSG_START_COL = 14;         // N 欄
var MSG_WIDTH = 5;              // N..R
var MSG_HEADERS = ['留言時間', '姓名', '留言內容', '裝置', '留言ID'];
"""

gs = sub_once(gs, "var ENDPOINT_VERSION = 'v49';\n", VERSION_BLOCK, "gs:version")

# doGet: listMessages branch
gs = sub_once(
    gs,
    "  return ContentService.createTextOutput('RSVP endpoint is running. ' + ENDPOINT_VERSION)",
    "  // v50：留言列表（前端主要用 gviz 讀取；此為備援）\n"
    "  if (p.action === 'listMessages') {\n"
    "    return json_({ ok: true, messages: listMessages_() });\n"
    "  }\n"
    "  return ContentService.createTextOutput('RSVP endpoint is running. ' + ENDPOINT_VERSION)",
    "gs:doGet",
)

# doPost: saveMessage branch
gs = sub_once(
    gs,
    "    if (String(data.type || '').toLowerCase() === 'ecard') {\n"
    "      return json_(sendEcard_(data));\n"
    "    }\n",
    "    if (String(data.type || '').toLowerCase() === 'ecard') {\n"
    "      return json_(sendEcard_(data));\n"
    "    }\n"
    "    // v50：留言寫入（共用儲存，任何裝置可見）\n"
    "    if (String(data.type || '').toLowerCase() === 'savemessage') {\n"
    "      return json_(saveMessage_(data));\n"
    "    }\n",
    "gs:doPost",
)

# RSVP append: grow the grid first
gs = sub_once(
    gs,
    "      if (!updateExistingRow_(sheet, data)) {\n"
    "        sheet.appendRow(buildRow_(sheet, data));",
    "      if (!updateExistingRow_(sheet, data)) {\n"
    "        // v51：先確保列數足夠，避免工作表滿列時 appendRow 失敗\n"
    "        ensureRows_(sheet, sheet.getLastRow() + 1);\n"
    "        sheet.appendRow(buildRow_(sheet, data));",
    "gs:rsvpAppend",
)

MSG_FUNCS = """/* ------------------------------------------------------------------ *
 *  留言 → 試算表（N:R）
 * ------------------------------------------------------------------ */

function getMsgSheet_() {
  var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID)
                          : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('找不到試算表。');
  if (MSG_SHEET_NAME) { var named = ss.getSheetByName(MSG_SHEET_NAME); if (named) return named; }
  return ss.getSheets()[0];
}

function ensureMsgHeader_(sheet) {
  var r = sheet.getRange(MSG_HEADER_ROW, MSG_START_COL, 1, MSG_WIDTH);
  var cur = r.getValues()[0], need = false;
  for (var i = 0; i < MSG_WIDTH; i++) { if (String(cur[i] || '').trim() === '') { need = true; break; } }
  if (need) r.setValues([MSG_HEADERS]);
}

/** 寫入一則留言（不使用 appendRow，避免撞到 RSVP 的 A 欄） */
function saveMessage_(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getMsgSheet_();
    ensureMsgHeader_(sheet);
    var row = [
      pick_(data, ['date', 'time', '留言時間']) || new Date().toISOString(),
      pick_(data, ['name', '姓名']),
      pick_(data, ['text', 'message', '留言內容']),
      pick_(data, ['device', '裝置']),
      pick_(data, ['id', '留言ID']) || Utilities.getUuid()
    ];
    // v51：以 N 欄最後一列 +1 定位，並在需要時自動擴充列數（可無限成長）
    var maxRows = sheet.getMaxRows();
    var colN = sheet.getRange(1, MSG_START_COL, maxRows, 1).getValues();
    var lastMsg = MSG_HEADER_ROW;
    for (var i = 0; i < colN.length; i++) {
      if (String(colN[i][0] || '').trim() !== '') lastMsg = i + 1;
    }
    var target = Math.max(lastMsg + 1, MSG_HEADER_ROW + 1);
    ensureRows_(sheet, target);
    sheet.getRange(target, MSG_START_COL, 1, MSG_WIDTH).setValues([row]);
    return { ok: true, row: target };
  } finally {
    lock.releaseLock();
  }
}

/** 讀取全部留言（供 doGet?action=listMessages） */
function listMessages_() {
  var sheet = getMsgSheet_();
  var last = sheet.getLastRow();
  if (last <= MSG_HEADER_ROW) return [];
  var vals = sheet.getRange(MSG_HEADER_ROW + 1, MSG_START_COL, last - MSG_HEADER_ROW, MSG_WIDTH).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (String(r[1] || '').trim() === '' && String(r[2] || '').trim() === '') continue;
    out.push({ date: String(r[0] || ''), name: String(r[1] || ''), text: String(r[2] || ''),
               device: String(r[3] || ''), id: String(r[4] || '') });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 *  共用
 * ------------------------------------------------------------------ */"""

gs = sub_once(
    gs,
    "/* ------------------------------------------------------------------ *\n"
    " *  共用\n"
    " * ------------------------------------------------------------------ */",
    MSG_FUNCS,
    "gs:msgFuncs",
)
write(GS, gs)

# ------------------------------------------------------------- app.js ------
APP = "js/app.js"
app = read(APP)
app = sub_once(
    app,
    'var MSG_RANGE="N1:R1000";',
    '/* v109：移除 1000 列上限。開放式範圍 N:R 讓留言可無限成長'
    '（原本寫死 N1:R1000，第 1001 列之後的留言讀不到）。 */\n'
    'var MSG_RANGE="N:R";',
    "app:MSG_RANGE",
)
write(APP, app)

# ----------------------------------------------------------- index.html ----
IDX = "index.html"
idx = read(IDX)
idx = sub_once(idx, 'content="v108"', 'content="v109"', "index:version")
write(IDX, idx)

print("v109 patch applied OK")
