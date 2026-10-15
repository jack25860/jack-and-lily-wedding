# v30：RSVP 送出流程改為「頁內提示 + 自動清空 + 寫入 Google 試算表」

版本：v30（由 v29 複製修改，**v29 及更早版本皆未更動**）
正式站：https://jack25860.github.io/jack-and-lily-wedding/
部署：沿用既有 `.github/workflows/deploy-site.yml`（`workflow_dispatch`，input `zip_url`），**未新增或修改任何 workflow**
本次部署 run：`37024036802`（Deploy wedding site，completed / success）

---

## 一、需求與對應實作

| # | 需求 | 實作 |
|---|---|---|
| 1 | 送出後**不跳轉新分頁** | 移除 `window.open(prefillURL, "_blank")`。改為在頁面上顯示滿版提示卡。 |
| 2 | 顯示「**感謝您的回覆**」提示 | 新增 `#rsvpThanks`（置於 `body` 層，`role="dialog"`、`aria-modal`、`aria-labelledby`）＋ `showThanks()`；酒紅底／金框／金色囍印，風格與全站一致。含「關閉」按鈕、點背景關閉、`Esc` 關閉、`body.thanks-open{overflow:hidden}`。 |
| 3 | 送出後**清空表單回預設狀態** | 新增 `resetRsvpForm()`：`form.reset()` 後將 `attend`／`side`／`relation` 回預設、人數欄位還原（大人 1／兒童 0／兒童椅 0）、狀態列清空、再呼叫 `syncNums()` 讓「出席人數」區塊回到預設可見且 `required`。 |
| 4 | 內容**寫入 Google 試算表** | 新增 `SHEET_WEBAPP_URL` 設定；送出時以 `XMLHttpRequest` POST（`Content-Type: text/plain;charset=utf-8`，避免 CORS preflight）將 JSON 送往 Apps Script Web App。 |
| 5 | **序號自動往下加一** | 由 Apps Script 端計算：`序號 = START_NO + (資料列數)`，第一筆為 1，之後 2、3、4…（以 `LockService` 保護，避免併發搶號）。 |
| 6 | 欄位順序依使用者提供之試算表架構 | 固定 10 欄：`序號 / 您的姓名 / 您的信箱 / 您是哪一方的賓客 / 與新人的關係 / 是否能出席本次盛宴 / 出席人數 / 出席大人人數 / 出席兒童人數 / 需要兒童椅數量`。 |
| 7 | 電子喜帖**維持僅手動寄送** | `initEcardShow()` 與 FormSubmit 寄送流程**完全未動**，不會自動寄送。 |

## 二、保留不變（已回歸驗證）
- 電子喜帖區塊：滿版大圖自動輪播（`.ecard-show`）不變。
- 選「不克出席」：`#rsvpNumWrap` 隱藏（`hidden`＋`display:none`）、三個 select `disabled`、資料不列入送出；選「出席」才顯示且 `required`。
- 電子喜帖寄信：FormSubmit → `jack25860@gmail.com`（`FORM_ENDPOINT`）不變。
- 風格：酒紅 `#6E1626`／金 `#C9A961`／宣紙米色不變。

## 三、送出時的資料流
```
[網站 RSVP 表單]
   ├─(1) FormSubmit 通知信 ──→ https://formsubmit.co/jack25860@gmail.com   ← 新人即時收到（含全部欄位，中文標籤）
   ├─(2) 無 CORS POST ──────→ SHEET_WEBAPP_URL（Apps Script /exec）        ← 逐筆寫入試算表、自動序號
   └─(3) 頁面顯示「感謝您的回覆」＋ 表單清空（不跳轉）
```
※ 若 `SHEET_WEBAPP_URL` 為空，第 (2) 步自動略過，其餘流程照常（不會壞掉）。

## 四、新增／修改檔案
| 檔案 | 動作 |
|---|---|
| `index.html` | 修改：RSVP 說明文字、按鈕文字與英文小標、CTA 提示文；新增 `#rsvpThanks` 提示卡（body 層） |
| `js/config.js` | 新增 `SHEET_WEBAPP_URL`（預設 `""`）、`RSVP_PREFILL_FORM`（預設 `false`）、`RSVP_THANKS_TITLE/TEXT/NOTE/CLOSE`；更新 `RSVP_INTRO`／`RSVP_BTN_TEXT`／`RSVP_CTA_HINT` |
| `js/app.js` | 新增 `resetRsvpForm()`／`showThanks()`／`hideThanks()`／`initRsvpThanks()`；送出流程改為「FormSubmit＋試算表 POST＋頁內提示＋清空」；`syncNums()` 增加 `display` 切換以確保清空時同步 |
| `css/styles.css` | 新增 `.rsvp-thanks` 系列樣式（含 `[hidden]`、keyframes、`prefers-reduced-motion`、≤640px 調整） |
| `scripts/rsvp-to-sheet.gs` | **新增**：Google Apps Script Web App（`doGet`／`doPost`），供使用者貼到試算表的 Apps Script |

## 五、需要使用者完成的一次性設定（約 5 分鐘）
1. 開試算表 → 「擴充功能」→「Apps Script」。
2. 貼上 `scripts/rsvp-to-sheet.gs` 全文並儲存。
3. 「部署」→「新增部署」→ 類型「網頁應用程式」→ 執行身分「我」、存取權「所有人」→ 部署並授權。
4. 複製 `/exec` 結尾的網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL`。
5. 重新部署網站。

（若尚未完成，網站其餘功能與 FormSubmit 通知信不受影響。）

## 六、線上實測結果（真實 Chromium，正式站）
| 項目 | 桌機 1440×900 | 行動版 390×844 |
|---|---|---|
| 送出後是否開啟新分頁／新視窗 | **否**（`new_tabs_opened: []`）✅ | **否** ✅ |
| 「感謝您的回覆」提示出現 | ✅ `#rsvpThanks.hidden=false` | ✅ |
| 姓名／信箱清空 | ✅ 空字串 | ✅ 空字串 |
| 出席／不克出席回預設 | ✅ 出席 | ✅ 出席 |
| 關係回預設 | ✅ 家人 | ✅ 家人 |
| 人數欄位回預設 | ✅ 1／0／0 | ✅ 1／0／0 |
| 「不克出席」切換 | ✅ `display:none`、三欄 `disabled` | ✅ 同 |
| 水平捲動（scrollWidth＝clientWidth） | 1440＝1440 ✅ | 390＝390 ✅ |
| 提示顯示時仍無水平溢出 | ✅ | ✅ |
| page errors | 0 ✅ | 0 ✅ |
| 外部端點實際呼叫 | FormSubmit ✅（`/jack25860@gmail.com`） | ✅ |
| 視覺複查 | 提示卡置中、金框完整、無破版 ✅ | ✅ |

> Console 僅 1 則 `requestStorageAccess: Permission denied.`（Chromium 在無痕式情境對第三方儲存權限的提示，非本頁程式錯誤，桌面與行動版皆同）。
