# v39 變更紀錄 — 電子喜帖寄信鏈路「架構面」強化（第 3 棒：Software Architect）

- **版本**：v39（由 v38 複製，v38 及更早版本皆未更動）
- **正式站**：https://jack25860.github.io/jack-and-lily-wedding/
- **部署**：沿用既有 `.github/workflows/deploy-site.yml`（`workflow_dispatch`，input `zip_url`）— **未新增、未修改任何 workflow**

---

## 一、本輪（第 3 棒）架構審查結論

第 1 棒已定位根本原因（**部署的 Apps Script 缺 Gmail 寄信 OAuth scope**，`GmailApp.sendEmail()` 拋例外 → 信件從未寄出），第 2 棒已修復 `videoPoster` 相對路徑 bug。本輪從**可靠性與錯誤處理**角度審查整條鏈路（前端 → Apps Script → Gmail），發現並修補 4 個架構層級缺陷。

### 缺陷 1（高）：`plain()` 失敗時退回 `opaque()`，會把「後端明確失敗」誤判為成功

v37/v38 的 `postRow()`：

```js
if(window.fetch) return plain().catch(function(){ return opaque(); });
```

`opaque()` 使用 `mode:"no-cors"`，回應是 opaque，**一律回傳 `{ok:true}`**。因此當 `plain()` 因任何原因失敗（網路中斷、CORS 異常、回應非 JSON）時，前端會**顯示「已送出」但實際上信件根本沒寄出** — 這正是使用者最初「沒收到信卻看到成功」的成因之一。

**v39 修正**：移除 `opaque()` 退路。`plain()` 失敗即回傳明確失敗（`network_unreachable`），回應非 JSON 亦回傳 `bad_response` 而非偽裝成功。**前端不再可能把失敗顯示為成功。**

### 缺陷 2（中）：錯誤分類不足，前端無法區分失敗原因

v38 後端只區分 `mail_scope_missing` 與 `mail_send_failed`，配額用盡、收件者無效都混在後者。

**v39 修正**：後端錯誤分類為 `mail_scope_missing` / `mail_quota_exceeded` / `invalid_recipient` / `mail_send_failed`；前端對應顯示四種明確訊息（授權未完成／額度用盡／信箱無效／連線失敗）。

### 缺陷 3（中）：無冪等性，連點送出可能重複寄信

`sendBtn` 雖在送出期間 `disabled`，但 Apps Script Web App 為無狀態，若使用者重整或重送，同一賓客可能收到多封喜帖。

**v39 修正**：`sendEcard_()` 加入 `CacheService` 去重（鍵＝收件人小寫＋主旨前 60 字，窗期 `ECARD_DEDUPE_SECONDS = 90` 秒）。窗期內重複請求回 `{ok:true, deduped:true}` 且**不再實際寄信**。不同收件人不受影響。

### 缺陷 4（低）：可觀測性不足，無法遠端診斷「最近一次寄信結果」

`doGet(?diag=1)` 原本只回版本／授權／配額／pool 大小，無法得知「上一次寄信到底成功沒有」。

**v39 修正**：新增 `lastEcard`（`PropertiesService` 記錄最近一次寄送的時間、收件人、成功與否、錯誤碼、內嵌圖片數、是否去重），並補上 `siteBase`、`dedupeSeconds`。遠端即可完整診斷。

---

## 二、變更檔案（v39）

| 檔案 | 變更 |
|---|---|
| `js/app.js` | `postRow()` 移除 `opaque()` 退路；`plain()` 失敗／非 JSON 皆回明確失敗；電子喜帖錯誤訊息依錯誤碼分流（4 種） |
| `scripts/rsvp-to-sheet.gs` | 錯誤分類（4 種）；`CacheService` 去重；`recordLastSend_()`／`readLastSend_()`；`doGet(?diag=1)` 擴充；`ENDPOINT_VERSION` → `v39` |
| `scripts/verify-v39-sheet.js` | 新增（離線 harness，含 CacheService／PropertiesService stub） |
| `CHANGES-v39.md` | 本檔 |

`index.html`／`js/config.js`／`css/styles.css` 與 v38 **完全相同**（未動版面與功能）。

---

## 三、離線驗證（`scripts/verify-v39-sheet.js`，Node stub 實跑 `doPost`）

**63/63 通過**，涵蓋：

- `doGet` 健康字串帶 v39；`diag` 回傳 `version/mailScope/quota/photoPool(142)/videoPoster/siteBase/dedupeSeconds/lastEcard`
- 未授權 → `ok:false, error:'mail_scope_missing'`，**不寄信、不寫表**，且 `lastEcard` 記錄失敗
- 已授權 → `ok:true, inline:2`，HTML 以 `cid:` 內嵌（婚紗照＋影片示意圖），**不含任何外部圖片連結**，含邀請文字與署名，`lastEcard` 記錄成功
- **【v39】冪等性**：連點三次只實際寄出一封，第二、三次回 `deduped:true`；不同收件人各自寄出
- **【v39】錯誤分類**：配額用盡 → `mail_quota_exceeded`；無效收件者 → `invalid_recipient`
- **【v38】`videoPoster` 相對路徑 → 絕對網址**；`UrlFetchApp` 未收到相對路徑
- 未帶 `photo` 時伺服器端隨機補位（絕對網址、30 次抽選有變化）
- RSVP 回歸：序號遞增、出席人數＝大人＋兒童、不克出席三欄留空、RSVP 不寄信
- `ECARD_PHOTO_POOL` 共 142 張、無重複、檔案皆存在

---

## 四、⚠️ 使用者待辦（一次性，約 2 分鐘）— 這是信件能否真正寄達的關鍵

**根本原因（第 1 棒已以真實請求實測確認）**：線上 Apps Script 專案仍是舊版 **v35**，且**沒有 Gmail 寄信權限（OAuth scope）**，`GmailApp.sendEmail()` 拋例外 → 信件從未寄出。

> repo 裡的 `.gs` 只是版本控管副本；**部署到 GitHub Pages 不會更新 Google 端的 Apps Script 專案**。

請執行：

1. 開啟回覆試算表 → 「**擴充功能**」→「**Apps Script**」
2. 刪除編輯器內容，貼上 `scripts/rsvp-to-sheet.gs` **全文**（`SPREADSHEET_ID` 已預填），儲存
3. 於編輯器選擇函式 **`testEcard`** → 執行 → 同意 **Gmail 寄信授權**
4. 「**部署**」→「**管理部署**」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
5. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL` 並重新部署網站

**驗證**：瀏覽器開該 `/exec?diag=1` 網址，出現 `"version":"v39"` 且 `"mailScope":true` 即完成。

---

## 五、維持不變（已回歸驗證）

酒紅 `#6E1626`／金 `#C9A961`／宣紙米色；RSVP 送出流程不變；電子喜帖為**手動寄送**、信件內直接內嵌圖片與隨機婚紗照（142 張全池）；桌機與行動版不破版、無水平捲動。
