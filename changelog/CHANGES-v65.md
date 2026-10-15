# CHANGES v65 — 座位表頁面架構重建

> 版本：v65（前一版 v64）
> 頁面：`seating.html`（獨立頁，主網站 index.html 無入口）
> 線上：https://jack25860.github.io/jack-and-lily-wedding/seating.html

## 一、本次需求與對應實作

| # | 需求 | 實作 |
|---|------|------|
| 1 | 移除所有放大／縮小功能 | v63 已移除座位圖「＋／－／重設」縮放鈕；v65 再確認全站無任何 zoom 控制（`seating.js` 無 `zoom`／`applyZoom`／`bindZoom`，`seating.html` 無縮放工具列）。座位圖改為固定寬度、隨裝置自適應。 |
| 2 | 手機與電腦皆可正常瀏覽（響應式、無水平溢位） | `css/seating.css` 新增 v65 響應式強化：`.seat-page{overflow-x:hidden}`、`.seat-main{overflow-x:clip}`；所有區塊 `max-width:100%`；SVG `max-width:100%`；查詢結果長字串 `overflow-wrap:anywhere`；新增 ≤900px／≤640px／≤380px 三段斷點收斂字距與內距。 |
| 3 | 固定 16 桌（1 主桌 + 15 桌），畫面桌數不得大於 16 | `js/seating.js` 新增硬性上限 `MAX_TABLES = 16`，`deriveAll()` 內 `TABLES.length > 16` 即截斷；`normalizeRemote()` 一律以 `BASE_TABLES`（前端固定 16 桌）為準，API 只提供賓客名單、不決定桌數。 |
| 4 | 移除頁面下方「已連線 X 位賓客」提示 | v64 已移除成功狀態文字；v65 確認 `applyData()` 成功時 `statusText` 為 `null`，不顯示任何「已連線」字樣（僅保留 API 失敗／逾時／未設定的容錯提示）。 |
| 5 | 桌次號由試算表手動填入，頁面自動讀取當前桌號並分配；無效或查無對應桌次顯示「由現場人員安排」 | `scripts/seating-from-sheet.gs` 讀取「桌次」欄；桌號非 1~16 或未填者 `table: null`。前端 `normalizeRemote()` 以 `validTableNos` 驗證，無效者標記 `unassigned`，查詢結果顯示「由現場人員安排」，不顯示錯誤桌號。 |
| 6 | 某桌填寫人數超過該桌人數上限 → 提示或改由現場人員分配 | **v65 新增**：`normalizeRemote()` 逐桌累計人數，超過該桌上限（`TABLES[].seats`，預設 `VENUE.seatsPerTable` = 10；主桌 12）者標記 `overflow` 並改為未分配（顯示「由現場人員安排」）；`applyData()` 於座位圖下方顯示提示「部分桌次人數已達上限，超額賓客將由現場人員安排。」（`#seatCapacity`，僅在偵測到超額時顯示）。 |

## 二、變更檔案

- `seating.html`：版本標記 v64 → v65；新增 `#seatCapacity` 上限提示區；說明文字更新。
- `js/seating.js`：新增 `MAX_TABLES`、`defaultSeatsPerTable`、`capacityText`、`capacityEl`；`deriveAll()` 截斷桌數；`normalizeRemote()` 新增每桌人數上限檢查；`applyData()` 顯示上限提示；`boot()` 取得 `#seatCapacity`。
- `js/seating-config.js`：`CACHE_KEY` v3 → v4（資料結構新增 `overflow` 標記）。
- `js/seating-data.js`：`OPTIONS` 新增 `capacityText`。
- `css/seating.css`：新增 `.seat-capacity` 樣式與 v65 響應式強化區塊。
- `scripts/seating-from-sheet.gs`：`ENDPOINT_VERSION` → `seating-v65`（僅版本標記；欄位對應與桌數邏輯沿用 v64）。

## 三、部署注意

- 網站（GitHub Pages）由 `deploy-site.yml` 以 `workflow_dispatch` 部署。
- **Google Apps Script 專案不會隨網站部署更新**：`scripts/seating-from-sheet.gs` 僅為版控副本。若需更新 Google 端，請手動貼上 `.gs` → 執行授權函式 → 管理部署 → 新版本。
- 桌次號請於問卷回覆試算表的「桌次」欄手動填入（1~16）；未填或填錯者，頁面會顯示「由現場人員安排」。
