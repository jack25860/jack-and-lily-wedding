# CHANGES v67 — 座位表：資料模型與人數一致性修正 + 兒童椅標示

- 版本：v67（前版 v66）
- 頁面：`seating.html`（獨立頁，主站 index.html 未連結）
- 線上：https://jack25860.github.io/jack-and-lily-wedding/seating.html
- 變更檔案：`seating.html`、`js/seating.js`、`js/seating-config.js`、`js/seating-data.js`、`css/seating.css`、`scripts/seating-from-sheet.gs`、`CHANGES-v67.md`
- 未變更：`index.html`、`css/styles.css`、`images/`、`audio/`（v66 及更早版本目錄亦未更動）

---

## 一、修正問題 1：表單填寫人數與查詢結果不匹配

### 根因
- 舊版資料模型「一筆回覆 = 一位賓客」，只讀取姓名／桌次／座位，**完全沒有讀取問卷的
  「出席人數／大人／兒童／兒童椅」欄位**，因此查詢結果無法反映表單實際填寫的人數。
- 舊版資料來源僅有 Apps Script（`API_URL`）一層，且該端點在瀏覽器端常因 CORS／冷啟動
  而失敗，導致頁面長期回退到「示範備援名單」，與問卷回覆完全脫節。

### 修正
1. **資料模型改為「同行團體（party）」**：每一筆問卷回覆新增四個欄位
   - `partySize` 出席人數（大人＋兒童）
   - `adults` 出席大人人數
   - `children` 出席兒童人數
   - `childSeats` 需要兒童椅數量
2. **資料讀取改為多層（依序嘗試）**，直接讀取問卷回覆試算表：
   1. `SHEET_GVIZ_URL` — Google 試算表 gviz JSON（最穩定，已驗證 200 + CORS）
   2. `SHEET_CSV_URL` — Google 試算表 CSV
   3. `API_URL` — Apps Script Web App JSON
   4. `js/seating-data.js` — 本機備援名單（前三者皆失敗時）
3. **人數計算與配位邏輯重寫**：`assignSeats()` 依 `partySize` 由第 1 位起**連續配位**，
   並記錄 `seatEnd`（本團體佔用的座位區間）；查詢結果卡顯示
   「同行 N 人（大人 X・兒童 Y）」與座位區間，與表單填寫人數一致。
4. **每桌人數上限檢查**：若某團體放不進該桌剩餘座位（超過該桌上限），
   該團體改標記為未分配，查詢時顯示「由現場人員安排」，並於頁面提示超額。

### 欄位對應（可調）
- 前端：`js/seating-config.js` → `SHEET_COLS`（header / aliases / index）
- 後端：`scripts/seating-from-sheet.gs` → `COL_PARTY / COL_ADULTS / COL_CHILDREN / COL_CHILDSEATS`
- 預設對應問卷欄名：`出席人數`、`出席大人人數`、`出席兒童人數`、`需要兒童椅數量`

---

## 二、修正問題 2：兒童座椅未特別標示

1. **座位圖**：需要兒童椅的座位以**專屬顏色（青瓷藍 `#cfe6ea` / 邊框 `#2f6b7a`）**標示，
   與一般座位（米色）明顯區隔；該桌另顯示「椅N」徽章，一眼可辨識。
2. **圖例**：新增「兒童椅」色票，讓賓客與現場人員理解顏色含義。
3. **查詢結果卡**：顯示「🪑 兒童椅 N 張（座位圖已以專屬顏色標示）」。
4. **無障礙**：座位點附 `<title>` 文字（滑過顯示「姓名 · N號（兒童椅）」），
   並於 `forced-colors` 高對比模式保留邊框可辨識。

---

## 三、其他

- 桌數固定 16 桌（1 主桌 + 15 側桌），畫面桌數不得大於 16（`MAX_TABLES = 16`）。
- 桌號由試算表「桌次」欄手動填入、頁面自動讀取；無效或查無對應桌次顯示「由現場人員安排」。
- 快取鍵更新為 `ssss-seating-remote-v5`（資料結構新增欄位）。
- 版本標記：`<meta name="site-version" content="v67">`。

---

## 四、部署後需人工處理（Google 端）

> GitHub Pages 部署**不會**更新 Google Apps Script 專案；`scripts/seating-from-sheet.gs`
> 僅為版控副本。若仍要使用 Apps Script 來源，請手動：
> 1. 開啟問卷回覆試算表 → 擴充功能 → Apps Script → 貼上本版 `.gs` → 儲存
> 2. 執行授權函式 → 管理部署 → 建立新版本
>
> **但 v67 起前端已優先使用 gviz 直讀試算表**，只要試算表設為
> 「知道連結的人可以檢視」，即使不更新 Apps Script 也能取得正確名單與人數。
