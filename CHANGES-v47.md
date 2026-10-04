# v47 變更說明 — 電子喜帖信件：GIF 直接內嵌、一打開就自動循環播放

**版本**：v47（由 v46 複製，v46 及更早版本皆未更動）
**部署**：沿用既有 `.github/workflows/deploy-site.yml`（`workflow_dispatch` + `zip_url`）— 未新增、未修改任何 workflow
**日期**：2026-10-04

---

## 0. 最重要的根因（前兩次都沒解決的真正原因）

**信件內容是「Google 端 Apps Script」產生的，不是網站產生的。**

`scripts/rsvp-to-sheet.gs` 放在 repo 裡只是**版本控管副本**；部署網站到 GitHub Pages **完全不會**更新 Google 端的 Apps Script 專案。因此**只要 Google 端沒有手動更新，網站改幾版，信件內容都不會改變。**

實測線上端點（`js/config.js` 的 `SHEET_WEBAPP_URL` ＋ `?diag=1`）：

```
GET /exec?diag=1
→ {"ok":true,"version":"v42","mailScope":true,...}
GET /exec
→ RSVP endpoint is running. v42
```

**仍是 v42。** 而 v42 的模板在 `ECARD_VIDEO_URL` 有值時，會產生：

```html
<a href="…/ecard-video.html"><img src="cid:videoPoster">…</a>
<div>▶ 點此觀看電子喜帖影片</div>
```

這正是使用者截圖看到的畫面（Gmail 網頁／App 不解析 `cid:`，圖片不顯示，只剩一行連結文字）。

→ **v45 的循環 GIF 從未真正寄出過。** 問題不在 v45/v46 的程式碼。

---

## 1. v47 修改內容

### 1.1 信件模板：GIF 為唯一主要呈現，點擊才跳轉

`scripts/rsvp-to-sheet.gs` 的 `videoTag`：

| 項目 | v46 | **v47** |
|---|---|---|
| GIF 呈現 | `<img src="公開網址">` 直接顯示 | **相同（維持直接顯示）** |
| 點擊行為 | GIF 包在 `<a href="ecard-video.html">` | **相同（點擊 GIF 才跳轉）** |
| GIF 下方文字連結 | `▶ 點此觀看完整循環影片`（**多餘**） | **移除** ✅ |
| `<img>` 屬性 | `width="360"`，無 height | **`width="320" height="427"`**（避免載入時版面位移） |
| 回傳欄位 | `poster` | 新增 **`loopGif: true`**（遠端可診斷） |
| `ENDPOINT_VERSION` | `v46` | **`v47`** |

**為什麼移除文字連結**：使用者連續兩次回饋「只看到連結」。只要信件裡還有一行「▶ 點此觀看…」，收件人（尤其在圖片被信箱暫時阻擋時）就會以為內容只是一個連結。v47 除了 GIF 本身的可點擊範圍外，**不再輸出任何多餘的純文字連結**。

**為什麼不是 `<video>`**：Gmail／Outlook 等主流信箱**封鎖 `<video>` 標籤與 JavaScript**，`autoplay`／`loop` 在信件內完全不生效，Gmail 甚至會移除該標籤。**動畫 GIF 以公開網址引用**，是唯一會被信箱自動播放的動態形式（所有信箱皆支援，不需 JS）。

**為什麼不用 `cid:` 內嵌 GIF**：Gmail 網頁版不解析 `cid:` 參照；即使解析，也多只顯示 GIF 第一格。v47 的 GIF 走**絕對公開網址**（GitHub Pages），外部收件人無需任何授權即可載入。

> 註：婚紗照仍以 `cid:couplePhoto` 內嵌（維持 v46 行為不變）；只有影片／喜帖動態素材改用公開網址。

### 1.2 循環 GIF：壓到 1 MB 以內

| 項目 | v46 | **v47** |
|---|---|---|
| 尺寸 | 360 × 480 | **320 × 427** |
| 顏色 | 32 色 | 32 色 |
| 影格 | 31 格、來回無縫循環 | 31 格、來回無縫循環（不變） |
| 檔案大小 | 1,328,676 bytes（1.27 MB） | **962,384 bytes（0.94 MB）** |

依業界建議（Litmus 等）將信件內 GIF 壓在 **1 MB 以內**，行動網路載入更快、也更不容易被信箱延遲或降級顯示。原始片段（花瓣紛飛、字卡浮現段）以「正放＋倒放」拼接，首尾影格相同，**循環無跳格**。

### 1.3 新增：不依賴 Apps Script 的立即驗證頁

新增 `ecard-email-preview.html`（公開，`noindex`）：

- 內容為 **v47 模板實際產生的信件內文原樣**（由 `documents/v47_ecard/build_email_preview.js` 在 Node vm 沙箱中執行 `rsvp-to-sheet.gs`、攔截 `GmailApp.sendEmail` 的 `htmlBody` 取得）。
- 使用者**可在瀏覽器直接開啟**，親眼看到「一打開就自動循環播放、點擊才跳轉」的效果，作為對照組。
- 僅供驗證；實際寄送仍由 Google 端 Apps Script 執行。

---

## 2. ⚠️ 使用者待辦（必要，否則信件仍是舊版）

**這是本次問題的真正根因，不做這件事，網站改幾版都不會反映在信件裡。**

1. 開啟回覆試算表 → 「擴充功能」→「Apps Script」
2. 將 `scripts/rsvp-to-sheet.gs`（**v47 全文**）貼上並儲存
3. 函式選 **`testEcard`** → 執行 → 同意 **Gmail 寄信權限**
4. 「部署」→「管理部署」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
5. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL` 並重新部署網站

**驗證方式**：開啟 `/exec?diag=1`，出現 `"version":"v47"` 且 `"mailScope":true` 即完成。

---

## 3. 維持不變

酒紅 `#6E1626`／金 `#C9A961`／宣紙米色；RSVP 送出流程；電子喜帖為**手動寄送**、信件內內嵌隨機婚紗照（**142 張全池**）；大人出席人數上限 10 人；電子喜帖去重窗期 **8 秒**；寄送成功後清空輸入框；結婚預告片倒數文案；婚禮當日注意事項區塊。

## 4. 變更檔案

| 檔案 | 變更 |
|---|---|
| `scripts/rsvp-to-sheet.gs` | GIF 為唯一主要呈現、移除多餘文字連結、`<img>` 補 height、`ENDPOINT_VERSION` → v47 |
| `media/ecard-loop.gif` | 360×480／1.27 MB → **320×427／0.94 MB** |
| `ecard-email-preview.html` | 新增（信件內文對照頁，公開可開啟） |
| `CHANGES-v47.md` | 新增 |
