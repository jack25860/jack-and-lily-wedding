# v42 變更說明

**版本**：v42（由 v41 複製；v41 及更早版本皆未更動）
**部署**：沿用既有 `deploy-site.yml`（`workflow_dispatch`，input `zip_url`）— 未新增、未修改任何 workflow
**正式站**：https://jack25860.github.io/jack-and-lily-wedding/

---

## 一、電子喜帖寄送成功後清空輸入框

**需求**：寄送成功後自動清空電子喜帖的輸入欄位（收件人 email），方便接著寄給下一位。

**實作**（`js/app.js` → `initEcardShow()`）：

新增 `clearTo()`：清空 `#ecardTo` 並把焦點移回該欄位（`toInput.focus()`），讓使用者可直接輸入下一位。

| 情境 | 後端回應 | 清空？ | 顯示訊息 |
|---|---|---|---|
| 寄送成功 | `{ok:true}` | **✅ 清空** | 「電子喜帖已送出，我們會將喜帖寄至 …」 |
| 8 秒內重複送出被略過 | `{ok:true, deduped:true}` | **✅ 清空**（視為已寄出） | 「剛剛已寄出（3 秒內的重複送出已略過）…」 |
| 授權未完成 | `{ok:false, error:'mail_scope_missing'}` | ❌ **不清空** | 「電子喜帖功能尚未完成授權：請於 Apps Script 執行 testEcard…」 |
| 配額用盡 | `{ok:false, error:'mail_quota_exceeded'}` | ❌ **不清空** | 「今日寄信額度已用盡，請稍後或明日再試。」 |
| 收件者無效 | `{ok:false, error:'invalid_recipient'}` | ❌ **不清空** | 「收件者信箱無效，請確認後再試。」 |
| 網路失敗 | `{ok:false, error:'network_unreachable'}` | ❌ **不清空** | 「無法連線至寄信服務，請檢查網路後再試。」 |
| 其他失敗 | `{ok:false}` | ❌ **不清空** | 「電子喜帖寄送失敗，請稍後再試。」 |

**去重情境的判斷**：`deduped:true` 代表「8 秒內已寄出過同一人＋同一主旨」，信件**確實已寄達**（前一封），因此視為已寄出而清空，避免使用者誤以為沒寄出而重複輸入。訊息同時明確告知「剛剛已寄出」與「稍候 3 秒後可再寄」，狀態透明。

**焦點與提示**：清空後焦點回到 `#ecardTo`；狀態訊息位於 `#ecardStatus`（`role="status" aria-live="polite"`），不因清空而消失。桌機與行動版皆不破版、無水平捲動。

---

## 二、電子喜帖去重窗期 8 秒 → 3 秒

**背景**：v39 加入的 `CacheService` 去重（鍵＝收件人＋主旨）窗期 90 秒，會把「刻意連續寄送給同一人」誤判為重複點擊而擋掉；v41 已縮短為 8 秒。本輪再縮短為 **3 秒**，讓「送出完成後幾乎可立即再次寄送給同一人」。

**修改**（`scripts/rsvp-to-sheet.gs`）：
- `ENDPOINT_VERSION` → `'v42'`
- `ECARD_DEDUPE_SECONDS` → `3`

**策略說明**：3 秒足以攔截「同一瞬間連點」與瀏覽器／網路的立即重試（同一封不會寄兩次），但不會誤擋使用者的正常連續操作。前端另於成功後清空欄位，進一步降低誤送風險。

---

## 三、維持不變

- 酒紅 `#6E1626`／金 `#C9A961`／宣紙米色
- RSVP 送出流程不變
- 電子喜帖為手動寄送、信件內直接內嵌圖片與隨機婚紗照（142 張全池）
- 大人出席人數上限 10 人（v41 已調整，本版沿用）
- 桌機與行動版不破版、無水平捲動

---

## ⚠️ 使用者待辦（必要，否則電子喜帖仍不會寄出）

**Google 端 Apps Script 專案目前仍是舊版且未授予 Gmail 寄信權限。** repo 裡的 `scripts/rsvp-to-sheet.gs` 只是版本控管副本；**部署到 GitHub Pages 不會更新 Google 端的 Apps Script 專案**。

請執行（約 2 分鐘）：
1. 開啟回覆試算表 → 「擴充功能」→「Apps Script」
2. 將 `scripts/rsvp-to-sheet.gs`（**v42 全文**）貼上並儲存
3. 函式選 **`testEcard`** → 執行 → 同意 **Gmail 寄信權限**
4. 「部署」→「管理部署」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
5. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL` 並重新部署網站

**驗證方式**：開啟 `/exec?diag=1`，出現 `"version":"v42"` 且 `"mailScope":true` 即完成。

---

## 變更檔案（v42）

| 檔案 | 變更 |
|---|---|
| `js/app.js` | 新增 `clearTo()`；成功／去重時清空收件人欄位；去重提示改為 3 秒 |
| `scripts/rsvp-to-sheet.gs` | `ENDPOINT_VERSION` → v42；`ECARD_DEDUPE_SECONDS` → 3 |
| `scripts/verify-v42-sheet.js` | 新增（離線 harness，67/67 通過） |
| `scripts/verify-v42-live.py` | 新增（正式站真實瀏覽器實測） |
| `CHANGES-v42.md` | 新增（本檔） |
