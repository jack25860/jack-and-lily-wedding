# CHANGES — v73（視覺與動效檢視優化，Technical Artist）

## 版本
- `site-version`：v72 → **v73**
- 依 TASK CONTINUATION 規則由 `site_v72` 複製為 `site_v73`，v72 及更早版本未更動。

## 一、精簡「貼心提醒」（依截圖標註：保留前 6 項，移除其餘）
移除下列 4 項提醒文字（原第 7～10 項）：
1. 每桌人數以該桌上限為準；若某桌填寫人數超過上限，超額賓客將由現場人員安排。
2. 查詢結果會顯示您這一組的「同行人數」（大人／兒童分項），與問卷填寫的人數一致。
3. 需要「兒童椅」的座位…該桌另於桌面圓環下方顯示「椅N」標籤…
4. 兒童椅一律以問卷「需要兒童椅數量」欄位為準…

保留前 6 項（輸入查詢、同名候選、金色閃爍、由現場安排、以現場為準、名單自動同步），逐字未動。

> 註：v71 已移除「椅N」文字標籤，故原第 9 項描述已過時，本次一併清除。兒童椅的視覺辨識（專屬色＋外環＋圖示＋圖例）與資料判定（僅依 childSeats）在頁面其餘處仍完整保留，功能不受影響。

## 二、查詢流程過場動畫（避免閃動／整頁刷新）
- 新增 `@keyframes seatFadeSlide`（opacity 0→1 + translateY 6px→0）。
- `.seat-suggest:not([hidden])`、`.seat-recent:not([hidden])` 顯示時淡入滑入（260/300ms，`var(--ease-soft)`）。
- 只對「容器」做過場，不對逐項 item 做動畫，避免連續鍵擊時重複淡入造成閃動。
- 結果卡沿用既有 `seatRcIn` 淡入；座位圖整團金色呼吸閃爍（seatBreath）維持不變。
- `prefers-reduced-motion: reduce` 下停用新增過場動畫。

## 三、視覺微調（輕量，供 UI Designer 接續收尾）
- 未更動色票／字級／間距 token（金色 accent、酒紅主色、卡片陰影均沿用）。
- 查詢流程已為「純前端狀態切換、無整頁刷新」，動畫過場與既有的 silky-no-flash 基調一致。

## 四、UI/UX 收尾（UI Designer 接棒）
- 「貼心提醒」卡改為與 hero／座位圖一致的標題層級：金色英文小標 `Good to Know`（`--en-caps`、字距 .42em）＋米白中文主標＋金色漸層分隔線。
- 卡片加入「金色角標」母題（左上／右下 `::before`／`::after`），沿用查詢卡與座位圖框的視覺語言，強化區塊一致性；手機版（`max-width:768px`）隱藏角標避免貼邊。
- 卡片內距由 `clamp(24px,3.4vw,38px)` 提升至 `clamp(26px,3.6vw,42px)`，清單上距由 18px → 20px，改善呼吸感。
- 未動任何色票／字級／間距 token，未新增功能、未重新設計。

## 五、驗證結論（本次實測，非目測）
- **無閃動**：於真實 Chromium 逐步輸入 `TEST`，即時建議清單只在「顯示那一刻」播一次過場——連續鍵擊取樣的 opacity 為 0 → 0.046 → 0.58 → 0.94 → 1.0，**不重播、不閃爍**；穩定後 600ms 再取樣仍為 1.0，`animationName` 恆為 `seatFadeSlide`。
- **不整頁刷新**：查詢前在 window 上種下標記，送出表單後標記仍在（`sameDocument: true`），且全程 `console.error` 為 0 筆。
- **提醒筆數**：`seat-notes__list > li` = **6 筆**（本機四寬度與線上皆然）。
- **版面**：360／390／768／1440 四寬度 `scrollWidth <= clientWidth + 1`，**無水平溢位**；16 桌／162 座位齊備。
- **整團高亮仍正確**：線上查詢 `TEST` → 座位 6～9 全數金色（`rgb(201,169,97)`）＋ `seatBreath` 閃爍。
- **線上與本機位元一致**：`seating.html`／`css/seating.css`／`js/seating.js` 三檔 live md5 全數 MATCH（HTTP 200）。
- **部署**：workflow run **#86** `Deploy wedding site` → success；Pages build **#105** → success；線版標 `site-version = v73`。

## 變更檔案
- `seating.html`（版本標記 v73、移除提醒 4 項、提醒卡 eyebrow／分隔線）
- `css/seating.css`（查詢流程過場動畫、提醒卡角標與標題層級）
- `CHANGES-v73.md`（新增）
