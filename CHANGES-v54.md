# v54 變更說明 — 修正使用者回報的 Android 專屬問題（電子喜帖：點擊／滑動導致影片暫停）

**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**電子喜帖頁**：https://jack25860.github.io/jack-and-lily-wedding/ecard-video.html
**Repo**：jack25860/jack-and-lily-wedding（main）
**版本**：v54（由 v53 複製為新版本；v53 及更早版本皆保持不變）
**部署**：沿用既有 `deploy-site.yml`（`workflow_dispatch` + `zip_url`）— **未新增、未修改任何 workflow**

---

## 使用者回報（v53 上線後，問題仍在）

- 電子喜帖頁 `ecard-video.html` 在 **Android 手機**上，**只要點擊畫面周圍或滑動頁面，影片就會暫停**。
- **iPhone 正常**。
- ⚠️ 前兩版（v52、v53）的驗收都以 headless Chromium 模擬通過，但**實機 Android 仍失敗**。

---

## 一、根因（Android Chrome 專屬）

**Android Chrome 對「點擊 `<video>` 區域」的預設行為與 iOS 不同。**

- 在**沒有原生 `controls`** 的 `<video>` 上，Android Chrome 會把 tap 當成「**切換播放／暫停**」；
  因此點到影片（或滑動時手指落在影片上）就會 `pause()`。
- iOS Safari 對同樣的 `<video>` 不會因 tap 而暫停，故 iPhone 正常。
- v53 的看門狗雖會復播，但 Android 上 `pause → play` 的來回造成明顯「一碰就停」的體感，
  且滑動時反覆觸發，使用者感受即為「點擊／滑動就暫停」。

**以真實瀏覽器重現**：Playwright Chromium + Android Chrome UA（Pixel 7、412×915、`is_mobile`、`has_touch`），
以 CDP `Input.dispatchTouchEvent` 派送真實 `touchstart/touchmove/touchend` 與 `click` 手勢。

---

## 二、修正內容（`ecard-video.html`）

| 項目 | v53 | **v54** |
|---|---|---|
| `<video>` 原生 controls | 無（Android tap = 切換播放／暫停） | **加上 `controls`**：Android Chrome 對「有 controls 的影片」點擊行為改為**切換控制列**而非暫停播放（與 iOS 一致），從根本消除 tap-to-pause |
| 原生控制列外觀 | — | 以 CSS `::-webkit-media-controls*` **完全隱藏**，維持極簡視覺，且頁面上仍**不出現任何音效開關** |
| 影片上方防護層 | 無 | 新增透明 `.frame__shield`，**攔截所有點擊／觸控**，任何 tap 都不會傳到 `<video>` 觸發原生暫停 |
| `play()` 被政策擋下 | 已互動過就 `return`（Android 上可能永久 paused） | **移除早退**：一律先靜音讓畫面持續運轉，絕不讓影片卡住 |
| `pause` 事件 | 交由 `setTimeout(resume,0)` | **立即復播**（略過節流），把 Android 原生 tap-to-pause 的體感降到最低 |
| 看門狗 | 每 500ms，只在真正 `paused` 時 `play()` | 維持不變（**絕不因緩衝 `load()`**） |
| 緩衝自我修復 | `pause/stalled/waiting/suspend/emptied/abort` → `resume()` | 維持不變 |
| 續播時機 | `visibilitychange/focus/pageshow/scroll` | 維持不變 |
| 循環 | `ended` → `currentTime=0` 續播 | 維持不變 |
| 音效 | `muted=false`、`volume>0`；頁面不提供任何音效開關 | 維持不變（政策擋下時於首次互動自動解除靜音） |

**核心原則**：讓 Android 的「點擊影片」不再等同「暫停」，並以透明防護層確保任何 tap 都不會落到 `<video>`；
同時保留 v53「絕不因緩衝 `load()`」的修正。

---

## 三、維持不變

酒紅 `#6E1626`／金 `#C9A961`／宣紙米色；RSVP 送出流程；電子喜帖手動寄送、142 張全池隨機婚紗照；
大人上限 10 人；去重窗期 8 秒；寄送成功後清空輸入框；結婚預告片倒數文案；婚禮當日注意事項區塊；
信件內嵌循環 GIF 呈現方式。**結婚網站 `index.html` 未變更。**

---

## 四、驗證（真實瀏覽器，Android Chrome UA + 真實觸控手勢）

以 Chromium（Playwright）模擬 Android Chrome（Pixel 7 UA、412×915、`is_mobile`、`has_touch`），
派送真實 `touchstart/touchmove/touchend` 與 `click`：

- **防護層**：`elementFromPoint` 於影片中心回傳 `.frame__shield`（確實攔截）。
- **原生 controls**：`<video>` 具 `controls` 屬性；頁面無任何音效開關。
- **點擊畫面周圍**：`paused` 全程 `false`、`currentTime` 持續前進。
- **點擊影片本身**（回報的 Android 觸發點）：`paused` 全程 `false`、`currentTime` 持續前進。
- **真實滑動**（touchstart→touchmove→touchend 覆蓋影片）：`paused` 全程 `false`、`currentTime` 持續前進。
- **頁面捲動**、**連續多點擊**：`paused` 全程 `false`、`currentTime` 持續前進。
- **外部 `pause()` 自我修復**、**分頁隱藏→顯示續播**：皆於約 1.2 秒內恢復且時間軸持續前進。
- **嚴格自動播放政策**（不帶 `--autoplay-policy` 旗標，貼近實機預設）：手勢後仍持續播放、無 page error。
- **版面**：`scrollWidth === clientWidth`（無水平溢出）、console 錯誤 0。

**結果：16/16 全數通過（含嚴格自動播放政策）。**
首頁回歸：15/15 通過（章節、RSVP、大人上限 10、倒數、相簿、無 console 錯誤、無水平溢出）。

---

## 五、⚠️ 使用者待辦（必要）

**Google 端 Apps Script 專案仍無需更新** —— 本次 v54 僅變更前端 `ecard-video.html`，
未變更 Apps Script 內容；若先前已完成授權則無需重做。`scripts/rsvp-to-sheet.gs` 放在 repo
只是版本控管副本，部署網站到 GitHub Pages 不會更新 Google 端專案。
