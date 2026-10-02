# v33 變更紀錄 — RSVP 表單正式接通 Google 試算表

- **版本**：v33（由 v32 複製；**v32 及更早版本皆未更動**）
- **正式站**：https://jack25860.github.io/jack-and-lily-wedding/
- **部署**：沿用既有 `.github/workflows/deploy-site.yml`（`workflow_dispatch`，input `zip_url`）— **未新增、未修改任何 workflow**
- **日期**：2026-10-02

---

## 一、本次唯一的功能變更

把使用者提供的 Apps Script Web App `/exec` 網址填入 `js/config.js` 的 `SHEET_WEBAPP_URL`：

```
SHEET_WEBAPP_URL:"https://script.google.com/macros/s/AKfycbwMfQ2N-fNLdvUdsdiXT-1y5vMUWUyBhUMtMmR3cQjscGHA3WkKoabYCVvkazPdiMfW/exec"
```

（v32 原本為空字串，前端因此顯示「回覆系統尚未設定完成」；設定後 RSVP 送出即實際寫入試算表。）

**除這一行之外，`index.html`、`js/app.js`、`css/styles.css` 與 v32 完全相同。** 與 repo `main` 的對照 diff 為空（僅此設定值不同），`css/styles.css` md5 與 repo 一致。

### 變更檔案
| 檔案 | 變更 |
|---|---|
| `js/config.js` | `SHEET_WEBAPP_URL` 由 `""` 填入 `/exec` 網址 |
| `scripts/verify-v33-live.py` | 新增（實測腳本） |
| `CHANGES-v33.md` | 新增（本檔） |

---

## 二、`/exec` 端點實測（真實 Chromium）

以真實 Chromium 直接開啟 `/exec`：

| 項目 | 結果 |
|---|---|
| HTTP 狀態 | **200** |
| 最終 URL | `https://script.googleusercontent.com/macros/echo?...`（Apps Script 正常執行並轉址） |
| 頁面內容 | **`RSVP endpoint is running.`** |
| 是否需授權 | **否**（即 `doGet` 正常，未出現 Google 登入／授權頁） |

結論：**Web App 部署成功且為公開可呼叫（執行身分「我」、存取權「所有人」）。**

---

## 三、正式站完整送出流程實測（真實 Chromium，桌機 1440×900 ＋ 行動版 390×844）

對 **正式站** 實測，共 3 個情境、**56 項檢查全數通過（0 失敗）**。

### 情境 1：桌機 · 出席
| 檢查 | 結果 |
|---|---|
| 不跳轉新分頁 | ✅ 0 個新分頁 |
| 不導頁（URL 不變） | ✅ |
| 送出後發出 email 請求 | ✅ **0 筆** |
| 送出時 POST 到試算表端點 | ✅ 1 筆（`script.google.com/.../exec`） |
| 顯示「感謝您的回覆」 | ✅ 文字正確 |
| 表單清空（姓名、信箱） | ✅ 皆空 |
| 回預設（出席 / 家人 / 大人1 / 兒童0 / 兒童椅0） | ✅ |
| 未顯示備援卡（成功路徑） | ✅ |
| 無水平捲動 | ✅ 1440 = 1440 |
| pageerror | ✅ 0 |

### 情境 2：行動版 · 出席 → 同上全部通過
無水平捲動（390 = 390）、感謝提示正常、表單清空、POST 成功。

### 情境 3：不克出席
| 檢查 | 結果 |
|---|---|
| 人數區塊隱藏 | ✅ `hidden=true`、`display:none` |
| 三個人數欄位全部 `disabled` | ✅ 大人／兒童／兒童椅 |
| 兒童椅整列隱藏 | ✅ |
| 送出後無 email 請求 | ✅ 0 筆 |
| 送出後 POST 到試算表 | ✅ |
| 顯示「感謝您的回覆」 | ✅ |
| 無新分頁 | ✅ |

### 電子喜帖（回歸，維持不變）
- 輪播元素仍在（3 張底圖 + 3 個圓點）
- 自動輪播持續前進（實測索引 0 → 1）
- 仍為**僅手動填寫寄送**，未自動寄送

---

## 四、試算表實際寫入驗證（直接讀取試算表）

以 Google Sheets API 直接讀取試算表，確認前端送出確實落表：

| 序號 | 您的姓名 | 您的信箱 | 您是哪一方的賓客 | 與新人的關係 | 是否能出席本次盛宴 | 出席人數 | 出席大人人數 | 出席兒童人數 | 需要兒童椅數量 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | |
| 2 | | | | | | | | | |
| 3 | QA自動測試-請忽略A | qa.v33.attend@example.com | 女方 | 朋友 | 出席 | 3 | 2 | 1 | 1 |
| 4 | QA自動測試-請忽略B | qa.v33.mobile@example.com | 男方 | 同事 | 出席 | 5 | 3 | 2 | 2 |
| 5 | QA自動測試-請忽略C | qa.v33.decline@example.com | 男方 | 親戚 | 不克出席 | 0 | *(空)* | *(空)* | *(空)* |

**關鍵驗證點**
- **欄位對應完全正確**：A→J 十欄依序為 序號／您的姓名／您的信箱／您是哪一方的賓客／與新人的關係／是否能出席本次盛宴／出席人數／出席大人人數／出席兒童人數／需要兒童椅數量。
- **序號自動遞增**：3 → 4 → 5（每筆 +1，由 Apps Script 以 `LockService` 取號，併發也不會重號）。
- **「不克出席」不列入人數**：序號 5 的出席大人人數／出席兒童人數／需要兒童椅數量**皆為空白**（非 0），與前端「隱藏／停用」規則一致；出席人數記 0。
- 註：第 1、2 列為**使用者原本就存在**的空白資料列（無任何內容），非本次測試產生，故保留未動。

### 測試資料清除
三筆自動測試資料（序號 3、4、5）已於測試完成後**自試算表刪除**，正式賓客名單未被污染；試算表現僅剩標題列與使用者原有的空白列 1、2。

---

## 五、正式站部署與檔案一致性

| 項目 | 結果 |
|---|---|
| 工作流程 | `deploy-site.yml` run **#51 completed / success** |
| Pages 發布 | `last-modified: Fri, 02 Oct 2026 15:46:43 GMT`（新版本已上線） |
| 線上 `js/config.js` md5 | 與 v33 建置檔**完全相同**（`25d0376eebe835289e1fc024c01c97e2`） |
| 線上 `js/app.js` / `css/styles.css` / `scripts/rsvp-to-sheet.gs` / 海報圖 | 全部 **HTTP 200** |
| 其他 agent 標記 | `films--hero`、`three-lives`、`ecard-show`、`rsvpFallback` **皆仍在**（未覆蓋他人成果） |

---

## 六、維持不變（已回歸驗證）
- 送出後**不跳轉新分頁**、顯示「感謝您的回覆」、表單清空回預設。
- **不寄送 RSVP 通知信**（送出時 0 筆 email 請求）。
- **電子喜帖仍為手動寄送**（`formsubmit.co/jack25860@gmail.com`，與 RSVP 流程互不相干）。
- 選「不克出席」時人數欄位隱藏／停用且不列入送出。
- 風格：酒紅 `#6E1626`／金 `#C9A961`／宣紙米色。
- 桌機與行動版**皆無破版、無水平捲動**（1440 = 1440、390 = 390）。

---

## 七、驗證腳本
- `scripts/verify-v33-live.py` — 對正式站的 Playwright 端到端實測（3 情境 × 桌機／行動版）。執行：`python3 scripts/verify-v33-live.py`
- 結果輸出：`documents/v33_rsvp_live/live_results.json`
