# v56 變更紀錄 — 電子喜帖信件：內嵌媒體畫質提升（HD）＋ 可點擊觀看影片

**日期**：2026-10-05
**版本**：v56（由 v55 複製後修改；v55 及更早版本保持不變）
**部署**：沿用既有 `.github/workflows/deploy-site.yml`（未新增、未修改 workflow）

---

## 使用者需求

1. 信件內嵌的電子喜帖影片畫質要提高，改成高清（HD），不要這麼模糊。
2. 在信件中加上提示：點擊影片可以連結到電子喜帖網站（`ecard-video.html`）。

## 本次變更

### 1. 內嵌媒體畫質提升（HD）

- 新增 **`media/ecard-loop-hd.gif`**：由 `media/ecard-video.mp4`（720×960 母帶）重新編碼的循環 GIF。
  - 規格：**480×640（HD）**、25 格、64 色、約 **1.7 MB**（原 v47 為 320×427、31 格、32 色、約 0.94 MB）。
  - 以「正播 + 倒播（boomerang）」拼接，首尾影格相同，循環無跳格。
  - 解析度提升 1.5 倍（面積 2.25 倍），畫面明顯更清晰。
- 舊檔 `media/ecard-loop.gif` **保留不動**（向後相容；v55 及更早的信件仍可正常顯示）。

### 2. 信件內新增可點擊的觀看提示

- 內嵌 GIF 本身**維持可點擊**，連到 `https://jack25860.github.io/jack-and-lily-wedding/ecard-video.html`。
- GIF 下方新增**可點擊按鈕**：**「▶ 點擊觀看電子喜帖影片」**（酒紅 #6E1626／金 #C9A961 樣式），同樣連到 `ecard-video.html`。
- 信件內嵌媒體仍以「公開網址的動畫 GIF」呈現（信箱會封鎖 `<video>` 與 JavaScript，GIF 是唯一會自動循環播放的形式）。

### 3. 後端（Apps Script 鏡像）

- 更新 **`scripts/rsvp-to-sheet.gs`**：
  - `ECARD_LOOP_GIF_URL` 改為 `.../media/ecard-loop-hd.gif?v=56`（`?v=56` 為快取破壞參數，確保收件人取得新版高畫質 GIF）。
  - `videoTag` 改為 HD GIF（`width="480" height="640"`）＋ 下方「▶ 點擊觀看電子喜帖影片」按鈕。

### 4. 預覽頁

- 更新 `ecard-email-preview.html` 與 `scripts/ecard-email-preview.html`，鏡像 v56 信件內文（HD GIF ＋ 觀看按鈕），供對照驗證。

---

## ⚠️ 使用者需手動完成的步驟（Apps Script 重新部署）

> **GitHub Pages 部署不會更新 Google Apps Script。** 信件實際由 Google 端 Apps Script 產生，必須手動貼上並重新部署，新模板才會生效。

1. 開啟綁定「出席回覆」回應試算表的 Apps Script 專案。
2. 將 `scripts/rsvp-to-sheet.gs` 的**整份內容**貼上，覆蓋原有 `Code.gs`。
3. 於編輯器選擇函式 `testEcard` 並按「執行」，完成授權（首次會要求 Gmail 寄信權限）。
4. 點「部署」→「管理部署」→ 編輯現有部署 → **版本：新版本** → 部署。
   （或「新增部署」取得新的 `/exec` 網址；若網址變更，請同步更新 `js/config.js` 的 `SHEET_WEBAPP_URL`。）
5. 寄出一封測試信，確認內嵌 GIF 為高畫質且「▶ 點擊觀看電子喜帖影片」可連到電子喜帖網站。

---

## 維持不變

酒紅 #6E1626／金 #C9A961／宣紙米色、RSVP 送出流程、電子喜帖手動寄送與 142 張全池隨機婚紗照、大人上限 10 人、去重窗期 8 秒、寄送成功後清空輸入框、結婚預告片倒數文案、婚禮當日注意事項區塊、信件內嵌循環 GIF 呈現方式（改為更高畫質）。

## 網站端

- `index.html`、`ecard-video.html`、`js/*`、`css/*` **未變更**（本次僅動信件模板與內嵌媒體）。
- v55 的漂浮音效開關與 v54 的 Android 影片播放修正均**完整保留**。
