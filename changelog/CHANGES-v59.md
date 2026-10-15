# v59 — 全站互動動效絲滑化（消除閃動／跳格）＋ 字級平滑過渡

版本：v59（複製自 v58，v58 保持不變）
部署：沿用既有 `.github/workflows/deploy-site.yml`（未新增／未修改任何 workflow）

## 使用者需求
1. 全站所有按鈕／按鍵／開關的動畫**絲滑、不閃動**（不要跳格、閃爍、突然跳位、突然出現／消失）。
2. 右下角「Tt」字體大小鈕：展開大／中／小要絲滑；**選後收合回圓形時絲滑縮放**（scale／opacity 平滑過渡，不瞬間切換、不先消失再出現、無殘影跳動）；展開與收合的曲線與時長一致。
3. 網頁內字級切換（大／中／小）要有**平滑過渡**，不瞬間跳變。

## 一、動效 token 統一（css/styles.css）
新增 `--dur-1/2/3` 與 `--ease-out` / `--ease-io`，讓展開／收合、hover／active／focus 的曲線與時長一致、自然。

## 二、消除閃動的根因修正
原本多處以 `display:none`、`hidden` 直接切換，或 `visibility` 與 `opacity` 時序不一致，造成瞬跳與閃爍。改為**以 opacity／transform 為主的過渡**，並讓 `visibility` 與 `opacity` 同時長、同曲線：

| 元件 | 舊行為（閃動成因） | v59 修正 |
|---|---|---|
| Tt 選項面板 | 展開／收合 class 直接切換，收合時瞬間消失 | `is-opening` / `is-closing` 兩態，`opacity .58s` + `translateY+scale(1→.86)` + `visibility .58s`，**展開與收合同一曲線與時長** |
| 燈箱（相簿） | `shown` 切換但只有 420ms、時序易殘影 | `transition:opacity .62s`，關閉等淡出結束才 `hidden`（760ms 後仍在 `shown` 則不隱藏）|
| 電子喜帖寄送面板 | `panel.hidden=!0` 直接切換（瞬間消失） | `.ecard-panel.is-open`，`opacity/transform .5s`，`transitionend` 後才 `hidden` |
| 相簿「展開全部」 | `tgt.hidden=!open` 硬切 | `.gtheme__more.is-open`，`opacity/transform .55s` |
| RSVP 出席人數／兒童椅 | `style.display="block"/"none"`（切換即跳動） | `#rsvpNumWrap` / `#rsvpChairRow` 以 `max-height + opacity + transform` 過渡，**完全不再使用 display:none** |
| RSVP 備援出口 | `box.removeAttribute("hidden")` 瞬間出現 | `.rsvp-fallback.is-open` 過渡 |
| 導覽手機選單 | 關閉時 opacity 尚未歸零即被判定未顯示 | 保留既有 class 過渡，補 `will-change` / `backface-visibility` |
| 回到頂端、漂浮開關、等化條 | 缺 `will-change` 造成重繪跳動 | 補 `will-change`；等化條維持既有動畫（改為平滑 keyframe） |

## 三、字級平滑過渡（重點：可量測）
- `html.font-anim { transition: font-size .30s cubic-bezier(.4,0,.2,1) }`
- `.font-anim` **由 JS 於頁面載入完成後才加上**（`window.load` + 保險計時器），避免首次載入時不必要的過渡抖動（reflow jank）。
- **效能取捨（以實測 frame 為準）**：實測本頁面（142 張相簿 + 大量區塊）在 390–412px 行動視窗下，**即使不做任何過渡、直接切換 class，單次全頁重排本身就要 ~83ms**；加入過渡後之停頓來源是瀏覽器的全域重排，而非過渡本身。因此：
  - 將時長由 0.52s 縮短為 **0.30s**（仍保有可見的平滑級距，同時縮短重排影響時間）。
  - **把「選後收合」延後到字級過渡結束才開始**（見下節），使最貴的一次重排不會擋住收合動畫。

