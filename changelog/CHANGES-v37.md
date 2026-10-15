# v37 — 電子喜帖寄信鏈路修復（信件沒收到的根本原因）

**日期**：2026-10-03
**基準版本**：v36（v36 及更早版本皆未更動）
**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**部署**：沿用既有 `deploy-site.yml`（`workflow_dispatch`，input `zip_url`）— 未新增、未修改任何 workflow

---

## 一、問題
使用者反映：**沒有收到電子喜帖的信件**。

## 二、根本原因（以真實請求實測確認）

### 主因：部署的 Apps Script 沒有 Gmail 寄信權限（OAuth scope）
對線上 `/exec` 直接送出電子喜帖請求，回傳：

```json
{"ok":false,"error":"Exception: The script does not have permission to perform that action. Required permissions: (https://mail.google.com/ || https://www.googleapis.com/auth/gmail.send || https://www.googleapis.com/auth/gmail.compose || https://www.googleapis.com/auth/gmail.modify || https://www.googleapis.com/auth/gmail.addons.current.action.compose)"}
```

`GmailApp.sendEmail()` 因此拋出授權例外，**信件從未寄出**。

**為什麼會這樣**：該 Apps Script 專案原本只被授權過 **Sheets** 範圍（RSVP 寫入試算表正常）。電子喜帖（`GmailApp.sendEmail`）是後來才加入的功能，**專案從未重新走過一次授權流程**，因此 Gmail 範圍沒有被授予。

### 次因：前端把錯誤「吞掉」了（已修復）
`postRow()` 原本使用 `mode:"no-cors"`，回應是 **opaque**，前端**無法讀取**後端回傳的 `{ok:false,...}`，因此一律顯示「已送出」——使用者以為寄出了，實際上沒有。

**實測證明**：以真實 Chromium 從正式站對 `/exec` 發 POST，**可以讀到**回應內容（`{"ok":false,"error":"...permission..."}`）。也就是說 CORS 其實允許讀取，是 `no-cors` 自己把結果丟掉了。

### 附帶發現
- 線上 `/exec` 目前回傳 **`RSVP endpoint is running. v35`** → 線上 Apps Script 仍是 **v35**（v36 的 `.gs` 只存在於 GitHub repo，**不會**自動更新 script.google.com 上的專案）。
- `GET /exec?diag=1` 在舊版（v35）會被忽略，回傳純文字而非 JSON。

## 三、修復內容

### A. 前端（`js/app.js`）— 已部署上線
1. **`postRow()` 改為先讀取真實回應**：`plain()` 以一般 CORS 讀取並 `JSON.parse`；若失敗才退回 `opaque()`（`no-cors`）。回傳 `{ok:true/false,...}`。
2. **電子喜帖送出後依真實回應顯示**：
   - `ok:false` 且訊息含 `permission`／`authoriz`／`scope` → 顯示「電子喜帖功能尚未完成授權：請於 Apps Script 執行 testEcard 完成 Gmail 授權，並重新部署新版本後再試。」
   - 其他失敗 → 「電子喜帖寄送失敗，請稍後再試。」
   - 成功 → 「電子喜帖已送出…」
3. **RSVP 送出**同步改為檢查 `ok:false`（失敗時顯示錯誤並提供備援，不再誤顯示成功）。
4. 送出期間按鈕 `disabled` + `aria-busy`。

### B. Apps Script（`scripts/rsvp-to-sheet.gs`）— 待使用者貼上並授權
1. **`sendEcard_` 加 try/catch**：Gmail 授權失敗時回傳 `{ok:false, error:'mail_scope_missing', detail:...}`，不再靜默失敗。
2. **新增 `doGet(?diag=1)`**：回傳 `{ok, version, mailScope, sender, quota}`，`mailScope` 以 `MailApp.getRemainingDailyQuota()`／`GmailApp.getAliases()` 實際探測。
3. **新增 `testEcard()`**：在 Apps Script 編輯器執行一次即觸發 Google 授權視窗（取得 Gmail 寄信權限），並寄一封測試信給自己。
4. 新增 `ECARD_VIDEO_URL` / `ECARD_VIDEO_POSTER` 常數（影片留空時以圖片代替）。
5. `ENDPOINT_VERSION` → **`v37`**。

## 四、驗證

| 驗證 | 結果 |
|---|---|
| `scripts/verify-v37-sheet.js`（Node stub 實跑 `doPost`/`doGet`） | **43/43 通過** |
| `scripts/verify-v37-live.py`（正式站真實 Chromium，桌機＋行動版） | **34/34 通過** |
| 線上 `/exec` POST 電子喜帖（修復前） | 重現 `permission` 例外 ✅ |
| 前端可讀取 POST 回應 | ✅（`readable:true`，非 no-cors 黑洞） |
| 前端顯示明確授權提示 | ✅（桌機＋行動版） |
| RSVP 回歸（立即鎖定→感謝→清空→不跳轉→0 email） | ✅ |
| 不克出席（人數隱藏＋停用） | ✅ |
| 無水平捲動／無 console error／無 pageerror | ✅ |

**尚未達成**：`/exec?diag=1` 回傳 `mailScope:true` 與「實際收到測試信」——**卡在使用者必須手動完成 Apps Script 授權**（無 API 可代為授權）。

## 五、需要使用者執行的一次性動作（關鍵，約 2 分鐘）

**必須重新授權並重新部署 Apps Script，電子喜帖才會真正寄出：**

1. 開啟回覆試算表 → 「擴充功能」→「Apps Script」
2. 貼上 `scripts/rsvp-to-sheet.gs` **全文**，儲存
3. 函式下拉選 **`testEcard`** → 按「**執行**」→ 同意 Google 授權（要求 Gmail 寄信權限）
   - 執行後會寄一封測試信到你的信箱，**收到即代表授權成功**
4. 「部署」→「管理部署」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
5. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL` 並重新部署網站

**驗證**：瀏覽器開 `…/exec?diag=1`，出現 `"mailScope":true` 即完成。

## 六、維持不變
酒紅 `#6E1626`／金 `#C9A961`／宣紙米色；RSVP 送出流程（立即提示→感謝→清空→不跳轉→不寄通知信）；不克出席時人數欄位隱藏／停用且不列入送出；電子喜帖為手動寄送、信件內直接內嵌圖片與隨機婚紗照（142 張全池）；桌機與行動版不破版、無水平捲動。

## 七、變更檔案
- `js/app.js`（postRow 讀取真實回應、電子喜帖／RSVP 依 `ok:false` 顯示錯誤、送出鎖定）
- `scripts/rsvp-to-sheet.gs`（try/catch、diag、testEcard、影片常數、v37）
- `scripts/verify-v37-sheet.js`、`scripts/verify-v37-live.py`、`scripts/probe-cors.py`（新增）
- `CHANGES-v37.md`（本檔）
