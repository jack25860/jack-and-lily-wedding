# 三生三世・緣定今生 · 婚禮網站

王有岑 ＆ 杜伊穠 婚禮邀請網站（純靜態：HTML / CSS / Vanilla JS，無需建置流程）。

**版本：v22** — ① 將真實 Google 出席回覆表單整合進「出席回覆」區塊（可於頁面直接填寫，另提供新分頁備援連結）；② 修正點擊導覽／錨點後跳轉落點被固定導覽列遮住的問題（`section[id]{scroll-margin-top}`）；③ 新增電子喜帖回覆流程（表單留下信箱後寄送喜帖邀請函，喜帖內容暫以婚紗照代替）。前版 v21 將網站網址改為 `jack-and-lily-wedding`。

---

## 📨 電子喜帖寄送設定（RSVP → 寄送喜帖邀請信）

賓客於「出席回覆」區塊填寫 Google 表單並留下電子信箱後，可用以下任一方式寄送電子喜帖：

### 方式 A：自動寄送（建議）— Google Apps Script
1. 開啟表單的回應試算表（表單右上角 →「回應」→ 綠色試算表圖示）。
2. 於試算表選單列點 **擴充功能 → Apps Script**。
3. 將本專案的 `scripts/send-invitation.gs` 內容整份貼上，覆蓋預設程式碼。
4. 修改檔案最上方 `CONFIG`（新人名稱、信件主旨、網站網址、喜帖圖片網址）。
5. 點左側 **觸發條件（時鐘圖示）→ 新增觸發條件**：
   - 執行函式：`onFormSubmit`
   - 活動來源：**來自試算表**
   - 活動類型：**提交表單時**
6. 儲存並授權（首次會要求 Gmail 寄信權限）。
7. 之後每次有人提交表單，系統會依其留下的電子信箱自動寄出電子喜帖。

> 🖼️ 目前尚無正式電子喜帖，`ECARD_PHOTO_URL` 先以婚紗照 `images/tl1.jpg` 暫代；正式喜帖完成後只要換掉這個網址即可。

### 方式 B：手動寄送 — 網站上的「寄送喜帖邀請信」按鈕
「出席回覆」區塊的電子喜帖卡片下方提供按鈕，點擊後輸入賓客信箱，會開啟郵件軟體並自動帶入喜帖主旨、內文與示意圖片網址，確認後即可寄出。

---

## 📁 專案結構

```
.
├── index.html          # 主頁（單頁式，含 Hero / 倒數 / 婚禮資訊 / 三生三世 / 相簿 / 注意事項 / 留言 / RSVP）
├── css/styles.css      # 全站樣式（酒紅 #6E1626、金 #C9A961、宣紙米色系）
├── js/config.js        # ★ 所有可編輯內容集中在此（新人名字、日期、場地、表單網址…）
├── js/app.js           # 互動邏輯（導覽、Lightbox、倒數、表單、音樂、回到頂端…）
├── audio/              # 背景音樂
└── images/             # 婚紗照與版面圖片
    └── album/          # 56 張婚紗照（p01–p56）
```

---

## 🚀 部署到 GitHub Pages（3 步驟）

1. 將本資料夾所有檔案（含 `images/`、`audio/`）放入 repo 根目錄並提交：
   ```bash
   git add .
   git commit -m "Deploy wedding site"
   git push origin main
   ```
2. 到 repo → **Settings → Pages**
   - Source：`Deploy from a branch`
   - Branch：`main`，資料夾：`/ (root)` → **Save**
3. 約 1 分鐘後即可瀏覽：

   **https://jack25860.github.io/jack-and-lily-wedding/**

> 📦 完整含圖片之打包檔（zip）可自平台下載後解壓至本資料夾，再執行上述第 1 步。

---

## ⚙️ 修改網站內容

幾乎所有文字都在 `js/config.js`，不需動 HTML：

| 設定 | 說明 |
|---|---|
| `GROOM_NAME` / `BRIDE_NAME` | 新人名字 |
| `WEDDING_DATE` / `WEDDING_TIME` | 婚禮日期時間（倒數計時用） |
| `VENUE_NAME` / `VENUE_ADDRESS` / `GOOGLE_MAP_URL` | 場地資訊與地圖連結 |
| `GALLERY_THEMES` | 相簿主題（戰國 → 唐代 → 明朝）、大圖合照 `FEATURED`、縮圖 `MORE` |
| `GOOGLE_FORM_URL` | **RSVP 出席回覆表單網址（見下方）** |
| `MUSIC_URL` | 背景音樂路徑 |

---

## 📝 RSVP 出席回覆表單（Google 表單）

1. 開啟 <https://forms.new>，建立表單，建議欄位：
   **姓名**、**是否出席**（出席／不出席）、**出席人數**、**飲食需求**、**祝福留言**
2. 點右上角 **傳送 → 連結 → 勾選「縮短網址」→ 複製**
3. 開啟 `js/config.js`，將連結貼到：
   ```js
   GOOGLE_FORM_URL:"https://docs.google.com/forms/d/e/XXXX/viewform",
   ```
4. 提交並推送；按鈕與頁面內嵌表單會自動啟用。

> 未填入有效網址時，按鈕會顯示為停用狀態（避免賓客點到壞掉的連結）。

---

## ✅ 已修復：手機版全螢幕選單（v14）

**問題**：手機版點右上角選單時，選單只顯示一半，底部露出頁面內容。

**根本原因**：`.nav` 於捲動後套用 `backdrop-filter`，使其成為 fixed 子元素的 **containing block**，
導致 `.nav__mobile { position:fixed; inset:0 }` 不再以視窗為基準，高度被壓縮成標頭高度（844px → 152px，僅露出 3 個連結）。

**修法**：
1. 將 `#navMobile` 移出 `<header class="nav">`，避免受 containing block 影響。
2. `.nav__mobile` 改為 `top:0;left:0;width:100vw;height:100dvh`，明確全螢幕。
3. 開啟時鎖定 `body` 捲動（`body.menu-open{overflow:hidden}`），並支援 `Esc` 關閉。

**驗證**：390×844 與 360×640 實機尺寸實測 — 選單覆蓋全螢幕、11 個連結全數可見、關閉正常。

---

## 🎨 設計規範

| 用途 | 色碼 |
|---|---|
| 主色（酒紅） | `#6E1626` |
| 輔色（金） | `#C9A961` |
| 底色（宣紙米） | `#F5F0E7` |
| 深底 | `#131010` |

字體：`Noto Serif TC`（中文）、`Cormorant Garamond` / `Cinzel`（英文）。

---

*Built with care. 願三生有幸，每一世都能遇見你。*
