# v49 變更說明 — 音樂強制開啟（移除所有音效開關）

**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**版本**：v49（由 v48 複製；v48 及更早版本皆未更動）
**部署**：沿用既有 `deploy-site.yml`（`workflow_dispatch` + `zip_url`）— 未新增、未修改任何 workflow

---

## 使用者需求

> 「結婚網頁跟電子喜帖的音樂強制開啟，不要有選項可以開關」

**目標**：婚禮網頁（`index.html`）與電子喜帖影片播放頁（`ecard-video.html`）的音樂**一律強制開啟**，**移除所有可開關音效的選項**。

---

## 一、盤點：v48 的音效控制項

| 頁面 | v48 的控制項 |
|---|---|
| `ecard-video.html` | 「🔊 開啟音效／關閉音效」按鈕、點影片畫面切換音效、首次點頁面解除靜音、文字提示「想聽音樂，點一下即可開啟音效」、`.btn--sound`／`.hint` 樣式 |
| `index.html` | 右下角浮動「MUSIC OFF／MUSIC ON」開關按鈕（`#musicBtn`）、`<audio id="bgm">`、`localStorage` 記憶開關狀態 |
| `js/app.js` | `initMusic()`：按鈕點擊切換播放／暫停、`BGM_KEY` 記憶 |
| `css/styles.css` | `.music`、`.music__btn`、`.music__bars`、`.music__label`、`@keyframes eq` |

---

## 二、v49 修改內容

### 1. `ecard-video.html` — 移除全部音效開關，改為強制播放

| 項目 | v48 | **v49** |
|---|---|---|
| 音效按鈕 | 「🔊 開啟音效／關閉音效」 | **整顆移除** |
| 點影片畫面切換音效 | 有 | **移除**（`.frame` 不再有 `cursor:pointer` 與 click 切換） |
| 文字提示 | 「想聽音樂，點一下即可開啟音效」 | **整行移除** |
| `<video>` 屬性 | `autoplay loop muted playsinline` | **`autoplay loop playsinline`（移除 `muted`）** |
| 說明文字 | 「點『開啟音效』或影片畫面，即可聽見配樂」 | 「**影片會自動循環播放，並自動開啟配樂。**」 |
| 按鈕列 | 開啟音效／暫停播放／回到婚禮網站 | **暫停播放／回到婚禮網站** |
| CSS | `.hint`、`.btn--sound`、`@keyframes soundRing`、`notePulse` | **全部移除** |

**強制播放實作**（業界標準做法，符合瀏覽器自動播放政策）：
1. 頁面載入即 `forceSound()`（`muted=false`、`defaultMuted=false`、移除 `muted` 屬性、`volume=1`）並嘗試 `play()`。
2. 若被瀏覽器自動播放政策擋下 → 先靜音播放確保畫面會動，**待使用者第一次任何互動（pointerdown／mousedown／touchstart／keydown／wheel／scroll）時立即解除靜音並播放**。
3. **不提供任何關閉選項** —— 使用者無法把音樂關掉。

### 2. `index.html` — 移除 MUSIC 開關區塊

```diff
- <div class="music" id="music">
-   <button class="music__btn" id="musicBtn" aria-label="播放背景音樂" aria-pressed="false">
-     <span class="music__bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
-     <span class="music__label" id="musicLabel">MUSIC OFF</span>
-   </button>
-   <audio id="bgm" loop preload="none"></audio>
- </div>
+ <!-- 背景音樂：強制播放，不提供任何開關 -->
+ <audio id="bgm" loop preload="auto"></audio>
```

### 3. `js/app.js` — `initMusic()` 改為強制播放

- 移除按鈕、`sync()`、`BGM_KEY` 與 `localStorage` 記憶邏輯。
- 改為：設定 `src`、`loop=true`、`muted=false`、`volume=1`，載入後 `play()`；被政策擋下時，於**首次任何互動**立即解除靜音並播放。
- **無任何關閉途徑**。

### 4. `css/styles.css` — 移除 `.music` 相關樣式

移除 `.music`、`.music__btn`、`.music__bars`、`.music__label`、`@keyframes eq`，以及 `@media(max-width:640px)` 內的 `.music__label`／`.music__btn` 覆寫與 `@media print` 中的 `.music` 項目。**版面不留空位、不破版。**

---

## 三、維持不變

酒紅 `#6E1626`／金 `#C9A961`／宣紙米色；RSVP 送出流程；電子喜帖手動寄送、142 張全池隨機婚紗照；大人出席人數上限 10 人；電子喜帖去重窗期 8 秒；寄送成功後清空輸入框；結婚預告片倒數文案；婚禮當日注意事項區塊；信件內嵌循環 GIF 的呈現方式。

---

## 四、⚠️ 使用者待辦（必要）

**Google 端 Apps Script 專案仍需手動更新** —— `scripts/rsvp-to-sheet.gs` 放在 repo 只是版本控管副本；**部署網站到 GitHub Pages 完全不會更新 Google 端專案**。

1. 開啟回覆試算表 → 「擴充功能」→「Apps Script」
2. 將 `scripts/rsvp-to-sheet.gs` 最新全文貼上並儲存
3. 函式選 **`testEcard`** → 執行 → 同意 **Gmail 寄信權限**
4. 「部署」→「管理部署」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
5. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL` 並重新部署網站

**驗證方式**：開啟 `/exec?diag=1`，出現 `"mailScope":true` 即完成。
