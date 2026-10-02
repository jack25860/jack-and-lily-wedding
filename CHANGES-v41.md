# v41 — 大人出席人數上限 10 人 ＋ 電子喜帖「短時間內無法連續寄送同一人」修正

**日期**：2026-10-03
**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**版本**：v41 由 v40 複製（v40 及更早版本皆未更動）
**部署**：沿用既有 `deploy-site.yml`（`workflow_dispatch`，input `zip_url`）— 未新增、未修改任何 workflow

---

## 一、修改 1：表單「大人出席人數」上限調整為 10 人

**檔案**：`index.html`（`#rsvpAdults` 下拉選單）

| 項目 | 修改前 | 修改後 |
|---|---|---|
| 大人出席人數選項 | 1 – 5 | **1 – 10** |
| 小孩人數 | 0 – 4 | 0 – 4（**維持不變**） |
| 兒童椅數量 | 0 – 4 | 0 – 4（**維持不變**） |

- 預設值仍為 `1`（`selected`），`required` 保留。
- 純粹新增 `<option>`，未動任何 CSS／版面結構 → 桌機與行動版皆不破版、無水平捲動。
- 後端 `rsvp-to-sheet.gs` 的 `adults` 為自由數值寫入，無上限驗證，**不需修改**。

---

## 二、修改 2：電子喜帖「短時間內無法連續寄送給同一人」

### 2-1 根本原因（已確認）

v39 由 Software Architect 加入的 `CacheService` 去重機制：

```js
var ECARD_DEDUPE_SECONDS = 90;                       // v39
var dkey = dedupeKey_(to, pick_(data, ['subject'])); // 鍵 = 收件人(小寫) + 主旨前 60 字
if (cache && cache.get(dkey)) {
  return { ok: true, deduped: true, inline: ... };   // ← 直接回成功，但「沒有寄信」
}
```

- 去重窗期 **90 秒**，鍵為「收件人 ＋ 主旨」。
- 使用者「刻意連續寄送給同一人」時，第二封在 90 秒內 → 被判定為重複點擊 → **回 `{ok:true, deduped:true}` 但實際沒有寄出**。
- 前端 v39 只判斷 `r.ok === false`，`deduped:true` 被當成一般成功 → 顯示「電子喜帖已送出」，**使用者完全無從得知其實沒寄**。

→ 這正是「傳送完成後，短時間內無法再連續寄送給同一人」的成因。

### 2-2 最終採用的策略（防連點 ↔ 可連續寄送的平衡）

| 面向 | 做法 |
|---|---|
| **防連點** | 保留 `CacheService` 去重，但窗期由 **90 秒 → 8 秒**。8 秒足以涵蓋「同一瞬間連點」與網路重試，不會誤擋正常操作。 |
| **可連續寄送** | 送出完成後只要間隔 **8 秒**，即可再次寄送給同一人（原本需等 90 秒）。 |
| **狀態透明** | 前端新增 `deduped` 分支：若後端回 `deduped:true`，**不再顯示「已送出」**，改顯示「剛剛已寄出（8 秒內的重複送出已略過）。若要再次寄送給同一位，請稍候 8 秒後再按一次。」 |

**為何不直接移除去重？** 完全移除會讓「連點兩下」變成寄出兩封相同喜帖給同一位賓客（對收件人是明顯的打擾）。8 秒窗期在兩者間取得平衡：連點被吸收，正常連續寄送不受影響。

**為何不改為「內容完全相同才去重」？** 同一人＋同一主旨的喜帖內容本來就幾乎相同（隨機婚紗照除外），以內容比對無法區分「連點」與「刻意重寄」，反而更容易誤擋。時間窗是更可靠的訊號。

### 2-3 修改內容

**`scripts/rsvp-to-sheet.gs`**
```js
var ENDPOINT_VERSION = 'v41';        // 由 v39 → v41
var ECARD_DEDUPE_SECONDS = 8;        // 由 90 → 8
```
（`dedupeKey_`、`recordLastSend_`、`doGet(?diag=1)` 的 `dedupeSeconds` 皆自動反映新值，無需另改。）

**`js/app.js`**（`initEcardShow()` 送出回呼）
```js
postRow(sheetUrl,payload).then(function(r){
  done();
  if(r&&r.deduped){ errMsg("剛剛已寄出（8 秒內的重複送出已略過）。若要再次寄送給同一位，請稍候 8 秒後再按一次。"); return; }
  if(r&&r.ok===false){ ... }
  okMsg();
});
```

---

## 三、⚠️ 使用者待辦（必要，否則電子喜帖仍不會寄出）

**Google 端 Apps Script 專案目前仍是舊版 v35 且未授予 Gmail 寄信權限。**
repo 裡的 `scripts/rsvp-to-sheet.gs` 只是版本控管副本；**部署到 GitHub Pages 不會更新 Google 端的 Apps Script 專案**。

請執行（約 2 分鐘）：

1. 開啟回覆試算表 → 「擴充功能」→「Apps Script」
2. 將 `scripts/rsvp-to-sheet.gs`（**v41 全文**）貼上並儲存
3. 函式選 **`testEcard`** → 執行 → 同意 **Gmail 寄信權限**
4. 「部署」→「管理部署」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
5. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL` 並重新部署網站

**驗證方式**：開啟 `/exec?diag=1`，出現 `"version":"v41"` 且 `"mailScope":true` 即完成。

---

## 四、維持不變

- 風格：酒紅 `#6E1626`／金 `#C9A961`／宣紙米色
- RSVP 送出流程不變
- 電子喜帖為手動寄送、信件內直接內嵌圖片與隨機婚紗照（142 張全池）
- 桌機與行動版皆不破版、無水平捲動

---

## 五、變更檔案清單

| 檔案 | 變更 |
|---|---|
| `index.html` | `#rsvpAdults` 新增 6–10 選項 |
| `js/app.js` | 電子喜帖送出回呼新增 `deduped` 分支與明確提示 |
| `scripts/rsvp-to-sheet.gs` | `ENDPOINT_VERSION` → v41；`ECARD_DEDUPE_SECONDS` 90 → 8 |
| `CHANGES-v41.md` | 新增（本檔） |