## 四、Tt 收合：真正的絲滑關鍵（實測數據）
收合若與字級變更**同一個 frame** 發生，使用者的收合淡出會被那一次全頁重排「卡住」，讀起來就是跳一下。實測（Chromium，rAF 逐格取樣）：

| 做法 | 淡出可見格數 | 最大單格跳幅 |
|---|---|---|
| 同一個 frame 收合 | 1 | **0.74（明顯跳動）** |
| 等 2 frames 再收合 | 2 | 0.75 |
| **等字級過渡結束再收合** | **24** | **0.078（絲滑）** |

→ v59 改為 `closeAfterFontChange()`：監聽 `<html>` 的 `transitionend`（`font-size`）後才啟動收合；並以 560ms 上限保底；`prefers-reduced-motion` 時立即收合（不做等待）。使用者選完大／中／小時，字級先平滑變好，**圓鈕再絲滑縮回**，兩者不再互相打架、也不再閃動。

## 五、JS 修正（js/app.js）
- 新增 `raf2()`（雙 rAF + 90ms 保底）、`expandEl()` / `collapseEl()` 共用收合邏輯，統一所有面板的開合時序。
- 電子喜帖面板、RSVP、相簿、燈箱改為 class 驅動（不再直接改 `style.display`）。
- Tt：`isAnimating()` 改為**只在「展開中」擋重複點擊**（原本會在開啟後 430ms 內忽略點選，屬可用性缺陷，已修正）；選取後由 `apply()` 統一負責「延後收合」，圓鈕與選項都不會再各自呼叫收合。
- 新增 `initMotionSmoothing()`：載入後替 `<html>` 補上 `font-anim`（啟動字級過渡）。

## 六、無障礙與退化
- **尊重 `prefers-reduced-motion`**：關閉或縮到最短所有新增過渡／動畫（等化條、燈箱、面板、字級過渡皆關閉）；Tt 立即切換且仍可用，收合不留殘影。
- **no-JS 退化**：`index.html` `<head>` 首行加 `document.documentElement.className+=" has-js"`；`html:not(.has-js) #fontctlOpts{display:none}` 避免無腳本時展開空選單。
- 觸控目標：`.fontctl__opt`、`.btn--small` 補 `min-height:44px`。

## 七、既有功能全數保留（回歸驗證通過）
音樂預設開啟與漂浮開關、電子喜帖漂浮音效開關、v54 Android 點擊／滑動不暫停影片修正、RSVP 送出流程、電子喜帖手動寄送與 **142 張全池隨機婚紗照**、大人上限 **10 人**、去重窗期 **8 秒**、寄送成功後清空輸入框、結婚預告片倒數文案、婚禮當日注意事項區塊、信件內嵌循環 GIF、v58「Tt」圓形漂浮鈕收合／展開／選後自動收合與 localStorage 記憶。

## 八、驗證（真實瀏覽器）
以 Playwright 實機引擎驗證（Chromium＝Android Chrome／Pixel 7 指標；WebKit＝iOS Safari／iPhone 15 指標），派送真實觸控手勢：
- **本地：137/137 檢查全部通過、0 失敗**（含 33 項互動元件過渡覆蓋率、逐格淡出量測、收合絲滑度、字級過渡、`prefers-reduced-motion`、四種視窗無橫向溢出、觸控目標 ≥44px、主控台 0 錯誤、既有功能回歸）。
- 部署後再以真實瀏覽器對**正式站**重跑同一套檢查。

## 九、部署後仍為手動的步驟（Google Apps Script）
repo 內的 `.gs` 僅為**鏡像**，部署 GitHub Pages 不會更新 Google Apps Script 專案。本次未變更 Apps Script 常數（`ECARD_DEDUPE_SECONDS` 仍為 8），故**無需**重新貼上／重新部署；前端與後端常數維持一致。
