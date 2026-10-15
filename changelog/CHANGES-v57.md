# v57 變更紀錄 — 結婚網站：新增「字體大小調整」漂浮按鈕（大／中／小）

**日期**：2026-10-05
**版本**：v57（由 v56 複製後修改；v56 及更早版本保持不變）
**部署**：沿用既有 `.github/workflows/deploy-site.yml`（未新增、未修改 workflow）

---

## 使用者需求

在結婚網站（`index.html`）右下角的「聲音漂浮開關」**上方一點的位置**，新增一個「字體大小調整」按鈕，提供**大／中／小三檔**，可切換整個網頁的字體大小，方便長者觀看。

## 本次變更

### 1. 新增漂浮「字體大小調整」控制（`index.html`）

- 於既有 `.music`（背景音樂漂浮開關）**正上方**新增 `.fontctl` 區塊，內含三顆分段按鈕：**小 / 中 / 大**。
- 預設檔位為**中**（`aria-pressed="true"` 於「中」）。
- 具 `role="group"` 與 `aria-label="字體大小調整"`，每顆按鈕有 `aria-label`（小字／中字／大字）與 `aria-pressed` 狀態。

### 2. 全站字級縮放（`css/styles.css`）

- 以 `html` 根字級統一縮放全站（所有 `rem` 與 `clamp(...rem...)` 皆隨之縮放）：
  - `html.font-scale-sm{font-size:87.5%}`（小）
  - `html.font-scale-md{font-size:100%}`（中，預設）
  - `html.font-scale-lg{font-size:118.75%}`（大）
- 標題、內文、按鈕、表單、倒數、注意事項等區塊皆一致縮放（皆使用 rem/clamp 相對單位）。
- `.fontctl` 樣式沿用既有漂浮開關視覺：酒紅 `#6E1626`／金 `#C9A961`／宣紙米色、膠囊形、`backdrop-filter` 毛玻璃、hover／`aria-pressed` 選中狀態、`focus-visible` 外框。
- 觸控目標 `min-height:44px`，符合行動裝置可點擊尺寸。
- 列印樣式新增 `.fontctl` 隱藏（與 `.music` 一致）。

### 3. 行為與記憶（`js/app.js`）

- 新增 `initFontScale()`，並於 `boot()` 中在 `initMusic()` 之後呼叫。
- 點擊任一檔位即切換 `html` 的 `font-scale-*` class，並更新 `aria-pressed`。
- 選擇以 `localStorage`（key：`ssss-wedding-font-scale`）記住，重新載入後保持；**預設值不受舊資料影響**（僅接受 `sm`/`md`/`lg`，其餘一律回退為 `md`）。
- **動態定位**：以 `getBoundingClientRect()` 量測 `.music` 實際高度，將 `.fontctl` 的 `bottom` 設為「音樂開關頂端 + 10px」，確保**緊鄰且不重疊**；並於 `resize`／`orientationchange`／`load` 及 `ResizeObserver` 時重新定位（音樂按鈕在窄螢幕會變高，故需動態量測）。

---

## 維持不變（完整保留既有功能）

- 背景音樂**預設開啟**與右下角漂浮開關（`.music`）。
- 電子喜帖漂浮音效開關。
- v54 Android 點擊／滑動不暫停影片修正。
- RSVP 送出流程（`postRow` → Apps Script）。
- 電子喜帖手動寄送與 **142 張全池隨機婚紗照**。
- 大人上限 **10 人**、去重窗期 **8 秒**、寄送成功後**清空輸入框**。
- 結婚預告片倒數文案。
- 婚禮當日注意事項區塊。
- 信件內嵌循環 GIF 呈現方式（v56 HD GIF）。

## 網站端

- `index.html`、`css/styles.css`、`js/app.js` 為本次變更檔案；`ecard-video.html`、`js/config.js`、`scripts/*`、`media/*`、`images/*` **未變更**。
- v56 的電子喜帖 HD GIF 與可點擊觀看提示**完整保留**。

## ⚠️ 使用者需手動完成的步驟

- 本次**無** Apps Script 後端變更，無需重新部署 Apps Script。
