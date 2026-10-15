# v32 變更紀錄 — RSVP 送出「真正可用」：失敗不再卡死 + 備援出口

**版本**：v32（由 v31 複製；v31 及更早版本皆未更動）
**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**部署**：沿用既有 `deploy-site.yml`（`workflow_dispatch`，input `zip_url`），未新增或修改任何 workflow

---

## 一、問題根因

v31 表單送出時，若 `SHEET_WEBAPP_URL` 為空（Apps Script Web App 尚未部署），前端只顯示
「回覆系統尚未設定完成，請稍後再試，或直接與新人聯繫。」**然後就結束**——表單仍留在畫面上，
但賓客沒有任何可完成的出口，等於填完卻送不出去。

**根因確認**：靜態網頁（GitHub Pages）沒有後端，`SHEET_WEBAPP_URL` 又尚未填入，因此沒有可寫入的端點。

### 關於「自動建立並部署 Apps Script Web App」

已完整搜尋可用能力：

| 途徑 | 結果 |
|---|---|
| Google 憑證／已連接帳號 | ✅ 已連接 Gmail、Google Docs、Google Drive、**Google Sheets** |
| Composio 目錄搜尋 `google apps script` | ❌ 無此整合（`no_match`） |
| Composio 目錄搜尋 `script automation deploy` | ❌ 無此整合（`no_match`） |
| Google Sheets 工具（50 個） | 僅能讀寫試算表**內容**，無 Apps Script 專案／部署 API |
| Google Drive 工具（92 個） | 可建立／匯出檔案，**無 Apps Script 部署 API** |

**結論：Apps Script Web App 的建立與部署無法以程式自動完成**（Apps Script 的 Deployment API
不在可用工具範圍內，且它需要 OAuth 授權範圍 `script.deployments` 與使用者互動授權）。
因此改為：**把需要使用者做的部分壓到最低（約 2 分鐘、6 個步驟），並讓前端在完成設定前也能正常運作。**

---

## 二、需求與實作

| # | 需求 | 實作 |
|---|---|---|
| 1 | 檢查可用憑證／能否自動部署 | 已完整檢查（見上表）；明確回報**卡在「無 Apps Script 部署 API」**這一步 |
| 2 | 提供最精簡、不易出錯的設定指引 | `scripts/rsvp-to-sheet.gs` **已預先帶入試算表 ID**，使用者只需「貼上 → 部署 → 複製 /exec 網址 → 填入 config」（見第四節） |
| 3 | **改善前端體驗**：未設定或寫入失敗時，**不清空**、顯示明確錯誤、提供**備援出口** | 新增 `#rsvpFallback` 區塊與三種備援；送出成功才清空 |
| 4 | 維持不變 | 不跳轉新分頁、成功顯示「感謝您的回覆」、不寄 RSVP 通知信、電子喜帖仍為手動寄送、酒紅／金／宣紙米色、不克出席人數隱藏且不列入送出、桌機與行動版不破版 |

### 前端送出流程（v32）

```
[送出]
  ├─ 驗證姓名／信箱／（出席時）大人人數
  │      └─ 不通過 → 紅框錯誤，不送出、不清空
  ├─ SHEET_WEBAPP_URL 為空
  │      └─ 顯示「回覆系統尚未設定完成，您的內容已保留。」＋ 備援三出口，不清空
  ├─ POST 到 Apps Script（fetch no-cors，text/plain 避免 CORS preflight）
  │      ├─ resolve → 清空表單回預設 ＋ 顯示「感謝您的回覆」＋ 隱藏備援
  │      └─ reject  → 顯示「回覆送出失敗，您的內容已保留。」＋ 備援三出口，不清空
  └─ 全程不跳轉新分頁、不寄任何 email
```

### 三種備援出口（都帶著已填好的內容）

| 備援 | 行為 |
|---|---|
| **用 Google 表單回覆** | 以 `usp=pp_url` + `entry.xxx` prefill 組出連結（沿用既有 `RSVP_ENTRY_IDS`），新分頁開啟時**所有欄位已預填** |
| **複製回覆內容** | 一鍵複製「姓名／信箱／男方女方／關係／是否出席／人數」純文字，可貼到 LINE 或訊息 |
| **用 Email 寄送** | `mailto:jack25860@gmail.com` 帶入主旨與完整內容 |

