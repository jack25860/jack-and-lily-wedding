#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v110 patch: RSVP writes by serial number instead of getLastRow().

Root cause: getLastRow() returns the last row that has content OR formatting.
The earlier 1000-row test wrote A1001:L1005; clearing the values left the
formatting behind, so getLastRow() kept reporting 1005. The old nextSerial_()
derived the serial from getLastRow(), so a new guest got serial 1005 and
appendRow() pushed the row to 1006.

Fix (v52):
  * serialScan_() scans only column A values, skipping blanks/formatting.
  * nextSerial_() = maxSerial + 1 (supports manually inserted guests).
  * nextDataRow_() = last data row + 1 (no blank rows in between).
  * doPost writes with getRange(targetRow).setValues() instead of appendRow().
  * diag exposes serial diagnostics.
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
        sys.exit("FAIL [%s]: expected 1 occurrence, found %d" % (label, n))
    return text.replace(old, new, 1)


GS = "scripts/rsvp-to-sheet.gs"
gs = read(GS)

gs = sub_once(gs, "var ENDPOINT_VERSION = 'v51';",
              "var ENDPOINT_VERSION = 'v52';", "version")

OLD_APPEND = (
    "        ensureRows_(sheet, sheet.getLastRow() + 1);\n"
    "        sheet.appendRow(buildRow_(sheet, data));")

NEW_APPEND = (
    "        var targetRow = nextDataRow_(sheet);\n"
    "        ensureRows_(sheet, targetRow);\n"
    "        sheet.getRange(targetRow, 1, 1, ROW_WIDTH).setValues([buildRow_(sheet, data)]);")

gs = sub_once(gs, OLD_APPEND, NEW_APPEND, "doPost")

OLD_NEXT = (
    "function nextSerial_(sheet) {\n"
    "  var last = sheet.getLastRow();\n"
    "  var dataRows = last >= HEADER_ROW ? last - HEADER_ROW : 0;\n"
    "  return START_NO + dataRows;\n"
    "}")

NEW_NEXT = """/**
 * v52: identify by SERIAL NUMBER, never by getLastRow().
 *
 * getLastRow() returns the last row holding content OR formatting. The earlier
 * 1000-row test wrote A1001:L1005; clearing the values left the formatting, so
 * getLastRow() kept reporting 1005 -> serial became 1005 and the row was
 * appended at 1006.
 *
 * Rules:
 *   1. Scan only column A (serial) VALUES; skip blanks and leftover formatting.
 *   2. Take the largest valid serial N (supports manually inserted guests).
 *   3. New guest serial = N + 1, written on the row right after the last valid
 *      data row, with no blank rows in between.
 */
function serialScan_(sheet) {
  var maxRows = sheet.getMaxRows();
  var colA = sheet.getRange(HEADER_ROW + 1, 1, Math.max(maxRows - HEADER_ROW, 1), 1).getValues();
  var maxNo = START_NO - 1;
  var lastRow = HEADER_ROW;
  for (var i = 0; i < colA.length; i++) {
    var raw = colA[i][0];
    if (raw === '' || raw == null) continue;
    var n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
    if (isNaN(n)) continue;
    if (n > maxNo) maxNo = n;
    var rowNo = HEADER_ROW + 1 + i;
    if (rowNo > lastRow) lastRow = rowNo;
  }
  return { maxNo: maxNo, lastRow: lastRow };
}

function nextSerial_(sheet) {
  return serialScan_(sheet).maxNo + 1;
}

/** Row to write the next record: right after the last valid data row. */
function nextDataRow_(sheet) {
  return serialScan_(sheet).lastRow + 1;
}

/** v52: serial diagnostics for doGet?diag=1 */
function serialDiag_() {
  try {
    var sheet = getSheet_();
    var s = serialScan_(sheet);
    return {
      maxSerial: s.maxNo,
      lastDataRow: s.lastRow,
      nextSerial: s.maxNo + 1,
      nextRow: s.lastRow + 1,
      lastRowApi: sheet.getLastRow(),
      maxRows: sheet.getMaxRows()
    };
  } catch (e) {
    return { error: String(e) };
  }
}"""

gs = sub_once(gs, OLD_NEXT, NEW_NEXT, "nextSerial")

gs = sub_once(
    gs,
    "      lastEcard: readLastSend_()\n    });",
    "      lastEcard: readLastSend_(),\n"
    "      serial: serialDiag_()\n    });",
    "diag")

write(GS, gs)

idx = read("index.html")
idx = sub_once(idx, 'content="v109"', 'content="v110"', "index")
write("index.html", idx)

print("v110 patch applied OK")
