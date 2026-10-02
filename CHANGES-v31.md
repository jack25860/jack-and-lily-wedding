# v31 變更紀錄 — RSVP 改為「只寫入 Google 試算表」，不再寄送通知信

**版本**：v31（由 v30 複製；v30 及更早版本皆未更動）
**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**部署**：沿用既有 `deploy-site.yml`（`workflow_dispatch`，input `zip_url`），未新增或修改任何 workflow
**部署 run**：`37025673686` — completed / **success**（Pages build `37025705013` 亦 success）

---

## 一、需求與實作

| # | 需求 | 實作 |
|---|---|---|
| 1 | **移除 FormSubmit 寄信機制**（RSVP 不再寄到 jack25860@gmail.com、不再有任何 email 通知） | `initRsvp()` 送出流程改為**只做一件事**：把表單內容 POST 到 `SHEET_WEBAPP_URL`（Apps Script Web App）。移除 RSVP 路徑的 `fsPost(...)` 呼叫、`RSVP_PREFILL_FORM` 分支、`window.open(prefillURL,"_blank")` 新分頁、以及 `action`／`RSVP_FORM_ACTION`／`RSVP_FORM_LINK`／`RSVP_ENTRY_IDS` 相關程式碼。 |
| 2 | **沿用 v30 的 Apps Script 寫入方式與 10 欄架構** | 未改動 `scripts/rsvp-to-sheet.gs`（`doPost`／`doGet`、`LockService` 防搶號、`序號 = START_NO + 資料列數`）。欄位：`序號 / 您的姓名 / 您的信箱 / 您是哪一方的賓客 / 與新人的關係 / 是否能出席本次盛宴 / 出席人數 / 出席大人人數 / 出席兒童人數 / 需要兒童椅數量`。 |
| 3 | **維持 v30 送出體驗** | 不跳轉新分頁、頁面顯示「感謝您的回覆」提示卡（`#rsvpThanks`）、送出後清空表單回預設狀態（`resetRsvpForm()`）。 |
| 4 | **電子喜帖維持手動寄送** | `initEcardShow()` 與其 FormSubmit 寄送流程**完全未動**（此為喜帖寄送，與 RSVP 通知信不同）。 |

### 附帶修正：文案不再提及「通知信」
- `RSVP_INTRO`：`送出後我們會立即收到通知，並同步記錄於賓客名單` → `送出後將同步記錄於賓客名單`
- `RSVP_ECARD_TEXT`：改為「想收到專屬於您的電子喜帖嗎？點擊下方按鈕並輸入您的電子信箱，我們將為您寄出。」（不再暗示與 RSVP 表單綁定）
- `README.md`：RSVP 章節改寫為「直接寫入 Google 試算表」＋一次性設定步驟；另註明電子喜帖仍為手動寄送。

### 送出時的資料流（v31）
```
[網站 RSVP 表單]
   └─ 無 CORS POST ──→ SHEET_WEBAPP_URL（Apps Script /exec）  ← 逐筆寫入試算表、自動序號
   └─ 頁面顯示「感謝您的回覆」＋ 表單清空（不跳轉、不寄任何 email）
```
※ `SHEET_WEBAPP_URL` 為空時，送出會提示「回覆系統尚未設定完成，請稍後再試，或直接與新人聯繫。」（不再誤導賓客）。

---

## 二、線上實測（真實 Chromium 對正式站）

### RSVP 送出（3 情境，桌機 1440×900／行動版 390×844）
| 檢查項 | 出席（桌機） | 出席（行動版） | 不克出席（桌機） |
|---|---|---|---|
| **email 請求（formsubmit.co / mailto）** | **0** ✅ | **0** ✅ | **0** ✅ |
| **新分頁開啟** | **0** ✅ | **0** ✅ | **0** ✅ |
| **試算表 POST 請求** | 1 ✅ | 1 ✅ | 1 ✅ |
| 「感謝您的回覆」提示 | 顯示 ✅ | 顯示 ✅ | 顯示 ✅ |
| 姓名／信箱清空 | 空／空 ✅ | 空／空 ✅ | 空／空 ✅ |
| 出席／關係回預設 | 出席／家人 ✅ | 出席／家人 ✅ | 出席／家人 ✅ |
| 人數欄位回預設 | 1／0／0 ✅ | 1／0／0 ✅ | 1／0／0 ✅ |
| 水平溢出（scrollW = clientW） | 1440 = 1440 ✅ | 390 = 390 ✅ | 1440 = 1440 ✅ |
| Console / pageerror | 0 / 0 ✅ | 0 / 0 ✅ | 0 / 0 ✅ |

### 「不克出席」切換（送出前）
`#rsvpNumWrap` `display:none`、`hidden=true`，大人／兒童／兒童椅三 select 全 `disabled` ✅

### 電子喜帖（維持不變，已回歸驗證）
- 滿版大圖自動輪播：6 秒內 `is-on` 索引 0 → 2 ✅
- 手動寄送面板：點 CTA 展開 ✅；無效信箱 → 「請輸入有效的電子信箱…」且**不發任何請求** ✅；有效信箱 → 狀態 `is-ok`「電子喜帖已送出…」並實際發出 `formsubmit.co/jack25860@gmail.com` 請求 ✅

### Apps Script 序號遞增（本機以假試算表執行 `doPost`）
| 送出 | 寫入結果 |
|---|---|
| 出席（2 大 1 小 1 椅） | 序號 **1**，出席人數 3，大人 2／兒童 1／椅 1 ✅ |
| 不克出席 | 序號 **2**，大人／兒童／椅皆**留空**、出席人數 0 ✅ |
| 出席（3 大 2 小 2 椅） | 序號 **3**，出席人數 5，大人 3／兒童 2／椅 2 ✅ |

### 線上檔案一致性
`index.html`、`js/app.js`、`js/config.js` 線上 md5 與 v31 建置檔**完全相同**；`css/styles.css`、`scripts/rsvp-to-sheet.gs` 皆 HTTP 200。

---

## 三、變更檔案
| 檔案 | 動作 |
|---|---|
| `index.html` | 修改：RSVP 說明文字、電子喜帖說明文字 |
| `js/config.js` | 修改：`RSVP_INTRO`、`RSVP_ECARD_TEXT` |
| `js/app.js` | 修改：`initRsvp()` 送出流程（移除 FormSubmit／prefill／新分頁，只保留試算表寫入） |
| `README.md` | 修改：RSVP 章節改為試算表寫入說明 |
| `scripts/rsvp-to-sheet.gs` | 未變更（沿用 v30） |
| `scripts/verify-v31.py`、`verify-v31-ecard.py`、`verify-v31-sheet.js` | 新增：驗證腳本 |

---

## 四、需要使用者完成的一次性設定（約 5 分鐘）
目前 `SHEET_WEBAPP_URL` 為空 → **送出不會寫入試算表**（會顯示「回覆系統尚未設定完成」）。完成以下步驟即啟用：

1. 開啟回覆試算表 → 「**擴充功能**」→「**Apps Script**」
2. 貼上 `scripts/rsvp-to-sheet.gs` 全文並儲存
3. 「**部署**」→「**新增部署**」→ 類型「**網頁應用程式**」→ 執行身分「**我**」、存取權「**所有人**」→ 部署並授權
4. 複製結尾為 **`/exec`** 的網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL`
5. 重新部署網站

**驗證**：瀏覽器直接開該 `/exec` 網址，出現「RSVP endpoint is running.」即成功。
