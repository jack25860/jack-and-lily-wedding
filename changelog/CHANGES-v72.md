# v72 變更摘要（座位表）

本版為 v71 的介面精簡，共 1 項。

## 變更：移除結果卡下方的兩顆行動按鈕

**現象**：查詢命中後，結果卡最下方有兩顆按鈕——「在座位圖查看我的桌次」（酒紅底金字）與「查詢其他姓名」（白底酒紅框），佔用版面且與既有操作路徑重複。

**修正**：
- 移除 `js/seating.js` 中 `renderFound()` 內兩顆按鈕的 HTML 產生程式碼（`#seatRcGo`、`#seatRcAgain`）與其 `focusTable()` / `resetQuery()` 點擊事件繫結。
- 移除 `css/seating.css` 中兩顆按鈕的全部樣式：
  - 桌機：`.seat-rc__acts`、`.seat-rc__btn`、`:hover`、`:focus-visible`、`--ghost`、`--ghost:hover`（共 6 條規則）。
  - 手機（`max-width:768px`）：`.seat-rc__acts{flex-direction:column…}`、`.seat-rc__btn{justify-content:center}`。
  - `prefers-reduced-motion`：`.seat-rc__btn` 自 transition 停用清單移除。
  - `forced-colors`：`.seat-rc__btn` 自高對比邊框清單移除。
- **未動** `.seat-rc__chip`（候選／相似名單 chip），該樣式仍在使用中。

## 功能保留分析（確認移除後不受影響）

| 原本按鈕 | 它做的事 | 移除後仍可用的路徑 |
|---|---|---|
| 在座位圖查看我的桌次 | `focusTable(tableNodes[r.tableNo])` | **查詢命中時座位圖即自動捲動並聚焦該桌**（`showHit()` 內 `if (opts.focus !== false) focusTable(tn)`），故此鈕本就只是重複動作。另可用 `.seat-fab`「快速查詢座位」浮動鈕回到查詢區。 |
| 查詢其他姓名 | `resetQuery(true)` | 上方查詢欄可直接改輸入重新查詢；`#seatClear`（✕）可清空；查詢欄內建即時建議清單（combobox）；`Esc` 鍵可清除。 |

因此兩顆按鈕皆為備援路徑，移除後查詢 → 結果卡 → 座位圖高亮 → 重新查詢的完整流程不受影響。

## 版面效果

- 結果卡高度減少（少了一列 `margin-top: var(--q-5)` + 按鈕高度 `min-height: var(--q-touch-min)`），手機與桌機皆更緊湊。
- 結果卡與下方座位圖之間的間距縮短，查詢結果與座位圖更容易同屏對照。

## 保留不變（回歸確認）

- 人數資訊：`同行人數` 大字 + `大人 N`／`兒童 N` 分項徽章。
- 兒童椅：一律以問卷「需要兒童椅數量」（`childSeats`）為唯一依據；`childSeatText` 區塊與座位圖三重編碼（專屬顏色 + 外環 + 高腳椅圖示）。
- 座位圖：16 桌（1 主桌 + 15 側桌）、162 座位；整團高亮（`seat..seatEnd` 全數金色閃爍）、整團弧線、兒童椅座位青色外環。
- 最近查詢上限 3 筆；手機單指拖曳平移（`touch-action:pan-x pan-y`）。

---

## 驗證清單

| 項目 | 檢查方式 | 結果 |
|---|---|---|
| 兩顆按鈕已移除（DOM） | `#seatRcGo` / `#seatRcAgain` / `.seat-rc__acts` / `.seat-rc__btn` 查詢數 | 全為 0 ✅ |
| 按鈕文字已不存在於頁面 | `document.body.textContent` 搜尋兩個標籤 | 皆 false ✅ |
| 死碼 CSS 已清除 | 走訪 `document.styleSheets` 的 `cssRules` 搜尋 `seat-rc__btn`／`seat-rc__acts` | 皆 false ✅ |
| 結果卡內無任何按鈕 | `#seatResult button` 查詢數（有／無兒童椅兩情境） | 0 ✅ |
| 無 JS 錯誤 | 監聽 `error` 事件 + 包裝 `console.error`，執行 2 次查詢 | 0 筆 ✅ |
| 查詢功能正常（無兒童椅） | 查 `TEST` → 2 桌 第 6～9 號，大人 3、兒童 1，兒童椅 0 | ✅ |
| 查詢功能正常（有兒童椅） | 查 `DD` → 2 桌 第 1～5 號，大人 3、兒童 2，兒童椅 1 張（第 5 號） | ✅ |
| 整團高亮 | `seat-hit` 座位數 = 團體人數；兒童椅座位含 `seat-hit--child` | 4/4、5/5 ✅ |
| 無水平溢位 | 390 / 360 / 768 / 1440 四種寬度 `scrollWidth <= clientWidth` | 皆無 ✅ |
| JS 語法 | `node --check js/seating.js` | JS OK ✅ |
| 版本標記 | `meta[name=site-version]` | `v72` ✅ |
