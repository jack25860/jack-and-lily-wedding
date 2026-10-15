# v55 — 音樂預設開啟確認 ＋ 電子喜帖漂浮音效開關

**日期**：2026-10-04
**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**電子喜帖頁**：https://jack25860.github.io/jack-and-lily-wedding/ecard-video.html
**Repo**：jack25860/jack-and-lily-wedding（main）
**部署**：沿用既有 `.github/workflows/deploy-site.yml`（未新增、未修改 workflow）

---

## 使用者需求

1. **結婚網站（index.html）音樂**：重新檢查並確認「預設開啟」，保留漂浮開關可關閉，網站開啟後 3 秒內要有音樂。
2. **電子喜帖頁（ecard-video.html）**：比照結婚網站做一個漂浮開關（可開／關聲音），**預設開啟**，並與電子喜帖一樣**循環播放**。

---

## 本次變更

### 1. index.html — 背景音樂預設開啟（強化）

- **現況確認**：v51 起已移除「從 localStorage 還原靜音狀態」的邏輯；`initMusic()` 於 boot 時即 `audio.muted=false; audio.volume=1;` 並立即 `ensure()`（呼叫 `play()`），且 `<audio src="audio/wedding-theme.mp3" loop preload="auto">` 直接寫在 HTML，瀏覽器解析階段即開始下載；`<link rel="preload" as="audio">` 亦已存在。漂浮開關 `#musicBtn`（右下角、酒紅／金／宣紙米色）可切換開／關。
- **v55 強化**：於 `<head>` 加入一段極小的防禦性腳本，**主動清除任何舊版可能殘留的「音樂關閉／靜音」localStorage 值**（key 含 `music`／`muted`／`bgm`／`sound` 者），確保背景音樂一律預設開啟、不受舊狀態影響。
- 首次互動（pointerdown／touchstart／keydown／scroll）後即 `force()` 解除靜音並續播，符合「3 秒內出聲」。

### 2. ecard-video.html — 新增漂浮音效開關（預設開啟）

- 新增與結婚網站 `.music` **同位置（右下角）、同視覺風格**的漂浮開關 `.sound`：
  - 酒紅 `#6E1626`（hover 底色）／金 `#C9A961`（邊框、等化條）／宣紙米色 `#F5F0E7`（文字）。
  - 結構與結婚網站一致：等化條 `.sound__bars`（4 條）＋標籤 `SOUND ON / SOUND OFF`，`aria-pressed` 同步。
  - 手機（≤640px）隱藏文字標籤、僅留圖示，與結婚網站相同。
- **預設開啟**：`userOff=false`；`sound()` 於載入與首次互動時將 `muted=false`、`volume=1`。
- **可開／關**：點擊開關 → 關閉時 `muted=true`（`userOff=true`，不再自動解除靜音）；再點 → `muted=false` 並 `play()` 續播。
- **維持循環播放**：`<video autoplay loop muted playsinline>` 與 `loop` 屬性不變；`ended` 歸零續播邏輯保留。

### 3. 不破壞 v54 的 Android 修正（重點）

v54 為修正「Android 點擊／滑動導致影片暫停」，已加原生 `controls` ＋ 透明防護層 `.frame__shield`。v55 **完整保留**：

- `<video>` 的原生 `controls`、`controlslist`、`disablepictureinpicture` 與 CSS 隱藏控制列規則（`::-webkit-media-controls*`）**未更動**。
- `.frame__shield` 及其所有事件監聽（click／pointerdown／touchstart／touchend／mousedown／mouseup／dblclick → `resume()`）**未更動**。
- 新增的漂浮開關位於 `.frame` **之外**（`position:fixed`，`z-index:800`），不與防護層重疊，開關本身可正常點擊。
- 開關點擊處理器 `e.stopPropagation()`，且 `unlock()` 於首次互動若目標為 `#soundBtn` 時直接 return，避免「先自動開聲、再被開關關掉」的競態。

---

## 維持不變（回歸確認）

- 酒紅 `#6E1626`／金 `#C9A961`／宣紙米色配色。
- RSVP 送出流程（`postRow` → Apps Script → 成功後 `resetRsvpForm()` 清空、`showThanks()`）。
- 電子喜帖手動寄送、142 張全池隨機婚紗照（`ECARD_PHOTO_POOL`）、大人上限 10 人、去重窗期 8 秒、寄送成功後清空輸入框。
- 結婚預告片倒數文案（`initTrailerRelease`）。
- 婚禮當日注意事項區塊。
- 信件內嵌循環 GIF 呈現方式（`media/ecard-loop.gif`）。

---

## 驗證

以真實瀏覽器（Chromium，Android Chrome 與 iOS Safari 裝置模擬、實際派送觸控手勢）於**正式站**驗證：

- index.html：音樂預設開啟（`muted=false`、`volume>0`）、漂浮開關可切換、首次互動後 3 秒內出聲、無 console 錯誤。
- ecard-video.html：漂浮開關存在且預設開啟、可開／關、影片維持循環播放（`currentTime` 前進並回繞）、點擊／滑動畫面不暫停影片（v54 修正未破壞）、無 console 錯誤。

> 註：`scripts/*.gs` 為 Google Apps Script 專案的鏡像，GitHub Pages 部署不會更新線上 Apps Script；本次未變更寄信後端，故無需重新貼上／重新部署 Apps Script。
