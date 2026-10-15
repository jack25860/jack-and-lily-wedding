# v52 變更說明 — 修正使用者回報的兩個真實問題（音樂 3 秒內出聲／電子喜帖影片持續播放）

**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**電子喜帖頁**：https://jack25860.github.io/jack-and-lily-wedding/ecard-video.html
**Repo**：jack25860/jack-and-lily-wedding（main）
**版本**：v52（由 v51 複製為新版本；v51 及更早版本皆保持不變）
**部署**：沿用既有 `deploy-site.yml`（`workflow_dispatch` + `zip_url`）— **未新增、未修改任何 workflow**

---

## 使用者回報（v51 上線後仍存在，並附實機錄影）

1. 結婚網站 `index.html`：音樂要等很長一段時間才會出現，使用者要求「一開啟 3 秒內就要有音樂」。
2. 電子喜帖頁 `ecard-video.html`：影片播放異常（載入後卡住／不持續播放）。

---

## 一、`index.html` ＋ `js/app.js` — 音樂於開啟後 3 秒內出聲

### 1. 音訊檔壓縮（`audio/wedding-theme.mp3`）

| 項目 | v51 | **v52** |
|---|---|---|
| 位元率 | 約 185 kbps | **96 kbps** |
| 檔案大小 | 1,387,302 bytes（約 1.32 MB） | **721,090 bytes（約 0.69 MB）** |
| 長度 | 60.02 秒 | 60.06 秒（不變） |

檔案縮小約 48%，可更快下載與解碼，是「3 秒內出聲」的基礎。

### 2. `index.html`：音訊預先下載，不再等 JS 初始化

| 項目 | v51 | **v52** |
|---|---|---|
| `<audio>` 來源 | 空標籤，由 JS 於 `initMusic()` 才 `setAttribute("src", …)` | **HTML 直接寫入 `src="audio/wedding-theme.mp3"`**，瀏覽器解析階段即開始下載 |
| 預先下載提示 | 無 | **新增 `<link rel="preload" as="audio" href="audio/wedding-theme.mp3" type="audio/mpeg">`** |

### 3. `js/app.js` `initMusic()`：立即播放、就緒即播

- 若 HTML 已帶 `src` 則**不再重複設定**（避免重新載入造成延遲）；僅在缺少 `src` 時才由 JS 補上。
- **不再等待 `DOMContentLoaded`／`load`**：`initMusic()` 一執行即 `ensure()` 嘗試播放。
- 新增 `loadedmetadata／loadeddata／canplay／canplaythrough／playing／progress` 監聽：**一就緒且仍暫停就立刻再播**。
- `ensureSoon()` 重試時點由 140／700ms 調整為 **120／400／900ms**，更快補播。
- 保留 v51 的「預設開啟、可切換」與首次互動補播（`pointerdown／mousedown／touchstart／keydown／wheel／scroll`）。

---

## 二、`ecard-video.html` — 影片載入後持續播放、不卡住

### 1. 影片檔壓縮 ＋ faststart（`media/ecard-video.mp4`、`media/ecard-video.webm`）

| 檔案 | v51 | **v52** |
|---|---|---|
| `ecard-video.mp4`（H.264 + AAC） | 4,369,391 bytes（約 4.17 MB） | **2,751,100 bytes（約 2.62 MB）**，並加上 **`+faststart`**（`moov` 前置，可邊下載邊播） |
| `ecard-video.webm`（VP9 + Opus） | 6,691,022 bytes（約 6.38 MB） | **3,138,700 bytes（約 2.99 MB）** |

兩檔皆維持 720×960、18.2 秒、含音軌（aac／opus），檔案明顯縮小，降低緩衝卡住的機率。

### 2. 播放強化與看門狗（頁內腳本）

| 機制 | 說明 |
|---|---|
| 初始強化 | 明確設定 `playsInline`／`preload="auto"`，必要時主動 `load()`，確保影片一定開始下載與播放 |
| `pause／stalled／waiting／suspend／emptied／abort` 監聽 | 只要被任何來源暫停或緩衝卡住，立即 `resume()` 恢復播放 |
| `ended` 監聽 | 結束即歸零 `currentTime` 後續播（確保循環運轉） |
| 就緒事件 | `loadedmetadata／loadeddata／canplay／canplaythrough／playing／progress` 仍為暫停即播放 |
| 點擊畫面（capture） | `click／pointerdown／mousedown／touchstart／touchend／dblclick` 點畫面任何一處都不會讓影片停下 |
| `visibilitychange／focus／pageshow／scroll` | 分頁切回、視窗聚焦、回到頁面、滑動即續播 |
| **硬性看門狗（每 400ms）** | 最終保底：`paused` 或 `ended` 就重啟；**新增「播放中但 `currentTime` 完全沒前進（解碼／緩衝卡死）」偵測，連續 8 次即強制 `load()` 並續播** |
| 音效 | 維持 v51：`muted=false`、`volume>0`；**頁面上不提供任何音效開關**（政策擋下時於首次互動自動解除靜音） |

---

## 三、維持不變

酒紅 `#6E1626`／金 `#C9A961`／宣紙米色；RSVP 送出流程；電子喜帖手動寄送、142 張全池隨機婚紗照；大人上限 10 人；去重窗期 8 秒；寄送成功後清空輸入框；結婚預告片倒數文案；婚禮當日注意事項區塊；信件內嵌循環 GIF 的呈現方式。

---

## 四、驗證（真實瀏覽器）

以 Chromium（Playwright）模擬真實使用者首次開啟、乾淨瀏覽器狀態、無預先互動：

- **結婚網站**：乾淨載入後音樂於 **3 秒內出聲**（`paused=false`、`muted=false`、`volume>0`、`currentTime>0`）。
- **電子喜帖**：影片載入後持續播放，於模擬點擊／滑動／外部暫停／`stalled`+`waiting` 後皆能恢復，**零卡住（stuck=0）**。
- 桌機與行動（390×844）模擬皆無 console 錯誤、無水平溢出。

---

## 五、⚠️ 使用者待辦（必要）

**Google 端 Apps Script 專案仍需使用者手動更新** —— `scripts/rsvp-to-sheet.gs` 放在 repo 只是版本控管副本；**部署網站到 GitHub Pages 完全不會更新 Google 端專案**。本次 v52 未變更 Apps Script 內容，若先前已完成授權則無需重做。
