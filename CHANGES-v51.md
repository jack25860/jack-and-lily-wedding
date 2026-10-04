# v51 變更說明 — 修正使用者回報的兩個真實問題（音樂預設未開啟／電子喜帖影片卡住）

**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**Repo**：jack25860/jack-and-lily-wedding（main）
**版本**：v51（由 v50 複製為新版本；v50 及更早版本皆保持不變）
**部署**：沿用既有 `deploy-site.yml`（`workflow_dispatch` + `zip_url`）— **未新增、未修改任何 workflow**

---

## 使用者回報（v50 上線後仍存在）

1. 結婚網頁 `index.html`：音樂**預設仍是關閉**，打開頁面時漂浮按鈕顯示「關閉」、音樂沒有播放。
2. 電子喜帖頁 `ecard-video.html`：影片**一樣會卡住**（播放中斷、不會持續運轉）。

---

## 一、`index.html` ＋ `js/app.js` — 音樂改為「開啟即播放、預設 ON」

### 1. `index.html`：移除從 localStorage／sessionStorage 還原開關狀態的邏輯

| 項目 | v50 | **v51** |
|---|---|---|
| 還原靜音狀態 | `var muted=false;try{muted=localStorage.getItem(K)==="1"}catch(e){}` | **移除**（不再讀取） |
| 記憶關閉狀態 | `function remember(m){…localStorage.setItem(K,"1")…}` | **移除寫入**（`remember()` 改為 no-op） |
| 媒體守護 harden() | `if(muted){el.muted=true}` | `el.muted=false; if(!el.volume){el.volume=1}` |
| 覆寫 play() | `if(muted){remember(false);this.muted=false}` | `this.muted=false; if(!this.volume){this.volume=1}` |
| 初始按鈕 | `aria-pressed="true"`（但載入後可能被還原成關閉） | **`class="music__btn playing"`＋`aria-pressed="true"`＋`MUSIC ON`**（HTML 即為播放中樣式） |

> 舊的「關閉」值不會再讓預設變關閉：程式在任何情況下都不再讀取 localStorage 的音樂開關。

### 2. `js/app.js` `initMusic()`：預設開啟 ＋ 可靠自動播放 ＋ 保留可切換

- 新增 `setDefaultOn()`：載入與 `pageshow` 時，按鈕一律標記為播放中（`.playing`、`aria-pressed="true"`、`aria-label="關閉背景音樂"`、標籤 `MUSIC ON`）。
- `ensure()`：一律 `muted=false`、`volume=1` 後呼叫 `play()`；`play()` 的 rejected promise 一律 catch，絕不拋錯。
- `ensureSoon()`：立即重試，並於 140ms／700ms 再各補一次 `play()`（解決初始化時序導致的無聲）。
- 「第一次任何互動立即補播放」：`pointerdown／mousedown／touchstart／keydown／wheel／scroll`（capture）皆會補播放；互動前若尚未播放成功，按鈕仍顯示 ON（≤8 秒啟動窗），避免出現「開啟失敗就顯示關閉」。
- 新增 `stalled／waiting／error／loadeddata`、`visibilitychange`、`pageshow` 事件補播放，避免音樂因緩衝或切換分頁而停掉。
- 保留可切換：按一下 → `pause()`＋`MUSIC OFF`；再按一下 → 解除靜音並 `play()`＋`MUSIC ON`。

---

## 二、`ecard-video.html` — 徹底修正「影片卡住」＋確保有聲音

以硬性看門狗與多重事件監聽，確保影片**不會因任何來源停止**：

| 機制 | 說明 |
|---|---|
| `pause／stalled／waiting／suspend／emptied／abort` 監聽 | 只要被任何來源暫停或緩衝卡住，立即 `resume()` 恢復播放 |
| `ended` 監聽 | 若結束，歸零 `currentTime` 後續播（確保循環運轉） |
| 就緒事件 `loadedmetadata／loadeddata／canplay／canplaythrough／playing／progress` | 仍為暫停即播放 |
| 點擊畫面（`click／pointerdown／mousedown／touchstart／touchend／dblclick`，capture） | 點畫面任何一處都不會讓影片停下；點完立即恢復 |
| `visibilitychange／focus／pageshow／scroll` | 分頁切回、視窗聚焦、回到頁面即續播 |
| **硬性看門狗（每 400ms）** | 最終保底：只要該播放卻停了（`paused` 或 `ended`）就重啟 |
| `play()` 被拒 | 先靜音續播確保畫面持續運轉；**首次任何互動自動解除靜音並播放** |
| 音效 | `muted=false`、`volume>0`；**頁面上不提供任何音效開關** |

**影片檔音軌確認（ffprobe，v50 已驗證、v51 未變更）**：`media/ecard-video.mp4` = h264 + **aac**；`media/ecard-video.webm` = vp9 + **opus**。

---

## 三、維持不變

酒紅 `#6E1626`／金 `#C9A961`／宣紙米色；RSVP 送出流程；電子喜帖手動寄送、142 張全池隨機婚紗照；大人上限 10 人；去重窗期 8 秒；寄送成功後清空輸入框；結婚預告片倒數文案；婚禮當日注意事項區塊；信件內嵌循環 GIF 的呈現方式。

---

## 四、⚠️ 使用者待辦（必要）

**Google 端 Apps Script 專案仍需使用者手動更新** —— `scripts/rsvp-to-sheet.gs` 放在 repo 只是版本控管副本；**部署網站到 GitHub Pages 完全不會更新 Google 端專案**。

1. 開啟回覆試算表 → 「擴充功能」→「Apps Script」
2. 將 `scripts/rsvp-to-sheet.gs` 最新全文貼上並儲存
3. 函式選 **`testEcard`** → 執行 → 同意 **Gmail 寄信權限**
4. 「部署」→「管理部署」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
5. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL` 並重新部署網站

**驗證方式**：開啟 `/exec?diag=1`，出現 `"mailScope":true` 即完成。
