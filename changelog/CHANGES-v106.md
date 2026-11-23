# CHANGES v106 — RSVP 表單新增手機號碼、信箱改為選填

**基準版本**：v105（`<meta name="site-version" content="v105">`）

## 需求
1. 出席表單（RSVP）新增「手機號碼」欄位。
2. 「信箱」改為選填，移除必填驗證與必填標記，未填不可阻擋送出。
3. Google 試算表同步：新增手機號碼欄位，信箱可留空寫入且不錯位。

## 修改檔案
| 檔案 | 修改內容 |
| --- | --- |
| `index.html` | 新增 `#rsvpPhone`（`type=tel`、`inputmode=tel`、`pattern`、`maxlength=20`、格式提示）；`#rsvpEmail` 移除 `required`、標記「（選填）」；`site-version` → v106 |
| `js/app.js` | 送出驗證：姓名仍必填；信箱改為「有填才驗格式」；新增手機格式驗證（`^[0-9+\-\s()]{6,20}$`，可留空）；payload 新增 `phone` |
| `css/styles.css` | `input[type=tel]` 沿用既有輸入框樣式；新增 `.rsvp-form__opt`（選填標記）與 `.rsvp-form__hint`（格式提示） |
| `scripts/rsvp-to-sheet.gs` | `ENDPOINT_VERSION` → v49；新增 `PHONE_HEADER`／`PHONE_COL=12`／`SEAT_COL=11`／`ROW_WIDTH=12`；`mapFields_` 對應 `phone`；`buildRow_` 寫入 L 欄、K 欄留空；`updateExistingRow_` 保留人工維護的 K 欄（桌次）只更新 L 欄；`ensureHeader_` 補 L1 表頭 |

## 欄位對應（避免錯位）
| 欄 | A | B | C | D | E | F | G | H | I | J | K | L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 表頭 | 序號 | 您的姓名 | 您的信箱 | 您是哪一方的賓客 | 與新人的關係 | 是否能出席本次盛宴 | 出席人數 | 出席大人人數 | 出席兒童人數 | 需要兒童椅數量 | 桌次（人工） | 手機號碼（v106 新增） |

- 手機號碼固定寫入 **L 欄**，不插入中間欄位，既有 A–K 資料完全不位移。
- **K 欄「桌次」為人工維護**，程式寫入時一律保留原值、不覆蓋。
- 信箱留空時寫入空字串，仍佔用 C 欄，後續欄位不會左移。

## 驗證
- 桌機 1440×900／手機 390×844 實際瀏覽器操作：手機可填寫、信箱留空可送出、必填提示正確、無水平溢位、無 JS error。
- 實際寫入 Google 試算表確認欄位對應。
