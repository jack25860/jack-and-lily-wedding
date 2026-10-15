# v43 變更說明

**版本**：v43（由 v42 複製；v42 及更早版本皆未更動）
**日期**：2026-10-03
**正式站**：https://jack25860.github.io/jack-and-lily-wedding/

---

## 一、網站改版內容（v43 主體）

### 1. 婚禮當日注意事項：內容補齊

網站於 v42 時即已有 `#notes`（PLEASE NOTE／婚禮當日注意事項）區塊，但多數卡片顯示 `［待補充］`。v43 補齊如下：

| 卡片 | 變更後 |
|---|---|
| 婚宴時間 | **12:00**（12 點開始） |
| 座位安排 | **座位表將於近日公布**（＋新增預留按鈕） |
| Dress Code | **正式服裝** |
| 拍照注意事項 | **努力拍出最好看的照片** |
| 禮金／紅包資訊 | **現場工作人員簽到時收取** |
| 其他提醒 | **攜帶愉悅開心的心情前往** |

未變更：婚禮日期（2027-04-17）、報到時間（11:30）、停車資訊（會館周邊設有停車場）。

### 2. 座位安排連結預留（⚠️ 此連結待補）

「座位安排」卡片新增按鈕 **「查看座位表」** 與提示 **「座位表將於近日公布」**，由 `js/config.js` 的 **`SEATING_URL`** 控制：

| `SEATING_URL` | 按鈕 | 提示 |
|---|---|---|
| 空字串（**目前**） | 顯示但**停用**（虛線邊框、半透明、`aria-disabled`、點擊不動作） | 顯示「座位表將於近日公布」 |
| 填入 `https://…` | 啟用並指向該網址 | 隱藏 |

> **日後只要在 `js/config.js` 填入座位表網址並重新部署，按鈕即自動啟用，無需再改程式。**

### 3. v43 修改檔案

`index.html`（座位安排卡片新增按鈕＋提示）｜`js/config.js`（補齊 6 項內容、新增 `SEATING_URL`／`SEATING_LINK_TEXT`／`SEATING_PENDING_TEXT`）｜`js/app.js`（新增 `initSeating()`）｜`css/styles.css`（按鈕／提示樣式）｜`scripts/rsvp-to-sheet.gs`（`ENDPOINT_VERSION` → v43）

### 4. v43 驗證結果（真實 Chromium）

| 驗證 | 結果 |
|---|---|
| 線上 `js/app.js`／`index.html`／`css/styles.css` md5 | 與 v43 建置檔完全一致 |
| 桌機 1440×900 | 9 張卡片內容正確、座位表按鈕停用＋提示僅出現一次、無破版、無水平捲動、無 console error |
| 行動版 390×844 | 單欄排列、9 張卡片無溢出、無水平捲動、無 console error |
| 導覽錨點 `#notes` | 點擊可正確捲動至該區塊 |

---

## 二、Repo 整理（本次新增工作）

本次為 **repo 整理，非網站改版** — 未更動任何線上網站內容（`index.html`／`css`／`js`／`images`／`audio` 一律未動）。

### A. 移除的檔案（共 52 個）

| 類別 | 數量 | 檔案 | 移除理由 |
|---|---|---|---|
| **舊版部署流程** | 1 | `.github/workflows/deploy.yml` | ① 從未執行過（40+ 筆 Actions 紀錄中 **0 筆**由 push 觸發）② 其下載來源（v14 舊站 zip）簽章已過期，實測 **HTTP 403**，執行必失敗 ③ **與 `deploy-site.yml` 的 `name` 完全相同**（皆為 `Deploy wedding site`），在 Actions 手動選單中易被誤選 ④ 最關鍵：它綁定 `push` 到 `main`，一旦有人直接 push，會把網站**覆蓋回 v14 舊版**。移除後僅保留 `deploy-site.yml`（`workflow_dispatch`），不再有此風險。 |
| **舊版驗證腳本** | 25 | `verify-v30.py`、`verify-v31.py`、`verify-v31-ecard.py`、`verify-v31-sheet.js`、`verify-v32.py`、`verify-v32-live.py`、`verify-v32-sheet.js`、`verify-v33-live.py`、`verify-v34.py`、`verify-v34-live.py`、`verify-v34-sheet.js`、`verify-v35-config.js`、`verify-v35-live.py`、`verify-v35-sheet.js`、`verify-v36-config.js`、`verify-v36-live.py`、`verify-v36-sheet.js`、`verify-v37-live.py`、`verify-v37-sheet.js`、`verify-v38-sheet.js`、`verify-v40-live.py` | 各版本專屬的階段性測試殘留檔，僅供當時版本驗證使用；全站 0 引用。**最新版驗證工具保留**：`verify-v39-sheet.js`（去重／`lastEcard` 專項）、`verify-v42-live.py`（正式站瀏覽器驗證）、`verify-v42-sheet.js`（Apps Script 離線 harness）。 |
| **一次性產生器** | 6 | `gen-v35-config.py`、`gen-v35-gs.py`、`gen-v36-config.py`、`mk-featured-v36.py`、`mk-sheets-v36.py`、`mk-sheets.py` | v35／v36 建置當時用的一次性工具，已完成任務且無再用；全站 0 引用。 |
| **探測／截圖暫存腳本** | 4 | `pm-probe-ecard.py`、`pm-shots.py`、`pm-shots2.py`、`probe-cors.py` | 接力過程中的臨時探測與截圖腳本；全站 0 引用。 |
| **已淘汰的縮圖／聯絡表** | 20 | `sheets/sheet_1–9.jpg`、`sheets/featured18.jpg`、`sheets/v36_sheet_1–9.jpg`、`sheets/v36_featured18.jpg` | 7.40 MB，為相簿排版的**已被取代**產物；`sheets/` 目錄在 `index.html`／`js`／`css` 中 **0 引用**（實測 `grep` 命中 0）。最新版相簿改由 `images/album/` 的 142 張直接驅動。 |

