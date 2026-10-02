# v34 變更紀錄

**版本**：v34（由 v33 複製後修改；v33 及更早版本皆未更動）
**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**部署**：沿用既有 `.github/workflows/deploy-site.yml`（`workflow_dispatch`，input `zip_url`）— **未新增、未修改任何 workflow**
**部署 run**：`#32`（run id `37043310831`）— **completed / success**；Pages build `#53` 亦 success

---

## 需求一：婚紗相簿改版

### 1. 移除「唐代」與「戰國」
`js/config.js` 的 `GALLERY_THEMES` 移除 `戰國`（WARRING STATES）與 `唐代`（TANG DYNASTY）兩個主題，含其全部 `FEATURED` / `MORE` 圖片引用（`images/album/zg*.jpg`、`images/album/tg*.jpg`）。
`index.html` 相簿副標由「戰國、唐代、明朝 — 三段前世，一個約定。」改為「明朝、今生 — 兩段時光，一個約定。」；區塊註解同步更新。

### 2. 加入本次 74 張婚紗照
74 張照片下載後統一命名為 `images/album/n01.jpg` … `n74.jpg`（避免與既有 `p*.jpg` 明朝檔名衝突），並以 `quality=82, progressive, 最長邊 1600px` 壓縮（43MB → 約 33MB）。
新增主題 **「今生 / THIS LIFE」**，副標「一世相守，執手同行。」，收錄全部 74 張。

### 3. 相簿結構（預覽 4-6 張，含兩人合照）
| 主題 | 預覽（FEATURED） | 展開後（MORE） | 小計 |
|---|---|---|---|
| 明朝 MING DYNASTY | 6 張 | 50 張 | 56 |
| 今生 THIS LIFE | 6 張 | 68 張 | 74 |
| **合計** | **12** | **118** | **130** |

「今生」預覽 6 張為 `n03 / n09 / n27 / n45 / n50 / n70`，其中 **`n03`、`n09` 為經視覺辨識確認的「兩人合照」**（新郎與新娘同框），符合「預覽必須包含兩人合照」的要求；其餘 68 張於展開後才顯示。

### 4. 排版驗證
桌機 1440×900 與行動版 390×844：預覽皆為 4-6 張、展開前 `MORE` 為 `hidden`、**無破圖**、`scrollWidth == clientWidth`（無水平捲動）。

---

## 需求二：RSVP 送出提示時機

`js/app.js` 的 `initRsvp()` 送出流程改為**兩段式回饋**：

```
[按下送出]
  ├─ 欄位驗證不通過 → 紅框明確錯誤（不清空）
  ├─ 立即：setRsvpStatus("傳送中…") + 送出鈕 disabled/aria-busy   ← 新增，按下即有反應
  ├─ SHEET_WEBAPP_URL 為空 → 「回覆系統尚未設定完成，您的內容已保留。」＋ 三條備援（不清空）
  ├─ 寫入成功 → 「感謝您的回覆」＋ 清空表單 ＋ 隱藏備援
  └─ 寫入失敗 → 「回覆送出失敗，您的內容已保留。」＋ 三條備援（不清空）
```

新增 `setRsvpBusy(on)`：送出期間停用送出鈕並設 `aria-busy`，完成後還原。
新增設定 `RSVP_SENDING_TEXT:"傳送中…"`（`js/config.js`）。

維持不變：**不跳轉新分頁**、**不寄送 RSVP 通知信**（送出時 0 筆 email 請求）、成功後清空表單回預設。

---

## 需求三：電子喜帖信件改為直接顯示圖片與影片

### 技術限制與替代方案
FormSubmit.co 為第三方表單轉寄服務，**無法在信件中內嵌圖片**（只能寄出純文字／連結），因此改用 **Google Apps Script 的 `GmailApp.sendEmail` 搭配 `inlineImages`**：圖片以 `cid:` 內嵌於 HTML 信件中，收件者直接在信件內看到圖片，而非連結。

