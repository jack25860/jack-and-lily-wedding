# v27 變更紀錄 — 電子喜帖改為「視覺主視覺」

**版本**：v27（由 v26 複製；v26 及更早版本未動）
**日期**：2026-10-02
**正式站**：https://jack25860.github.io/jack-and-lily-wedding/

## 需求（jack25860）
電子喜帖區塊不要再用表格／欄位式表單呈現，改成「像廣告那樣一大張圖片自動播放」的視覺主視覺；保留寄信功能（FormSubmit 不變），但入口要低調、融入畫面；風格與全站一致，桌機與行動版皆不破版。

## 變更檔案
| 檔案 | 變更 |
|---|---|
| `index.html` | 電子喜帖區塊改為 `.ecard-show`（三張滿版海報自動輪播）＋ `.ecard-panel`（點擊後才展開的低調寄送面板）；移除舊的 `.rsvp__ecard-preview` / `#ecardPhoto` / `.rsvp__ecard-actions` |
| `css/styles.css` | 新增 v27 電子喜帖樣式（輪播、疊層、金色 CTA、面板、RWD）；**修正**舊 `.rsvp__ecard{max-width:760px;padding:…;border:1px dashed}` 會把海報壓成窄框導致內容溢出裁切的問題，改為 `max-width:none;margin:…;padding:0;border:0` |
| `js/config.js` | 新增 `ECARD_SHOW_TITLE`、`ECARD_PANEL_TITLE`、`ECARD_PANEL_SUB`、`ECARD_SEND_BTN_TEXT`、`ECARD_CANCEL_BTN_TEXT`、`ECARD_SLIDE_MS`、`ECARD_SLIDES` |
| `js/app.js` | `initEcard()` → 退役為 `initEcardLegacy()`；新增 `initEcardShow()`（輪播、圓點切換、面板開合、Escape 關閉、信箱驗證、`fsPost()` 送出）；`boot()` 改呼叫 `initEcardShow()` |
| `images/ecard-poster-silk.jpg`、`ecard-poster-couple.jpg`、`ecard-poster-still.jpg` | 新增三張 1600×900 海報素材（酒紅絲綢／新人合院／金印靜物） |

## 行為
- 三張海報每 **5.2 秒**自動淡入淡出輪播（Ken Burns 緩慢推近），可點右下圓點手動切換；`prefers-reduced-motion` 時不自動輪播。
- 圖片上疊加：`電子喜帖` / `三生三世，緣定今生` / 新人姓名 / 婚期 / 說明 / 金色「囍」CTA / 提示；**無任何輸入欄位外觀**。
- 點 CTA 才展開 `.ecard-panel`（酒紅底金字送出鈕、宣紙米底），輸入賓客信箱 → 驗證 → 以 `fsPost()` 送出 FormSubmit 通知信至 `jack25860@gmail.com`。
- 電子喜帖區塊內 **iframe 數 = 0**（全站唯一 iframe 為交通頁 Google 地圖）。

## 驗收（正式站實測，真實 Chromium）
| 項目 | 結果 |
|---|---|
| 海報滿版 | 桌機 1100×619（16:9）、行動 359×514 ✅ |
| 自動輪播 | t0=2 → t6s=0 → t12s=2，確實自動播放 ✅ |
| 內容不裁切 | `contentFitsVertically = true`（桌機＋行動）✅ |
| 寄信 | FormSubmit HTTP **200**，狀態列 `is-ok`：「電子喜帖已送出，我們會將喜帖寄至 jack25860@gmail.com。」✅ |
| Console / pageerror | 桌機 0／0、行動 0／0 ✅ |
| 水平捲動 | 桌機 1440=1440、行動 390=390（無溢出）✅ |
| 觸控目標 | CTA 桌機 66px、行動 63px（>44px）✅ |

## 部署
- 依既有 `.github/workflows/deploy-site.yml`（`workflow_dispatch`，input `zip_url`）觸發，**未新增或修改任何 workflow**。
- 注意：`zip_url` 必須帶 CDN 存取權杖（`?tk=…`），否則 runner 下載會 401/403 而失敗。
- 完成 commit `8e2663f8`（`Deploy wedding site` ✅ success、`pages build and deployment` ✅ success）。

## 備註
- Google 表單（`https://forms.gle/eMPxMdQGSe145r329`）目前設為「需登入 Google 帳號」，此為表單端設定。
- 部署包為完整站點（46.6 MB），含 v27 四個變更檔與三張新增海報，並保留同期其他 agent 的變更（`films--hero`、`rsvpNumWrap` 等）。
