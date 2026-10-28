# v99 — 結婚預告片發佈日期調整為 12.01

## 變更緣由
結婚預告片（trailer）的發佈日期由 11.01 調整為 12.01（2026-12-01）。
婚禮日期 2027-04-17 維持不變。

## 全站盤點清單（修改前）
| # | 檔案 | 位置 | 修改前 | 修改後 |
|---|------|------|--------|--------|
| 1 | `index.html` | L583 `.trailer__tag` 靜態文字 | `即將上映 · 11.01` | `即將上映 · 12.01` |
| 2 | `js/config.js` | `TRAILER_RELEASE_DATE` | `2026-11-01` | `2026-12-01` |
| 3 | `js/config.js` | `TRAILER_CAPTION`（影片佔位文字） | `我們的故事，即將上映 —— 11 月 1 日，與您相見。` | `我們的故事，將於初冬與您相見。` |
| 4 | `js/config.js` | `TRAILER_COUNT_EN` | `COMING SOON` | `AWAY` |
| 5 | `js/app.js` | `initTrailerRelease()` 倒數輸出 | `COMING SOON — N DAYS` | `N DAYS AWAY`（並加 `Math.max(0, …)` 防負數） |
| 6 | `index.html` | `<meta name="site-version">` | `v98` | `v99` |

## 未變動（已確認）
- `WEDDING_DATE` = `2027-04-17`（婚禮倒數計時目標不變）
- `ecard-video.html` 的 `2027.04.17 · 饗婚婚宴館`（婚禮日期，非預告片日期）
- `ecard-email-preview.html`、`seating.html`、`sitemap.xml`、`robots.txt`：無預告片日期
- 所有 CSS：無日期字串（僅有 `.trailer__*` 樣式選擇器）

## 文案設計說明
- 日期只在一處以數字呈現（`.trailer__tag`：`即將上映 · 12.01`），沿用站上既有的 `MM.DD` 寫法。
- 影片佔位文字不再重述日期，改以「初冬」含蓄指涉 12 月，避免同一件事在多處重複。
- 倒數行只保留剩餘天數（`41 DAYS AWAY`），與 tag 的「即將上映」語意互補而非重複。
- 未使用「延期／延後」等字眼。

## 倒數邏輯
- 目標時間：`2026-12-01 00:00`（本地時區），以當日 00:00 為基準計算剩餘天數。
- 已加 `Math.max(0, …)`，即使日期已過也不會出現負數；日期已過時改顯示 `TRAILER_RELEASED_LABEL`（已上映）並隱藏倒數行。
