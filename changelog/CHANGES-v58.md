# v58 變更紀錄 — 婚禮網站：字體大小按鈕改為「Tt」圓形漂浮鈕（平常收合、點擊展開、選後自動收合）

**日期**：2026-10-06
**版本**：v58（由 v57 複製後修改；v57 及更早版本保持不變）
**部署**：沿用既有 `.github/workflows/deploy-site.yml`（未新增、未修改 workflow）

---

## 使用者需求

目前右下角的「大／中／小」三檔選項是**常駐展開**的。請改成：

- **平常收起來**，只顯示一個**圓形漂浮按鈕**，上面顯示「**Tt**」字樣。
- 點一下這個圓形鈕，才**展開**顯示「大／中／小」三檔選項。
- 使用者**選擇完成後（點選任一檔位），選項要自動收合**，變回原本那個「Tt」圓形漂浮鈕。

## 本次變更

### 1. 控制項結構（`index.html`）

- `.fontctl` 由「常駐展開的三檔膠囊」改為：
  - `.fontctl__toggle`（`#fontctlToggle`）：**圓形漂浮鈕**，內含 `<span class="fontctl__tt">Tt</span>`；具 `aria-expanded`、`aria-controls="fontctlOpts"`、`aria-label`。
  - `.fontctl__opts`（`#fontctlOpts`）：三檔選項容器，`role="group"`、`aria-label="字體大小調整"`，預設 `hidden`（由 JS 於初始化時解除，避免無 JS 時永久隱藏）。
- 容器 `.fontctl` 以 `data-open="false"` 表示收合態。

### 2. 樣式（`css/styles.css`）

- **收合態**：單一圓形按鈕（50px，行動裝置 48px），酒紅 `#6E1626`／金 `#C9A961`／宣紙米色、`backdrop-filter` 毛玻璃質感，觸控目標 ≥44px。
- **展開態**：`.fontctl__opts` 絕對定位於圓形鈕**正上方**（`bottom:calc(100% + 10px)`、`right:0`），膠囊外觀與既有聲音漂浮開關一致；以 `opacity`／`transform`（`translateY(8px) scale(.94)` → `none`）淡入放大，`transform-origin:100% 100%` 由右下角自然展開，動畫自然不突兀。
- 選中檔位以**酒紅底＋金框**高亮（`aria-pressed="true"`），並保留 `focus-visible` 外框。
- 展開時圓形鈕本身轉為酒紅底＋金框，作為開啟狀態提示。
- `prefers-reduced-motion` 時關閉展開動畫。
- 列印樣式沿用 `.fontctl{display:none}`。

### 3. 行為與記憶（`js/app.js`）

- 改寫 `initFontScale()`：
  - 點「Tt」→ 展開；再點 → 收合（`aria-expanded` 同步）。
  - **點任一檔位 → 套用字級並自動收合**回「Tt」，焦點回到圓形鈕。
  - **點擊外部區域**或按 **Esc** 亦收合（Esc 後焦點回到圓形鈕）。
  - 展開／收合狀態以 `data-open` 與 `aria-expanded` 表達，維持無障礙。
- 字級切換邏輯與 v57 相同：以 `html.font-scale-sm/md/lg` 統一縮放全站字級，並以 `localStorage`（key `ssss-wedding-font-scale`）記住選擇，重新載入後保持；無效值回退「中」。
- 動態定位沿用 v57：以 `getBoundingClientRect()` 量測 `.music` 實際高度，將 `.fontctl` 的 `bottom` 設為「音樂開關頂端 + 10px」，確保**緊鄰且不重疊**；並於 `resize`／`orientationchange`／`load` 及 `ResizeObserver` 時重新定位。

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

## ⚠️ 使用者需手動完成的步驟

- 本次**無** Apps Script 後端變更，無需重新部署 Apps Script。