**小計：刪除 52 個檔案，釋放約 7.46 MB。**

### B. 保留但標示為「未使用」的檔案（未刪除，供人工確認）

| 檔案 | 大小 | 說明 |
|---|---|---|
| `images/ch1-encounter.jpg` | 318 KB | 逐檔比對後確認**未被任何程式引用**。網站目前使用 `-ink`／`-ink-v20`／`-sketch` 系列；此為早期版本，留存供你可能想改回舊風格時使用。 |
| `images/ch2-knowing.jpg` | 182 KB | 同上 |
| `images/ch3-understanding.jpg` | 206 KB | 同上 |
| `images/ch4-love.jpg` | 147 KB | 同上（目前使用 `ch4-love-ink-v20.jpg`／`ch4-love-oil.jpg`） |
| `images/ch5-forever-gongbi.jpg` | 203 KB | 同上 |
| `images/ch5-forever.jpg` | 203 KB | 同上（目前使用 `ch5-forever-ink-v20.jpg`） |
| `images/m1.jpg` – `images/m6.jpg` | 共 1.48 MB | 未被引用的婚紗照，`m` 前綴不在任何主題的 `FEATURED`／`MORE` 清單中，也不在 `ECARD_PHOTO_POOL` 內。若確認不要可直接刪除。 |

**合計 12 個檔案、約 2.61 MB，保留並標示。**

> 判斷原則：這些是「內容圖片」而非「程式產物」——刪掉無法從版本控管還原出正確的圖片，且可能是刻意保留的候選素材，因此依指示**保留並標示**，不貿然刪除。

### C. 明確保留（必要檔案，未動）

| 檔案／目錄 | 保留理由 |
|---|---|
| `.github/workflows/deploy-site.yml` | **唯一**部署流程，任務要求不新增／不修改 |
| `scripts/rsvp-to-sheet.gs` | 網站後端核心（RSVP 寫表、電子喜帖寄信、`diag` 健康檢查） |
| `scripts/send-invitation.gs` | 舊版「表單觸發自動寄喜帖」腳本；雖目前未使用，但為可用的備援方案且有文件說明，故保留 |
| `scripts/ecard-email-preview.html` | 電子喜帖信件 HTML 的離線設計預覽稿；雖未被引用，但為設計參考文件（2.4 KB），保留 |
| `scripts/verify-v39-sheet.js`、`verify-v42-live.py`、`verify-v42-sheet.js` | 現行版本的驗證 harness，記錄了關鍵驗證邏輯 |
| `CHANGES-v24.md` – `CHANGES-v42.md` | 版本歷程的權威來源 |
| `images/album/`（142 張） | 相簿主題與電子喜帖隨機池（全池）所需 |
| `.nojekyll` | 關閉 Jekyll，GitHub Pages 必需 |

### D. 新增／更新的檔案

| 檔案 | 動作 | 說明 |
|---|---|---|
| `README.md` | **重寫** | 完整盤點專案簡介、正式站／repo、目錄結構、部署方式（含常見失敗原因）、版本控管規則、`js/config.js` 全部重要設定、**Apps Script 待辦**、目前最新版本與完整版本歷程、本次整理紀錄 |
| `CHANGES-v43.md` | **新增** | 本檔（v43 網站改版說明 ＋ repo 整理紀錄） |

> **說明**：`README.md` 的修訂，是為了讓「如何部署、如何改內容、Google 端要手動做什麼、目前版本到哪裡」不再散落在各處。原 README 停在 v22，且仍描述已改掉的電子喜帖 FormSubmit 手動流程。

---

## 三、⚠️ 使用者待辦（必要，否則電子喜帖仍不會寄出）

**Google 端 Apps Script 專案仍需手動同步。** `scripts/rsvp-to-sheet.gs` 只是 repo 內的版本控管副本；**部署到 GitHub Pages 不會更新 Google 端的 Apps Script 專案**。

1. 開啟回覆試算表 → 「擴充功能」→「Apps Script」
2. 將 `scripts/rsvp-to-sheet.gs`（**v43 全文**）貼上並儲存
3. 函式選 **`testEcard`** → 執行 → 同意 **Gmail 寄信權限**
4. 「部署」→「管理部署」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
5. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL` 並重新部署網站

**驗證方式**：開啟 `/exec?diag=1`，出現 `"version":"v43"` 且 `"mailScope":true` 即完成。

---

## 四、維持不變

酒紅 `#6E1626`／金 `#C9A961`／宣紙米色 `#F5F0E7`；RSVP 送出流程不變；電子喜帖為手動寄送、信件內直接內嵌圖片與隨機婚紗照（142 張全池）；大人出席人數上限 10 人；電子喜帖去重窗期 8 秒；電子喜帖寄送成功後清空輸入框；桌機與行動版不破版、無水平捲動。
