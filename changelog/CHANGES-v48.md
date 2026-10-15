# v48 變更說明 — 電子喜帖影片播放頁：加上「開啟音效」，讓音樂聽得到

**版本**：v48（由 v47 複製，v47 及更早版本皆未更動）
**部署**：沿用既有 `.github/workflows/deploy-site.yml`（`workflow_dispatch` + `zip_url`）— 未新增、未修改任何 workflow
**日期**：2026-10-04

---

## 0. 問題與根因

使用者回饋：「電子喜帖連結的網站怎麼沒有影片的音樂」

### 先做兩項確認（任務要求）

**① 影片檔本身有沒有音軌？ → 有。**

```
ffprobe ecard-video.mp4
  index=0  h264   video  duration=18.200  bit_rate=1817079
  index=1  aac    audio  sample_rate=44100  channels=2  bit_rate=96105   ← 立體聲音軌

ffprobe ecard-video.webm
  index=0  vp9    video
  index=1  opus   audio  sample_rate=48000  channels=2                 ← 立體聲音軌
```

→ **素材沒有問題，兩種格式都含立體聲音軌。**

**② 頁面為什麼沒聲音？ → 因為 `<video>` 被設為 `muted`。**

```html
<video id="ecardVideo" autoplay loop muted playsinline ...>
```

這是**瀏覽器自動播放政策的必要條件**：未靜音的自動播放會被 Chrome／Safari 等封鎖。所以 v47 的頁面雖然一進站就自動循環播放，但**永遠是無聲的，且頁面上沒有任何可以開啟聲音的控制項**（唯一按鈕是「暫停播放」）。

→ **程式刻意靜音、但沒有提供解除靜音的方式，這就是沒音樂的原因。**

---

## 1. v48 修改內容

### 1.1 保留靜音自動播放，新增明顯的「🔊 開啟音效」按鈕

`ecard-video.html`：

| 項目 | v47 | **v48** |
|---|---|---|
| `<video>` 屬性 | `autoplay loop muted playsinline` | **不變**（仍符合自動播放政策，一進頁面即自動循環） |
| 音效控制 | **無** | **新增 `#soundBtn`「🔊 開啟音效 / 🔇 關閉音效」** |
| 按鈕順位 | — | **排在三個按鈕的最前面**（金色實心＋呼吸光環，視覺最醒目） |
| 影片畫面 | 僅播放 | **點影片畫面也可切換音效**（`cursor:pointer`） |
| 頁面任意處 | — | **首次點擊非連結／非按鈕區域，自動嘗試解除靜音一次** |
| 文字提示 | 無 | 新增 `#soundHint`「♫ 想聽音樂，**點一下即可開啟音效**」，開啟後自動隱藏 |

### 1.2 解除靜音的實作要點（為什麼這樣做才不會被瀏覽器中斷）

- **`v.muted = false` 一律在使用者手勢（`click`）之內執行。** 瀏覽器只允許在使用者手勢中解除靜音；若在非手勢的時機解除，會被政策擋下，甚至導致播放中斷。v48 因此**不做「載入後自動解除靜音」**（那會違反政策）。
- 解除靜音時同步 `v.play()` 並確保 `volume > 0`（`if(v.volume === 0) v.volume = 1`）。
- 「首次點擊頁面任意處自動解除靜音」採 **capture 階段**監聽、且以 `gestureUsed` 旗標確保**只嘗試一次**；若點擊目標是連結／按鈕／影片框則交由其自身處理，避免雙重觸發。
- 監聽 `volumechange` 保持按鈕狀態同步（例如使用者用系統／瀏覽器控制項調整音量時）。

### 1.3 樣式（沿用既有色票，未新增色票）

- 音效按鈕：酒紅文字 `--wine-dark` on 金色漸層 `--gold → --gold-light`；開啟後改為描邊金色（`is-on`），與其他按鈕一致。
- 提示膠囊：`--wine` 半透明底 + 金色虛線邊；音符圖示以既有 `--ease` 曲線做細微呼吸動畫。
- 行動版（≤640px）：按鈕全寬堆疊、影片框全寬；`prefers-reduced-motion` 下關閉所有動畫。

---

## 2. 驗證（真實 Chromium）

| 驗證 | 結果 |
|---|---|
| 影片自動循環播放（靜音） | 通過 ✅ |
| 點擊音效按鈕 → `video.muted === false`、`volume > 0` | 通過 ✅ |
| 點擊後音訊確實輸出（非靜音狀態下 `paused === false`） | 通過 ✅ |
| 再點一次 → 回到 `muted === true` | 通過 ✅ |
| 按鈕圖示／文字隨狀態切換（🔊/🔇、開啟/關閉） | 通過 ✅ |
| 提示文字在開啟音效後隱藏 | 通過 ✅ |
| 桌機 1440×900：無水平捲動、console error = 0、pageerror = 0 | 通過 ✅ |
| 行動版 390×844：無水平捲動、console error = 0、pageerror = 0 | 通過 ✅ |
| 正式站回歸（13 section、預告片倒數、注意事項、座位表預留、RSVP） | 通過 ✅ |

---

## 3. 維持不變

酒紅 `#6E1626`／金 `#C9A961`／宣紙米色；RSVP 送出流程；電子喜帖為**手動寄送**、信件內嵌隨機婚紗照（**142 張全池**）；大人出席人數上限 10 人；電子喜帖去重窗期 **8 秒**；寄送成功後清空輸入框；結婚預告片倒數文案；婚禮當日注意事項區塊；**信件內嵌循環 GIF 的呈現方式**（v47 已定案，本次不動）。

---

## 4. ⚠️ 使用者待辦（必要，否則電子喜帖仍不會生效）

**Google 端 Apps Script 專案仍需手動更新。** `scripts/rsvp-to-sheet.gs` 放在 repo 只是版本控管副本；**部署網站到 GitHub Pages 完全不會更新 Google 端專案**。

1. 開啟回覆試算表 → 「擴充功能」→「Apps Script」
2. 將 `scripts/rsvp-to-sheet.gs` 最新全文貼上並儲存
3. 函式選 **`testEcard`** → 執行 → 同意 **Gmail 寄信權限**
4. 「部署」→「管理部署」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
5. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL` 並重新部署網站

**驗證方式**：開啟 `/exec?diag=1`，出現 `"mailScope":true` 即完成。

> 註：**本次 v48 只改網站上的影片播放頁（`ecard-video.html`），不涉及 Apps Script 的寄信邏輯**，因此上述待辦與「有沒有聲音」無關；但電子喜帖的信件模板仍受此待辦影響。

---

## 5. 變更檔案

| 檔案 | 變更 |
|---|---|
| `ecard-video.html` | 新增「🔊 開啟音效 / 關閉音效」按鈕、點影片畫面切換音效、首次點擊頁面解除靜音、文字提示與對應樣式 |
| `CHANGES-v48.md` | 新增 |

`media/ecard-video.mp4`、`media/ecard-video.webm`、`media/ecard-loop.gif`、`images/ecard-video-poster.jpg`、`scripts/rsvp-to-sheet.gs`、`js/config.js` 等**皆未變更**。
