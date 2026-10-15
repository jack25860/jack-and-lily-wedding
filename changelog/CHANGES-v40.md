# v40 — Product Manager 最終驗證報告（電子喜帖寄信鏈路）

**日期**：2026-10-03
**角色**：Product Manager（接力第 4 棒，最終驗證）
**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**版本**：v40 由 v39 複製（v39 及更早版本皆未更動）

---

## 一、最終結論（一句話）

**寄信鏈路的程式碼已全部修好並上線（前端 v39 已生效），但「電子喜帖信件」目前仍無法寄達，唯一原因是 Google 端 Apps Script 專案尚未授予 Gmail 寄信權限（OAuth scope）且仍是舊版 v35 — 這是使用者必須手動完成的一次性動作，任何 agent 都無法代為授權。**

---

## 二、以真實瀏覽器實測的證據（本輪親自執行）

### 1. 線上 `/exec` 的實際回應（真實 Chromium fetch，非 curl）

```json
{
  "readable": true,
  "status": 200,
  "body": "{\"ok\":false,\"error\":\"Exception: The script does not have permission to perform that action. Required permissions: (https://mail.google.com/ || https://www.googleapis.com/auth/gmail.send || ...)\"}"
}
```

→ 後端**明確回報缺少 Gmail 寄信權限**，`GmailApp.sendEmail()` 拋例外，信件從未寄出。

### 2. 前端確實讀得到這個錯誤（v37 修法有效）

真實 Chromium 走完整 UI 流程（點「寄送喜帖邀請信」→ 輸入信箱 → 送出），狀態列顯示：

> **「電子喜帖功能尚未完成授權：請於 Apps Script 執行 testEcard 完成 Gmail 授權，並重新部署新版本後再試。」**

→ 前端**不再**把失敗誤判為成功（v36 以前的 `no-cors` 黑洞已完全移除，線上 `app.js` 中 `no-cors` 出現 0 次）。

### 3. 線上 Apps Script 版本仍是 v35

```
GET /exec        → "RSVP endpoint is running. v35"
GET /exec?diag=1 → "RSVP endpoint is running. v35"
```

→ repo 裡的 `scripts/rsvp-to-sheet.gs`（v39）只是版本控管副本；**部署到 GitHub Pages 不會更新 Google 端的 Apps Script 專案**。

### 4. 線上檔案與 v39 建置檔完全一致（部署無誤）

| 檔案 | 線上 md5 | v39 建置檔 md5 | 一致 |
|---|---|---|---|
| `js/app.js` | `6100e87b793cb979f88f5df7d1041a6e` | 同 | ✅ |
| `js/config.js` | `60d832e656a286ecb1b8c70bbce55f5b` | 同 | ✅ |
| `scripts/rsvp-to-sheet.gs` | `ENDPOINT_VERSION = 'v39'` | 同 | ✅ |

---

## 三、正式站回歸驗證（真實 Chromium，桌機 1440×900 ＋ 行動版 390×844）

**`verify-v40-live.py`：34 / 34 全數通過**

| 項目 | 桌機 | 行動版 |
|---|---|---|
| 無水平捲動 | ✅ | ✅ |
| 喜帖面板可開啟 | ✅ | ✅ |
| 送出後按鈕立即鎖定 | ✅ | ✅ |
| 確實 POST 到 /exec | ✅ | ✅ |
| 不跳轉新分頁 | ✅ | ✅ |
| 顯示最終狀態文字 | ✅ | ✅ |
| 前端可讀取 POST 回應（非 no-cors 黑洞） | ✅ | ✅ |
| 未授權時顯示明確授權提示 | ✅ | ✅ |
| RSVP 送出後立即鎖定 | ✅ | ✅ |
| RSVP 顯示「感謝您的回覆」 | ✅ | ✅ |
| RSVP 不跳轉新分頁 | ✅ | ✅ |
| RSVP 不寄送通知信（0 email 請求） | ✅ | ✅ |
| RSVP 表單已清空 | ✅ | ✅ |
| 不克出席：人數區塊隱藏 | ✅ | ✅ |
| 不克出席：人數欄位停用 | ✅ | ✅ |
| 無 console error | ✅ | ✅ |
| 無 pageerror | ✅ | ✅ |

**離線 harness `verify-v39-sheet.js`：63 / 63 通過**（含去重、diag 欄位、mailScope、videoPoster 絕對網址、lastEcard、RSVP 回歸、pool 142 張無重複且檔案皆存在）。

---

## 四、視覺驗證（線上截圖逐張複查）

| 檢查 | 結果 |
|---|---|
| 喜帖狀態訊息（紅字） | ✅ 正確顯示授權提示，文字完整無裁切 |
| 相簿「戰國」 | ✅ 黑甲冑＋紅披風＋竹林＋馬 — 分類正確 |
| 相簿「明朝」 | ✅ 大紅圓領袍＋鳳冠霞帔 — 分類正確 |
| 相簿三主題順序 | ✅ 戰國 → 唐代 → 明朝 |
| 桌機／行動版破版 | ✅ 無破版、無水平捲動、無文字裁切 |
| 風格色 | ✅ 酒紅 #6E1626／金 #C9A961／宣紙米色一致 |

**次要觀察（非本次回歸、非破版）**：行動版右下角的浮動按鈕（TOP／選單）在捲動至相簿底部時會輕微覆蓋最底一列照片。此為既有設計，不影響操作，且自動化測試確認**無水平捲動**。

---

## 五、相簿分類現況（v36 修正後，本輪複驗確認）

| 主題 | 張數 | 內容 |
|---|---|---|
| 戰國 WARRING STATES | **39** | zg1–zg6、n01–n08、n50–n74 |
| 唐代 TANG DYNASTY | **47** | tg1–tg6、n09–n49 |
| 明朝 MING DYNASTY | **56** | p01–p56 |
| **合計** | **142** | 與 `ECARD_PHOTO_POOL` 完全一致 |

---

## 六、⚠️ 唯一未達成項與使用者待辦（約 2 分鐘）

**未達成**：電子喜帖信件尚未能實際寄達（因為 Google 端未授權）。

**使用者需執行**：

1. 開啟回覆試算表 → 「**擴充功能**」→「**Apps Script**」
2. 貼上 `scripts/rsvp-to-sheet.gs`（v39）**全文**，儲存
3. 於編輯器選擇函式 **`testEcard`** → 執行 → 同意 **Gmail 寄信權限**
4. 「**部署**」→「**管理部署**」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
5. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL` 並重新部署網站

**驗證方式**：瀏覽器開 `/exec?diag=1`，出現 `"version":"v39"` 且 `"mailScope":true` 即完成；之後於網站送出喜帖，狀態列應顯示「電子喜帖已送出」。

---

## 七、維持不變（已回歸驗證）

酒紅 #6E1626／金 #C9A961／宣紙米色；RSVP 送出流程不變（立即提示→感謝您的回覆→清空表單→不跳轉→不寄通知信）；電子喜帖為手動寄送、信件內直接內嵌圖片與隨機婚紗照（142 張全池）；桌機與行動版皆不破版、無水平捲動。

---

## 八、本輪產出檔案

- `scripts/verify-v40-live.py`（正式站真實瀏覽器回歸，34/34）
- `scripts/pm-probe-ecard.py`（線上 /exec 寄信鏈路探測）
- `scripts/pm-shots.py`、`scripts/pm-shots2.py`（視覺驗證截圖）
- `documents/v40_ecard/`（截圖與 `live_results.json`）
