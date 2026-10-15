# v50 變更說明 — 音樂播放行為修正（喜帖強制播放／婚網預設開啟可切換）

**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**版本**：v50（由 v49 複製；v49 及更早版本皆未更動）
**部署**：沿用既有 `deploy-site.yml`（`workflow_dispatch` + `zip_url`）— 未新增、未修改任何 workflow

---

## 使用者回饋（三個問題＋兩項需求）

1. 電子喜帖頁（`ecard-video.html`）沒有聲音，而且只要點下畫面任何一處，影片就直接暫停、不會繼續運轉。
2. 結婚網站頁（`index.html`）音樂有時不會出現，需要重新刷新才會播放。
3. 需求：結婚網頁改成「打開就播放」，並**保留原本的漂浮按鈕**，該按鈕**預設為開啟（播放中）**，按下後可關閉音樂（可切換，預設 ON）。
4. 需求：電子喜帖頁則為**強制播放、不能關閉**（無任何音效開關）。

---

## 一、`ecard-video.html` — 修正「點畫面就暫停」＋修正沒有聲音

| 項目 | v49 | **v50** |
|---|---|---|
| 「暫停播放／繼續播放」按鈕 | 有（`#toggleBtn`） | **整顆移除**（改為強制播放、不能關閉） |
| 點按鈕切換暫停 | 有 | **移除** |
| 點畫面任何一處就暫停 | 有（`pause` 事件被外部觸發後不會恢復） | **修正**：新增 `pause` 監聽，只要影片被任何來源暫停且尚未結束，立即 `play()` 恢復 → 點畫面任何一處都不會停止 |
| 沒有聲音 | 載入即 `forceSound()` 並嘗試有聲播放；被政策擋下時先靜音播放，待首次互動解除靜音 | **維持並強化**：載入即 `muted=false`、`volume=1`、移除 `muted` 屬性並 `play()`；被自動播放政策擋下時先靜音播放確保畫面會動，於**使用者第一次任何互動**（pointerdown／mousedown／touchstart／keydown／wheel／scroll）立即解除靜音並播放 |
| 音效開關 | 無 | **無**（頁面上不存在任何音效開關） |

**影片檔音軌確認（ffprobe）**：
- `media/ecard-video.mp4` → `h264` 影像 + **`aac` 音訊（44100Hz, 2ch）**
- `media/ecard-video.webm` → `vp9` 影像 + **`opus` 音訊（48000Hz, 2ch）**

兩格式皆含音軌，故頁面修正後即可有聲播放。

---

## 二、`index.html` — 恢復漂浮音樂按鈕（預設開啟）＋修正「有時不出現」

### 1. 恢復右下角漂浮按鈕（沿用酒紅／金／宣紙米色風格）

```diff
- <!-- 背景音樂：強制播放，不提供任何開關 -->
- <audio id="bgm" loop preload="auto"></audio>
+ <!-- 背景音樂：預設開啟（播放中），右下角漂浮按鈕可切換開／關 -->
+ <div class="music" id="music">
+   <button class="music__btn" id="musicBtn" aria-label="關閉背景音樂" aria-pressed="true">
+     <span class="music__bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
+     <span class="music__label" id="musicLabel">MUSIC ON</span>
+   </button>
+   <audio id="bgm" loop preload="auto"></audio>
+ </div>
```

- 按鈕**預設為開啟（播放中）**：初始 `aria-pressed="true"`、標籤 `MUSIC ON`、等化條動畫（`.playing`）。
- 按下可關閉音樂（`MUSIC OFF`），再按可開啟。

### 2. `js/app.js` — `initMusic()` 改為「預設開啟 + 可切換 + 可靠自動播放」

- 載入即 `muted=false`、`volume=1`、`play()`（打開就播放）。
- **修正「音樂有時不出現、需刷新才播放」**：於**使用者第一次任何互動**（pointerdown／mousedown／touchstart／keydown／wheel／scroll）補播放；並在 `canplay` 時若仍暫停則再補一次 `play()`，避免因自動播放政策或載入時序而靜音。
- 按鈕切換：播放中→`pause()`（`userOff=true`，互動補播放不再自動開啟）；已暫停→解除靜音並 `play()`。
- 以 `play`／`pause`／`ended` 事件同步按鈕狀態（`MUSIC ON`／`MUSIC OFF`、`aria-pressed`、等化條動畫）。

### 3. `css/styles.css` — 恢復 `.music` 樣式

- 恢復 `.music`、`.music__btn`、`.music__bars`、`.music__label`、`@keyframes eq`，以及 `@media(max-width:640px)` 的 `.music__label`／`.music__btn` 覆寫。
- `@media print` 的隱藏清單加回 `.music`。**版面不留空位、不破版。**

---

## 三、維持不變

酒紅 `#6E1626`／金 `#C9A961`／宣紙米色；RSVP 送出流程；電子喜帖手動寄送、142 張全池隨機婚紗照；大人上限 10 人；去重窗期 8 秒；寄送成功後清空輸入框；結婚預告片倒數文案；婚禮當日注意事項區塊；信件內嵌循環 GIF 的呈現方式。

---

## 四、⚠️ 使用者待辦（必要）

**Google 端 Apps Script 專案仍需手動更新** —— `scripts/rsvp-to-sheet.gs` 放在 repo 只是版本控管副本；**部署網站到 GitHub Pages 完全不會更新 Google 端專案**。

1. 開啟回覆試算表 → 「擴充功能」→「Apps Script」
2. 將 `scripts/rsvp-to-sheet.gs` 最新全文貼上並儲存
3. 函式選 **`testEcard`** → 執行 → 同意 **Gmail 寄信權限**
4. 「部署」→「管理部署」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
5. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL` 並重新部署網站

**驗證方式**：開啟 `/exec?diag=1`，出現 `"mailScope":true` 即完成。
