# v24 — RSVP 主題化主要 CTA 按鈕（UI Designer）

**基準版本**：v23（未變動，v23 及更早版本保持不變）
**本次修改 4 個檔案**：`index.html`、`css/styles.css`、`js/config.js`、`js/app.js`

## 背景
Google 表單設定為「需登入 Google 帳號」，嵌入 iframe 會顯示 Google 登入畫面；該 iframe 屬跨來源（docs.google.com），本站 CSS 無法主題化其內部。因此依需求以**主題化按鈕**作為 RSVP 區塊的主要互動入口，直接連到表單短網址。

## 變更內容
- **index.html**：`#rsvpBtn` 由 `.btn.btn--solid` 改為 `.rsvp__cta`，`href` 直接指向 `https://forms.gle/eMPxMdQGSe145r329`，`target="_blank" rel="noopener"`，文字「填寫出席回覆表單」。`#rsvpFallback` 保留為**次要文字連結**（金色底線），移除箭頭符號，避免與主按鈕混淆。
- **css/styles.css**：新增 `.rsvp__cta`（酒紅底 `#6E1626`／金字 `#C9A961`、金色細邊、圓角 2px、hover 金底酒紅字、`:focus-visible` 外框）；`.rsvp__actions` 改為垂直堆疊（gap 16px）；行動版（≤640px）全寬 `max-width:440px`、`min-height:54px`、加大內距。
- **js/config.js**：新增 `RSVP_FORM_URL`（短網址）；`RSVP_BTN_TEXT` 改為「填寫出席回覆表單」；`RSVP_NOTE` 文案微調。
- **js/app.js**：`initRsvp` 新增 `btnUrl`（優先 `RSVP_FORM_URL`，回退 `GOOGLE_FORM_URL`），按鈕 `href` 改用 `btnUrl`；嵌入 iframe 仍使用 `GOOGLE_FORM_URL`（`?embedded=true`）。

## 對比（WCAG AA）
- 金 `#C9A961` on 酒紅 `#6E1626` = **5.22:1** ✅（一般文字需 4.5:1）
- hover 酒紅 `#6E1626` on 金 `#C9A961` = **5.22:1** ✅

## 驗證
- Quick Check：HTML 標籤平衡 ✅、CSS 括號 515/515 平衡 ✅、`node --check` app.js/config.js ✅
- 功能斷言：`.rsvp__cta` 存在 ✅、`href=forms.gle/eMPxMdQGSe145r329` ✅、`target="_blank"` ✅、`#rsvpFallback` 保留且非 `.btn`（無兩顆同外觀按鈕）✅
- 線上（CDN）：`index.html` 200 / 47,603 bytes；`css/styles.css` 200（平台自動壓縮 50,754 bytes，含 `.rsvp__cta`）；`js/app.js`、`js/config.js` 200 且內容正確 ✅
- Visual Check：Chromium 桌機（1440×1000）＋行動版（390×844）截圖，CTA 酒紅底金字、次要連結金色底線、無破版／重疊 ✅
- 計算樣式實測：`background-color: rgb(110,22,38)`、`color: rgb(201,169,97)` ✅

## 待辦（非本次範圍）
- **部署**：v24 尚未部署至 `jack25860/jack-and-lily-wedding` main 分支（需以 `deploy-site.yml` workflow_dispatch，`zip_url` 須為帶 `?tk=` 的 CDN zip 網址）。
