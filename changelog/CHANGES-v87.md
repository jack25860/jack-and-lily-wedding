# v87 — 相簿燈箱 BUG 修正、賓客可見文字修正、QA 報告 P1/P2/P3 修正

## 一、相簿燈箱 BUG（核心）

**症狀**：點開任何一張照片，燈箱都顯示同一張照片（實際上是「上一張」）。

**根因**（以真實瀏覽器 + 限速網路重現）：
1. `renderLb()` 切換照片時只移除 `is-loaded`（`opacity:0`），但 `.lb-img` 的 `lbIn` 進場動畫
   使用 `animation-fill-mode:both`，動畫結束後仍以 `opacity:1` 蓋掉 `opacity:0`，
   於是**上一張原圖會一直留在畫面上**，直到新的 15MB 原檔下載完成。
2. `openLb()` 在 `renderLb()` **之後**才呼叫 `lbState(null)`，把 `renderLb()` 剛設好的
   「正在載入原圖…」載入指示清掉 → 使用者完全看不到任何載入回饋。
3. 在慢速網路（2 Mbps）下，15MB 原檔需 60 秒以上，等同「卡住不動、永遠顯示同一張」。

**修正**：
- 切換時**先立刻顯示「這一張」的縮圖**（正確的照片，且多半已在格線中快取），
  再於原檔下載完成後換上原檔（4640×6960）。既不殘留上一張，也不讓使用者空等。
- 修正 `openLb()` 呼叫順序：先 `renderLb()`（顯示載入中）再顯示燈箱。
- CSS 加上 `.lb-img:not(.is-loaded){opacity:0!important}` 作為雙重保險。
- 保留 `lbToken` 競態防護：快速連點時只採用最後一次請求的結果。

**驗證**（Playwright，桌機 1440 / 手機 390，限速 2 Mbps）：
- 逐張點開 #0/#1/#2/#50/#100/#136，`#lbImg` 的 `src` 與該張 `data-full` 完全對應，
  `naturalWidth` = 4640（原檔），**0 筆不符**。
- 限速下切換照片：立即顯示正確縮圖 + 「正在載入原檔…」，**不再殘留上一張**。

## 二、賓客可見文字修正

| 位置 | 修正前 | 修正後 |
|---|---|---|
| 相簿區塊描述 | 「精修婚紗照 — 合影、特寫、互動、齊聚，四個篇章。**v79：137 張全面去浮水印。**」 | 「三朝風華，一世情深 —— 戰國、盛唐、大明，我們在三個朝代裡，預演了三生三世。」 |
| 燈箱圖說 | 「唐代 · 05 · **唐代 5**」（原始檔名標籤） | 「唐代 · 盛世繁華，錦繡良緣。」（主題名 + 主題詩句） |

內部備註（版本號、去浮水印、原始檔名編號）一律不再出現在賓客可見處。

## 三、QA 報告修正（P1/P2/P3）

- **P1-1 RSVP／電子喜帖 API 驗證**：新增共用密鑰 `SHARED_TOKEN`（前端 `js/config.js`
  的 `RSVP_SHARED_TOKEN` ↔ 後端 `scripts/rsvp-to-sheet.gs` 的 `SHARED_TOKEN`），
  未帶或錯誤一律回 `{ok:false,error:"unauthorized"}`；並新增**同一 email 重複回覆就地更新**
  （保留原序號，不新增重複名單）。`ENDPOINT_VERSION` → `v48`。
- **P1-2 audio preload**：`<audio preload="auto">` → `preload="none"`，首屏不再下載 704KB mp3；
  使用者點 MUSIC 或首次手勢時才 `load()` + `play()`。實測：手勢前 0 次 mp3 請求，手勢後正常播放。
- **P2-3 燈箱焦點管理**：開啟時焦點移入對話框（關閉鈕），Tab 在燈箱內循環，
  關閉時焦點還原來源縮圖。
- **P2-7 figure role**：每個 `.g-item` 加上 `role="button"` 與 `aria-label="開啟大圖：…"`。
- **P3-8 lbImg 空 src**：移除 `<img id="lbImg" src="">` 的空 `src`，消除假破圖與多餘請求。
- **P3-9 SEO**：`seating.html` 補 description／OG；`ecard-video.html` 補 OG；
  新增 `robots.txt` 與 `sitemap.xml`。
- **P3-10 overflow-x**：`body{overflow-x:hidden}` → `overflow-x:clip`（不破壞 sticky、不造成 iOS 捲動異常）。
- **P3-11 電子喜帖預覽頁版本標示**：`v56` → `v87`，並更新說明文字。

## 四、驗收（本機，Playwright 真實瀏覽器）

| 項目 | 桌機 1440 | 手機 390 |
|---|---|---|
| 相簿張數 | 137 | 137 |
| 破圖 | 0 | 0 |
| 水平溢位 | 0 | 0 |
| 燈箱逐張對應原檔 | 0 筆不符 | 0 筆不符 |
| 焦點進出燈箱 | PASS | PASS |
| Console 錯誤 | 0 | 0 |

## 五、需人工執行（無法自動化）

`scripts/rsvp-to-sheet.gs` 是 Google Apps Script 專案的**鏡像**，部署到 GitHub Pages
不會更新線上 `/exec`。請將新版 `.gs`（`ENDPOINT_VERSION = 'v48'`、`SHARED_TOKEN`）
貼回 script.google.com 並重新部署，RSVP 的 token 驗證與重複 email 更新才會生效。
