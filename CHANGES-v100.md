# CHANGES v100 — 座位表頁面新人姓名改為中文

**部署日期**：2026-10-29
**基準版本**：線上 v99（`seating.html` 內 `<meta name="site-version">` 原為 v95，本次同步標記為 v100）
**範圍限制**：只動座位表相關檔案。`index.html`、`ecard-video.html`、`js/config.js`、`scripts/rsvp-to-sheet.gs`、`README.md` 等仍含 Jack / Lily 的檔案**一律未改**（清單見下方「未修改項目」）。

## 一、已修改（3 個檔案）

### 1. `seating.html`

| # | 位置 | 修改前 | 修改後 |
|---|---|---|---|
| 1 | `<meta name="description">`（第 6 行） | `三生三世·緣定今生 —— Jack 與 Lily 婚宴座位查詢。…` | `三生三世·緣定今生 —— 王有岑 & 杜伊穠 婚宴座位查詢。…` |
| 2 | `<title>`（第 114 行） | `全場座位表｜三生三世·緣定今生 Jack ＆ Lily` | `全場座位表｜三生三世·緣定今生 王有岑 & 杜伊穠` |
| 3 | 頁首副標 `.seat-hero__meta`（第 138 行） | `<p class="seat-hero__meta">JACK ＆ LILY · WEDDING SEATING</p>` | `<p class="seat-hero__meta"><span class="seat-hero__meta-names">王有岑 & 杜伊穠</span> · WEDDING SEATING</p>` |
| 4 | 頁尾 `.seat-foot__names`（第 259 行） | `Jack ＆ Lily` | `王有岑 & 杜伊穠` |
| 5 | `<meta name="site-version">`（第 112 行） | `v95` | `v100` |

### 2. `js/seating.js`

| # | 位置 | 修改前 | 修改後 |
|---|---|---|---|
| 6 | 座位圖 SVG 圖說（第 623–624 行，`buildMap()` 內） | `class: "venue-caption"` ／ `"SEATING CHART · JACK & LILY"` | `class: "venue-caption venue-caption--zh"` ／ `"SEATING CHART · 王有岑 & 杜伊穠"` |

### 3. `css/seating.css`

| # | 位置 | 修改內容 | 原因 |
|---|---|---|---|
| 7 | 第 68–69 行（`.seat-hero__meta` 之後） | 新增 `.seat-hero__meta-names{font-family:var(--zh);font-size:1.15em;letter-spacing:.14em;color:var(--gold-light);white-space:nowrap}` | 原 `.seat-hero__meta` 使用 `--en-caps`（Cinzel 英文字體）＋ `.34em` 大字距。中文若沿用會落回系統字體且在 390px 手機上被撐開／換行。改為中文字體、縮小字距、`nowrap` 讓姓名保持單行。 |
| 8 | 第 269–270 行（`.venue-caption` 之後） | 新增 `.venue-caption--zh{font-family:var(--zh);font-size:8px;letter-spacing:.1em}` | SVG 圖說原字級 7.5px、字距 `.24em` 為英文設計；CJK 需中文字體並縮字距。實測圖說寬度 137.8px，仍遠小於畫布寬 600px（桌機 1440 與手機 390 皆同）。 |

## 二、刻意**不**修改的出現位置（避免破壞功能）

這些字串雖然含 `jack` / `lily`，但屬於**網域／專案路徑**，不是顯示名稱，改了會造成 404：

- `seating.html` 第 12 行：`<meta property="og:image" content="https://jack25860.github.io/jack-and-lily-wedding/images/og.jpg">`
- `seating.html` 第 22 行：註解中的頁面網址 `https://jack25860.github.io/jack-and-lily-wedding/seating.html`
- 其他所有 `js/seating-config.js`、`js/seating-data.js`、`css/seating.css` 內皆已無 jack/lily（`seating-config.js` 只有 Google Sheet / Apps Script URL）

## 三、未修改、僅列出待確認（使用者要求先回報）

| 檔案 | 行 | 內容 |
|---|---|---|
| `index.html` | 59 | `<title>三生三世·緣定今生｜Jack ＆ Lily 婚禮邀請</title>` |
| `index.html` | 62 | `<meta name="description" content="Jack ＆ Lily 的婚禮邀請。…">` |
| `index.html` | 63 | `<meta name="keywords" … Jack,Lily, …>` |
| `index.html` | 64 | `<meta name="author" content="Jack ＆ Lily">` |
| `index.html` | 72 | `<meta property="og:title" content="三生三世·緣定今生｜Jack ＆ Lily">` |
| `index.html` | 77 | `<meta property="og:image:alt" content="…Jack ＆ Lily 婚禮主視覺">` |
| `index.html` | 83 | `<meta name="twitter:title" content="三生三世·緣定今生｜Jack ＆ Lily">` |
| `index.html` | 95 | JSON-LD `"name": "Jack ＆ Lily 婚禮 — 三生三世·緣定今生"` |
| `index.html` | 98 | JSON-LD `"organizer": {"@type":"Person","name":"Jack ＆ Lily"}` |
| `index.html` | 199 / 201 | 首屏 `data-cfg="GROOM_NAME">Jack` / `data-cfg="BRIDE_NAME">Lily` |
| `index.html` | 268 / 273 | 邀請卡 `invite-name__value` 同上 |
| `index.html` | 493 | `story__finale-names` |
| `index.html` | 913 | `footer__names` |
| `ecard-video.html` | 7 / 11 | `<meta description>`、`og:description`：「Jack & Lily 的電子喜帖影片…」 |
| `ecard-video.html` | 12 | `og:image`（網域，屬不可改） |
| `ecard-email-preview.html` | 20 | 信件主旨／內文含 Jack & Lily（單行壓縮 HTML，1 處） |
| `js/config.js` | 1 | `ECARD_SUBJECT:"【三生三世·緣定今生】Jack ＆ Lily 誠摯邀請您"`（另有 `GROOM_NAME:"王有岑"` / `BRIDE_NAME:"杜伊穠"` 已是中文） |
| `scripts/rsvp-to-sheet.gs` | 26/31/43 | 僅為 SITE_BASE / ECARD_VIDEO_URL / ECARD_LOOP_GIF_URL 網域，屬不可改 |
| `robots.txt` 6、`sitemap.xml` 4/9 | | 僅網域，屬不可改 |
| `README.md` | 21/22/65 | 僅網域，屬不可改 |

> **注意**：`index.html` 的姓名是由 `js/config.js` 的 `GROOM_NAME` / `BRIDE_NAME`（已是「王有岑」／「杜伊穠」）於載入時覆寫 `data-cfg` 節點，因此**實際執行時瀏覽器顯示已是中文**；只有 meta/title/JSON-LD 等靜態內容仍是英文。這一點留給使用者確認是否要一併改。

## 四、部署與驗證

- 部署方式：既有 `deploy-site.yml`（`workflow_dispatch`，input `zip_url`），未修改 workflow。
- zip 內容：整棵樹**排除** `images/album/`、`images/album-lb/`、`media/`、`.github/`（album 為 75MB 大圖，與本次無關，且遠端 repo 已有、unzip 為覆蓋不刪除）。檔案大小 12.1 MB（> workflow 的 1 MB 下限）。
- 驗證：真實 Chromium，桌機 1440×900 與手機 390×844：
  - `document.title`、meta description、頁首副標、頁尾、SVG 圖說皆為「王有岑 & 杜伊穠」
  - `document.body.innerText` 無 jack / lily（大小寫不拘）
  - 16 張桌次圖完整、查詢功能正常、console error 0、`scrollWidth === clientWidth`
