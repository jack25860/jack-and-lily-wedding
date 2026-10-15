# v38 變更紀錄 — 電子喜帖寄信鏈路修復（第 2 棒：AI Engineer 複查）

- **版本**：v38（由 v37 複製，v37 及更早版本皆未更動）
- **正式站**：https://jack25860.github.io/jack-and-lily-wedding/
- **部署**：沿用既有 `.github/workflows/deploy-site.yml`（`workflow_dispatch`，input `zip_url`）— **未新增、未修改任何 workflow**

---

## 一、本輪（第 2 棒）複查結論

### 前端（`js/app.js` / `js/config.js`）— 已確認正確，**本輪未修改**
- `postRow()` 先讀真實回應（`plain()`），失敗才退回 `opaque()`；電子喜帖與 RSVP 皆依 `ok:false` 顯示真實錯誤。
- 線上 `js/app.js` md5 與 v37 建置檔一致 → 正式站確實執行 v37 前端。
- 真實 Chromium（桌機 1440×900 ＋ 行動版 390×844）實測 **34/34 通過**：電子喜帖面板開啟、送出鎖定、確實 POST、不跳轉、前端可讀回應、授權未完成時顯示明確提示；RSVP 回歸（立即鎖定→感謝→清空→不跳轉→0 email）；不克出席隱藏＋停用；無水平捲動／無 console error。
- 真實瀏覽器 CORS 探測：**瀏覽器可讀取 POST 回應**（`readable:true`），確認 v37 的 `plain()` 修法有效。

### 後端（`scripts/rsvp-to-sheet.gs`）— **本輪修復 1 個真實 bug**

**Bug：`videoPoster` 相對路徑未轉為絕對網址**

`sendEcard_()` 中 `photoUrl` 有做「相對路徑 → 絕對網址」轉換，但 `videoPoster` 沒有：

```js
// 修正前
var videoPoster = pick_(data, ['videoPoster']) || ECARD_VIDEO_POSTER;
// → 若為 "images/tl1.jpg"，UrlFetchApp.fetch() 會因相對路徑抓不到圖
//   → 信件缺少「電子喜帖影片示意圖」

// 修正後（v38）
var videoPoster = pick_(data, ['videoPoster']) || ECARD_VIDEO_POSTER;
if (videoPoster && videoPoster.indexOf('http') !== 0) videoPoster = SITE_BASE + videoPoster;
```

`ECARD_VIDEO_POSTER` 預設值為 `images/tl1.jpg`（相對路徑），因此**每一封**電子喜帖的影片示意圖都會抓取失敗。此為 v37 遺留缺陷，v38 已修正。

**其他 v38 調整**
- `ENDPOINT_VERSION`：`v37` → **`v38`**
- `doGet(?diag=1)` 健康檢查新增回傳 `photoPool`（142）、`videoPoster`、`videoUrl`，方便遠端確認部署版本與設定。

---

## 二、離線驗證（`scripts/verify-v38-sheet.js`，Node stub 實跑 `doPost`）

**49/49 通過**，涵蓋：
- `doGet` 健康字串帶 v38；`diag` 回傳 `version/mailScope/quota/photoPool/videoPoster`
- 未授權時 `ok:false, error:'mail_scope_missing'`，**不寄信、不寫入試算表**
- 已授權時 `ok:true, inline:2`，信件為 HTML ＋ `cid:` 內嵌（婚紗照＋影片示意圖），**不含任何外部圖片連結**，含邀請文字與署名
- **【v38 修復】** `videoPoster` 相對路徑被轉為絕對網址；`UrlFetchApp` 未收到相對路徑；預設 `videoPoster` 亦為絕對網址
- 未帶 `photo` 時伺服器端隨機補位（絕對網址、30 次抽選有變化）
- 無效信箱 `ok:false` 且不寄出
- RSVP 回歸：序號遞增、出席人數＝大人＋兒童、不克出席三欄留空、RSVP 不寄信
- `ECARD_PHOTO_POOL` 共 142 張、無重複、檔案皆存在、`randomPhoto_()` 落在 pool 內

---

## 三、⚠️ 使用者待辦（一次性，約 2 分鐘）— 這是信件能否真正寄達的關鍵

**根本原因（第 1 棒已以真實請求實測確認）**：線上 Apps Script 專案仍是舊版 **v35**，且**沒有 Gmail 寄信權限（OAuth scope）**，`GmailApp.sendEmail()` 拋例外 → 信件從未寄出。

> repo 裡的 `.gs` 只是版本控管副本；**部署到 GitHub Pages 不會更新 Google 端的 Apps Script 專案**。

請執行：
1. 開啟回覆試算表 → 「**擴充功能**」→「**Apps Script**」
2. 刪除編輯器內容，貼上 `scripts/rsvp-to-sheet.gs` **全文**（`SPREADSHEET_ID` 已預填），儲存
3. 於編輯器選擇函式 **`testEcard`** → 執行 → 同意 **Gmail 寄信授權**
4. 「**部署**」→「**管理部署**」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
5. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL` 並重新部署網站

**驗證**：瀏覽器開該 `/exec?diag=1` 網址，出現 `"version":"v38"` 且 `"mailScope":true` 即完成。

---

## 四、維持不變（已回歸驗證）
酒紅 `#6E1626`／金 `#C9A961`／宣紙米色；RSVP 送出流程不變；電子喜帖為**手動寄送**、信件內直接內嵌圖片與隨機婚紗照（142 張全池）；桌機與行動版不破版、無水平捲動。

## 五、變更檔案（v38）
`scripts/rsvp-to-sheet.gs`（videoPoster 絕對網址修正、v38 標記、diag 擴充）｜`scripts/verify-v38-sheet.js`（新增）｜`CHANGES-v38.md`（本檔）
前端 `index.html`／`js/app.js`／`js/config.js`／`css/styles.css` 與 v37 **完全相同**。