> 選「不克出席」時，備援內容與 prefill **不包含**大人／兒童／兒童椅（與主流程規則一致）。

---

## 三、本機驗證（真實 Chromium）

### `scripts/verify-v32-sheet.js`（Apps Script 寫入邏輯，18 項全通過）
以 stub 取代 `SpreadsheetApp` / `LockService` / `ContentService` 載入 `.gs` 後連續呼叫 `doPost`：

| 送出 | 寫入結果 |
|---|---|
| 出席（2 大 1 小 1 椅） | 序號 **1**，出席人數 3，大人 2／兒童 1／椅 1 ✅ |
| 不克出席 | 序號 **2**，大人／兒童／椅皆**留空**、出席人數 0 ✅ |
| 出席（3 大 2 小 2 椅） | 序號 **3**，出席人數 5，大人 3／兒童 2／椅 2 ✅ |

### `scripts/verify-v32.py`（端到端流程，53 項全通過）
以本機伺服器提供完整站台，Playwright 真實操作：

| 群組 | 驗證重點 | 結果 |
|---|---|---|
| **A 成功路徑**（攔截 `config.js` 注入端點） | 不跳轉、感謝提示、表單清空回預設、端點收到 1 筆 POST、payload 欄位正確、**0 email 請求** | 19/19 ✅ |
| **B 失敗路徑**（端點為空） | 不跳轉、**不顯示感謝卡**、`is-err` 明確錯誤、姓名／信箱／人數**完整保留**、prefill 與 mailto 內容正確、複製成功、**0 email 請求** | 20/20 ✅ |
| **C 不克出席** | 人數區塊隱藏、三 select 全 disabled、備援內容與 prefill 皆不含人數 | 7/7 ✅ |
| **D 行動版 390×844** | 不跳轉、備援顯示、內容保留、**水平溢出 0**、按鈕不溢出容器 | 7/7 ✅ |

---

## 四、需要使用者完成的一次性設定（約 2 分鐘）

> ⚠️ **完成以下設定前，表單仍無法寫入試算表**（但已不會讓賓客卡住，會引導到備援出口）。
> 設定完成後，送出即直接寫入試算表，且不會再顯示備援區塊。

1. 開啟回覆試算表 → 上方選單「**擴充功能 (Extensions)**」→「**Apps Script**」
2. 刪除編輯器預設內容，貼上 `scripts/rsvp-to-sheet.gs` **全文**，按 💾 儲存
   （腳本內 `SPREADSHEET_ID` 已預設為你的試算表 ID，不需修改）
3. 右上「**部署 (Deploy)**」→「**新增部署**」→ 類型「**網頁應用程式**」
   · 執行身分「**我 (Me)**」 · 存取權「**所有人 (Anyone)**」→ 部署 → 完成授權
4. 複製結尾為 **`/exec`** 的網址（`https://script.google.com/macros/s/…/exec`，**不是** `/dev`）
5. 開啟 `js/config.js`，填入：
   `SHEET_WEBAPP_URL:"https://script.google.com/macros/s/…/exec",`
6. 重新部署網站即生效

**驗證**：瀏覽器直接開該 `/exec` 網址，出現「**RSVP endpoint is running.**」即部署成功。

---

## 五、變更檔案

| 檔案 | 動作 |
|---|---|
| `js/app.js` | 改：新增 `postRow()` / `showFallback()` / `hideFallback()` / `rsvpPrefill()` / `rsvpMailto()` / `copyText()` / `setRsvpStatus()`；送出流程改為 Promise，失敗不清空 |
| `js/config.js` | 改：新增 `RSVP_FALLBACK_*`、`RSVP_ERR_*`、`RSVP_MAIL_TO` |
| `index.html` | 改：新增 `#rsvpFallback` 備援區塊 |
| `css/styles.css` | 改：新增 `.rsvp-form__status.is-err` 與 `.rsvp-fallback*` 樣式 |
| `scripts/rsvp-to-sheet.gs` | 改：`SPREADSHEET_ID` 預先帶入目標試算表 ID |
| `scripts/verify-v32-sheet.js`、`scripts/verify-v32.py` | 新增：驗證腳本 |