### 實作
`scripts/rsvp-to-sheet.gs` 新增 `doPost` 的 `type:"ecard"` 分支與 `sendEcard_()`：

- **(a) 電子喜帖影片**：目前以圖片代替（`ECARD_VIDEO_POSTER`，預設 `images/tl1.jpg`），並預留 `ECARD_VIDEO_URL` 設定；一旦填入影片網址，信件會自動改為「可點擊的影片縮圖＋▶ 點此觀看電子喜帖影片」。
- **(b) 隨機婚紗照**：由 `ECARD_PHOTO_POOL`（10 張，含今生 `n03/n09/n27/n45/n50/n70` 與明朝 `p20/p49/p52/p54`）隨機挑一張，以 `cid:couplePhoto` 內嵌。
- **(c) 文字說明**：`ECARD_INVITE_TEXT` = 「誠摯地邀請您參加本次婚禮，新郎與新娘敬上。」，信件並含「新郎與新娘 敬上」署名與「前往婚禮網站」按鈕。

信件採酒紅 `#6E1626`／金 `#C9A961`／宣紙米色 `#fffdf8` 設計，與網站一致。

### 端點版本防護（重要）
前端送出喜帖前會先 `GET` 端點並檢查回應是否含版本標記 `v34`；若使用者尚未重新部署新版 Apps Script，會顯示「電子喜帖功能尚未啟用：請將新版 Apps Script 重新部署後再試。」，**避免舊版端點把喜帖請求誤寫成一筆 RSVP 資料列**。

### 驗證
- 離線以 Node stub 執行 `doPost`：**20/20 通過** — 含 `htmlBody`、`inlineImages` 2 張、HTML 以 `cid:` 內嵌、**不含任何外部圖片連結**、含邀請文字與署名、有影片網址時產生可點擊影片連結、無效信箱回 `ok:false`。
- 信件內容以真實 Chromium 渲染截圖確認（`v34_ecard_email_preview.png`）：影片示意圖與婚紗照皆**直接顯示於信件中**。

---

## 維持不變（已回歸驗證）
- 風格：酒紅 `#6E1626`／金 `#C9A961`／宣紙米色。
- 選「不克出席」→ 人數區塊隱藏、三欄 `disabled`、不列入送出（試算表大人／兒童／兒童椅留空）。
- 電子喜帖仍為**手動填寫寄送**（不自動寄送）。
- 桌機與行動版皆不破版、不產生水平捲動。
- 其他 agent 的標記（`films--hero`、`three-lives`、`ecard-show`、`rsvpFallback`）皆仍在。

---

## 需要你完成的一次性設定（約 2 分鐘）

⚠️ **目前線上部署的 Apps Script 仍是舊版（v33）**，因此：
- **RSVP 寫入試算表：正常運作**（已實測，序號自動遞增）。
- **電子喜帖內嵌圖片：需重新部署新版才會生效**（前端會明確提示，不會誤寫資料）。

步驟：
1. 開啟回覆試算表 → 「**擴充功能**」→「**Apps Script**」
2. 刪除編輯器內容，貼上 `scripts/rsvp-to-sheet.gs` **全文**（`SPREADSHEET_ID` 已預填），儲存
3. 「**部署**」→「**管理部署**」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
   （或「新增部署」→ 類型「網頁應用程式」→ 執行身分「我」、存取權「所有人」）
4. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL` 並重新部署網站

**驗證**：瀏覽器開該 `/exec` 網址，出現「**RSVP endpoint is running. v34**」即為新版。

---

## 變更檔案（v34）
`index.html`｜`js/config.js`｜`js/app.js`｜`scripts/rsvp-to-sheet.gs`｜`images/album/n01.jpg`…`n74.jpg`（新增 74 張）
新增驗證腳本：`scripts/verify-v34.py`（本機端到端）、`scripts/verify-v34-sheet.js`（Apps Script 離線）、`scripts/verify-v34-live.py`（正式站）、`scripts/ecard-email-preview.html`（信件渲染預覽）
