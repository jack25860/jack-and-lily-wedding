# v44 — 結婚預告片改為「倒數上映日期」

**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**Repo**：jack25860/jack-and-lily-wedding（main）
**基底版本**：v43（v43 及更早版本皆未更動）
**部署**：沿用既有 `deploy-site.yml`（`workflow_dispatch` + `zip_url` input），**未新增或修改任何 workflow**

---

## 一、需求

結婚預告片區塊**不要寫「45 秒」**，改成像電影預告一樣寫**倒數上映日期 —— 預計 11/1 上映**。

## 二、變更內容

### 1. 移除畫面上所有「45 秒」字樣（共 3 處）

| 位置 | 變更前 | 變更後 |
|---|---|---|
| `index.html` HTML 註解 | `<!-- 影片素材：結婚預告片（45 秒）` | `<!-- 影片素材：結婚預告片` |
| `index.html` 區塊標籤 | `<p class="trailer__tag">45 SEC</p>` | `<p class="trailer__tag" id="trailerTag">即將上映 · 11.01</p>` |
| `js/config.js` | `TRAILER_CAPTION: "…可替換為你們的 45 秒預告片。"` | `TRAILER_CAPTION: "…預計 11 月 1 日上映。"` |

已以 `grep` 確認：`index.html`、`js/config.js`、`js/app.js`、`css/styles.css` 中 **「45」出現次數為 0**。

### 2. 改為預告片式倒數／上映文案

新增可設定的上映設定（`js/config.js`）：

```js
TRAILER_RELEASE_DATE: "2026-11-01",   // 上映日
TRAILER_RELEASE_LABEL: "即將上映",       // 上映前文案
TRAILER_RELEASED_LABEL: "已上映",        // 上映後文案
TRAILER_COUNT_EN: "COMING SOON",      // 英文字樣
TRAILER_COUNT_UNIT: "DAYS"            // 倒數單位
```

新增 `initTrailerRelease()`（`js/app.js`），依「今天」與上映日自動計算：

| 情境 | 畫面顯示 |
|---|---|
| 上映前（例：2026-10-03） | 標籤 **「即將上映 · 11.01」**；下方 **「COMING SOON — 29 DAYS」** |
| 上映前 1 天 | 「COMING SOON — 1 DAY」（單數自動處理） |
| 上映日或之後（例：2026-11-01） | 標籤 **「已上映 · 11.01」**；倒數行自動隱藏 |

倒數以「日」為單位、以瀏覽器本地日期 00:00 比較；`TRAILER_RELEASE_DATE` 留空或格式錯誤時，僅顯示標籤、不顯示倒數（不會出錯）。

### 3. 排版與配色

新增 `.trailer__count` 樣式（`css/styles.css`）：金色 `var(--gold)`、Cinzel 小型大寫、字距 `.32em`，與 `.trailer__tag` 一致；沿用既有酒紅 `#6E1626` / 金 `#C9A961` / 宣紙米色，未新增任何色票。

### 4. 電子喜帖區塊 —— 本次不動

`E_INVITATION_DESC`（「15 秒，把我們的喜訊，親手交到你手上。」）與 `E_INVITATION_CAPTION`（「…可替換為你們的 15 秒短片。」）**保持原樣**，未做任何修改。

---

## 三、驗證結果

| 驗證 | 結果 |
|---|---|
| `node --check js/app.js` / `js/config.js` | 通過 ✅ |
| 本地真實 Chromium 桌機 1440×900 ＋ 行動版 390×844（`local_check.py`）| **20 / 20 通過** ✅ |
| 畫面無「45 SEC」/「45 秒」/獨立「45」字樣 | 通過（桌機＋行動版）✅ |
| 標籤 = 「即將上映 · 11.01」、倒數 = 「COMING SOON — 29 DAYS」 | 通過 ✅ |
| 無水平捲動（`scrollWidth === clientWidth`） | 通過，overflow = 0 ✅ |
| 卡片內容未超出區塊邊界 | 通過 ✅ |
| console error / pageerror | 0 / 0 ✅ |

倒數邏輯另以 Node 模擬驗證 5 個時間點（10/03、10/31、11/01、11/02、2027-01-01），全數正確。

---

## 四、⚠️ 使用者待辦（電子喜帖寄信）

**Google 端 Apps Script 專案仍需手動同步**，否則電子喜帖不會真的寄出（repo 裡的 `.gs` 只是版本控管副本，部署到 GitHub Pages 不會更新 Google 端專案）：

1. 開啟回覆試算表 → 「擴充功能」→「Apps Script」
2. 貼上 `scripts/rsvp-to-sheet.gs`（最新全文）並儲存
3. 函式選 **`testEcard`** → 執行 → 同意 **Gmail 寄信權限**
4. 「部署」→「管理部署」→ 編輯現有部署 → 版本選「**新版本**」→ 部署

**驗證方式**：開啟 `/exec?diag=1`，出現 `"mailScope":true` 即完成。

---

## 五、維持不變

酒紅 #6E1626／金 #C9A961／宣紙米色；RSVP 送出流程；電子喜帖為手動寄送、信件內直接內嵌圖片與隨機婚紗照（142 張全池）；大人出席人數上限 10 人；電子喜帖去重窗期 8 秒；電子喜帖寄送成功後清空輸入框；婚禮當日注意事項區塊內容。

---

## 六、變更檔案（v44）

| 檔案 | 變更 |
|---|---|
| `index.html` | 移除「45 秒」註解與「45 SEC」標籤；新增 `#trailerTag`／`#trailerCount` |
| `js/config.js` | `TRAILER_CAPTION` 改上映文案；新增 5 個 `TRAILER_RELEASE_*`／`TRAILER_COUNT_*` 設定 |
| `js/app.js` | 新增 `initTrailerRelease()` 並掛入 `boot()` |
| `css/styles.css` | 新增 `.trailer__count` 樣式 |
| `CHANGES-v44.md` | 新增（本檔） |
