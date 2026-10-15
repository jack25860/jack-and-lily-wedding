# v29 變更紀錄 — RSVP「出席人數」區塊版面修正

> 由 v28 複製為 v29 後修改；**v28 及更早版本未更動**。
> 部署：GitHub Pages（repo `jack25860/jack-and-lily-wedding`，main）

## 使用者回報的兩個問題
1. 「需要兒童椅數量」欄位沒有與左側（大人／小孩）欄位切齊。
2. 標題「出席人數」被底色切一半。

## 根因
- 原 `#rsvpNumWrap` 是 `<fieldset>`，`<legend>` 為 fieldset 的 flex 子項，因此標題被排在**白色方框內部**、與方框上緣齊平；方框的 `background:#ffffff94` 與 `border` 從標題處開始，視覺上就像標題被底色切過。
- 三個人數欄位放在 `grid-template-columns:repeat(3,1fr)` 的 3 欄格線中；「需要兒童椅數量」標籤較長會換行，使該欄高度增加，選單被往下推，與上方兩欄的選單不在同一水平線，看起來就沒有切齊。

## 修改內容（2 檔）

| 檔案 | 變更 |
|---|---|
| `index.html` | 將 `#rsvpNumWrap` 由 `<fieldset>` 改為 `<div>`；標題改為 `<p class="rsvp-nums__title">出席人數 <i>GUESTS</i></p>`，**移到白色方框之外、方框上方**；新增 `<div class="rsvp-nums__box">` 包住說明文字與三個人數欄位，白底／金框只套用在方框上 |
| `css/styles.css` | ① 新增 `.rsvp-nums__title`（標題樣式，與其他欄位標籤一致）與 `.rsvp-nums__box`（原本的白底＋金框＋內距）；② `.rsvp-nums` 改為 `display:block`；③ `.rsvp-nums__grid` 由 3 欄改為 **2 欄**，並加 `.rsvp-nums__grid>#rsvpChairRow{grid-column:1}`，讓「需要兒童椅數量」落在**第一欄（左緣與大人欄切齊）**、寬度與上方欄位一致 |

## 維持不變（已回歸驗證）
- 選「不克出席」→ 人數欄位整組隱藏／停用且不列入送出；選「出席」→ 顯示並必填。
- 送出流程與 Google 表單 prefill 同步正常（FormSubmit 寄至 `jack25860@gmail.com`）。
- 風格酒紅 `#6E1626` / 金 `#C9A961` / 宣紙米色不變；桌機與行動版皆不破版、無水平捲動。

## 線上實測（真實 Chromium）
| 項目 | 桌機 1147 | 桌機 1440 | 行動版 390 |
|---|---|---|---|
| 大人／兒童／兒童椅 選單左緣 x | 280.5 / 584.5 / **280.5** ✅ | 427 / 731 / **427** ✅ | 69.6 / 69.6 / 69.6 ✅ |
| 三欄寬度 | 282 / 282 / 282 ✅ | 282 / 282 / 282 ✅ | 250.8 全寬 ✅ |
| 標題在方框外（title.bottom < box.top） | 1008.9 < 1028.9 ✅ | 1043.2 < 1063.2 ✅ | 1255.9 < 1275.9 ✅ |
| 水平溢出 | 1147 = 1147 ✅ | 1440 = 1440 ✅ | 390 = 390 ✅ |
| Console / pageerror | 0 / 0 ✅ | 0 / 0 ✅ | 0 / 0 ✅ |

切換實測：預設「出席」→ 顯示且三欄 enabled+required；點「不克出席」→ `hidden=true`、`display:none`、三欄 disabled；再點「出席」→ 全部還原。
送出實測：出席路徑 prefill 帶入 8 欄位（含 ADULTS=2／CHILDREN=1／CHAIRS=1）；不克出席路徑僅 5 欄位，人數欄位不存在。
