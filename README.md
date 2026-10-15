# 三生三世・緣定今生 · 婚禮網站

> 王有岑 ＆ 杜伊穠 婚禮邀請網站（純靜態：HTML / CSS / Vanilla JS，無需建置流程）

---

## 專案簡介

單頁式婚禮邀請網站，包含：Hero 首屏、倒數計時、婚禮資訊、交通資訊、三生三世故事、相簿（三朝代主題）、婚禮當日注意事項、賓客留言、RSVP 出席回覆、電子喜帖寄送。

- **前端**：原生 HTML / CSS / Vanilla JS，無框架、無建置步驟，直接由 GitHub Pages 靜態託管。
- **後端**：Google Apps Script Web App（`scripts/rsvp-to-sheet.gs`、`scripts/seating-from-sheet.gs`），負責 RSVP 寫入 Google 試算表、電子喜帖寄信、座位表名單 JSON，以及 `/exec?diag=1` 健康檢查。
- **設計規範**：酒紅 `#6E1626`／金 `#C9A961`／宣紙米色 `#F5F0E7`／深底 `#131010`；字體 `Noto Serif TC`、`Cormorant Garamond`、`Cinzel`。

---

## 正式站與 Repo

| 項目 | 位址 |
|---|---|
| 正式站 | https://jack25860.github.io/jack-and-lily-wedding/ |
| Repo | https://github.com/jack25860/jack-and-lily-wedding |
| 分支 | `main` |
| Pages 來源 | Deploy from a branch → `main` / `/ (root)`（由 `.nojekyll` 關閉 Jekyll 處理） |

---

## 頁面清單

| 頁面 | 檔案 | 說明 |
|---|---|---|
| 首頁 | `index.html` | 單頁式主站：Hero／倒數／婚禮資訊／交通／三生三世故事／**相簿**／注意事項／留言／RSVP／電子喜帖 |
| 相簿 | `index.html` 內 `#gallery` 區塊 | 三主題（戰國／唐代／明朝）分類相簿，資料來自 `js/config.js` 的 `GALLERY_THEMES` |
| 電子喜帖（影片頁） | `ecard-video.html` | 電子喜帖影片播放頁（`media/ecard-video.mp4` + `.webm` 雙來源） |
| 電子喜帖（信件預覽） | `ecard-email-preview.html` | Apps Script 產生之信件內文原樣預覽（對照／驗證用，`noindex`） |
| 座位表 | `seating.html` | 賓客座位查詢（`js/seating.js` + `js/seating-config.js` + `js/seating-data.js`） |

---

## 相簿三主題分類

相簿共 **137 張原始照片**（`images/album/`），依服裝／造型／風格分為三主題：

| 主題 | 英文 | 張數 | 說明 |
|---|---|---|---|
| 戰國 | WARRING STATES | 36 | 鐵馬金戈，亂世相逢。 |
| 唐代 | TANG DYNASTY | 38 | 盛世繁華，錦繡良緣。 |
| 明朝 | MING DYNASTY | 63 | 鳳冠霞帔，一世相守。 |
| **合計** | | **137** | |

- 每主題含 `FEATURED`（大圖 6 張）與 `MORE`（縮圖，可展開），完整涵蓋 137 張、每張各引用一次、無重複、無缺漏。
- 相簿檔名對應：`candid-01..08`（8）、`couple-01..81`（81）、`group-01..06`（6）、`portrait-01..42`（42），合計 137。
- **v81 起為「原始照片」**：逐位元（byte-for-byte）直接放入相簿，未做任何影像處理（不去浮水印、不修陰影、不調色、不重新編碼）。每張 album 檔案的 sha256 與原始檔完全相同（137/137 驗證通過）。

---

## 目錄結構

```
.
├── index.html                     # 主頁（單頁式；Hero/倒數/婚禮資訊/交通/三生三世/相簿/注意事項/留言/RSVP/電子喜帖）
├── seating.html                   # 座位表查詢頁
├── ecard-video.html               # 電子喜帖影片播放頁
├── ecard-email-preview.html       # 電子喜帖信件內文預覽（對照／驗證用）
├── css/
│   ├── styles.css                 # 全站樣式（酒紅/金/宣紙米色系）
│   └── seating.css                # 座位表專用樣式
├── js/
│   ├── config.js                  # ★ 所有可編輯內容集中於此（新人資料、日期、場地、表單、電子喜帖文案、相簿主題…）
│   ├── app.js                     # 互動邏輯（導覽、Lightbox、倒數、表單送出、音樂、回到頂端…）
│   ├── seating-config.js          # 座位表名單來源設定（gviz / CSV / Apps Script / 本機備援）
│   ├── seating-data.js            # 座位表本機備援名單
│   └── seating.js                 # 座位表繪製與查詢邏輯
├── images/                        # 版面圖片
│   ├── album/                     # 婚紗照 137 張（candid/couple/group/portrait）
│   ├── hero.jpg, og.jpg           # 首屏主視覺、社群分享縮圖
│   ├── ch1–ch5-*.jpg              # 三生三世各世章節插圖
│   ├── ecard-poster-*.jpg         # 電子喜帖輪播海報
│   ├── tl1–tl3.jpg                # 影片示意圖（電子喜帖／預告片）
│   ├── venue-map.jpg, venue-guide.jpg  # 場地位置與交通導引
│   └── texture-*.jpg              # 紙質／絹質／墨韻材質底紋
├── audio/
│   └── wedding-theme.mp3          # 背景音樂
├── media/
│   ├── ecard-video.mp4            # 電子喜帖影片（H.264）
│   ├── ecard-video.webm           # 電子喜帖影片（VP9 備援）
│   └── ecard-loop-hd.gif          # 信件用 HD 循環 GIF
├── scripts/
│   ├── rsvp-to-sheet.gs           # ★ Google Apps Script 後端（RSVP 寫表 + 電子喜帖寄信 + diag）
│   ├── seating-from-sheet.gs      # ★ Google Apps Script 後端（座位表名單 JSON）
│   └── verify-seating-gs.js       # 座位表 Apps Script 離線驗證 harness（node scripts/verify-seating-gs.js）
├── changelog/                     # 各版本變更紀錄（CHANGES-vNN.md）
├── README.md                      # 本文件
└── .github/workflows/
    └── deploy-site.yml            # ★ 唯一部署流程（workflow_dispatch + zip_url）
```

> `changelog/CHANGES-vNN.md` 為各版本變更紀錄，是版本歷程的權威來源。

---

## 部署方式

本專案**只有一個**部署流程：`.github/workflows/deploy-site.yml`。**請勿新增或修改任何 workflow。**

### 運作方式

1. 將要部署的網站打包成 `.zip`（內容為網站根目錄檔案：`index.html`、`css/`、`js/`、`images/`、`audio/`、`media/`、`.nojekyll` 等），上傳取得可公開下載的網址。
2. 到 repo → **Actions** → 左側選 **Deploy wedding site** → 右側 **Run workflow**。
3. 填入 `zip_url`（必填，網站壓縮檔網址；網址需含有效的存取簽章，例如 `?tk=…`，否則下載會失敗）→ 執行。
4. 流程會下載 zip → 解壓覆蓋到 repo 根目錄 → 自動 commit & push → GitHub Pages 隨即在數十秒內更新。

`zip_url_fallback` 為選填的第二下載網址，主網址失敗時會自動嘗試。

> **注意**：流程內建的 `Download archive` 步驟有 **1 MB 下限**（`sz -gt 1000000`）。若只打包少量文字檔（< 1 MB）會被拒絕，需一併打包其餘非二進位內容以超過下限。

### 常見失敗原因

| 症狀 | 原因 | 處理 |
|---|---|---|
| Run 在下載步驟 `exit 1` | `zip_url` 缺少簽章或已過期 | 重新取得帶簽章的新網址後重跑 |
| 「No changes to commit」 | zip 內容與 repo 現況相同 | 正常，代表已是最新 |

> 註：流程內的 commit 訊息固定為 `Deploy wedding site (v14) with all assets`（歷史沿用字串），**不代表實際版本**，實際版本請以 `CHANGES-vNN.md` 為準。

---

## 版本控管規則（TASK CONTINUATION）

每次修改**一律**遵循以下規則：

1. **先複製最新版本為新版本，再修改**：
   ```
   cp -r webpages/<name>-vN webpages/<name>-v(N+1)
   ```
   v1 無後綴；版本目錄一律使用**底線** `_vN`（例如 `demo_v2`），不使用 `-v2`。
2. **原版本保持不變** — 所有編輯只在新 `vN+1` 目錄內進行，舊版本可完整追溯。
3. 內層檔名跨版本**不變**（只有目錄名改變）。
4. 每次部署後於 `changelog/` 新增 `CHANGES-vN.md`，記錄：基準版本、修改檔案、修改內容、驗證方式。
5. 圖片等生成媒體的版本由生成工具產生，**不要**用 `cp -r` 複製。

---

## 重要設定說明（`js/config.js`）

所有可編輯內容都在 `js/config.js`，**不需要動 HTML**。

### 新人與活動基本資料

| 設定 | 說明 |
|---|---|
| `GROOM_NAME` / `BRIDE_NAME` | 新人姓名 |
| `SITE_TITLE` / `SITE_SUBTITLE` / `MOTTO` / `HERO_CLAIM` | 網站標題、副標、題詞、首屏文案 |
| `WEDDING_DATE` / `WEDDING_TIME` | 婚禮日期與時間（倒數計時使用）；目前 `2027-04-17` / `11:30` |
| `RECEIVE_TIME` / `RECEPTION_TIME` | 報到時間 `11:30`／婚宴時間 `12:00` |
| `WEDDING_HASHTAG` | 婚禮主題標籤 |

### 場地與交通

| 設定 | 說明 |
|---|---|
| `VENUE_NAME` / `VENUE_ADDRESS` / `VENUE_PHONE` | 場地名稱、地址、電話 |
| `GOOGLE_MAP_URL` / `VENUE_LAT` / `VENUE_LNG` / `VENUE_MAP_EMBED` | 地圖導航與內嵌地圖 |
| `PARKING_INFO` / `DRIVING_ROUTE` / `TRAIN_*` / `HSR_*` / `BUS_INFO` / `TAXI_INFO` / `OTHER_TRANSIT` | 各項交通資訊 |
| `VENUE_PHOTO_1` / `VENUE_PHOTO_2`（含 Caption） | 場地與交通導引圖 |

### 婚禮當日注意事項

| 設定 | 目前值 |
|---|---|
| `RECEPTION_TIME` | `12:00`（婚宴 12 點開始） |
| `SEATING_INFO` / `SEATING_PENDING_TEXT` | `座位表將於近日公布` |
| **`SEATING_URL`** | **`""`（空＝座位表連結待補）** |
| `SEATING_LINK_TEXT` | `查看座位表` |
| `DRESS_CODE` / `DRESS_MEN` / `DRESS_LADIES` / `DRESS_NOTE` | `正式服裝` 等 |
| `PHOTO_NOTICE` | `努力拍出最好看的照片` |
| `GIFT_INFO` | `現場工作人員簽到時收取` |
| `EXTRA_NOTICE` | `攜帶愉悅開心的心情前往` |

> **`SEATING_URL` 待補**：留空時「查看座位表」按鈕為停用狀態並顯示「座位表將於近日公布」；**日後只要填入座位表網址並重新部署，按鈕即自動啟用**，無需再改程式。

### 相簿

| 設定 | 說明 |
|---|---|
| `GALLERY_THEMES` | 三主題：戰國（36 張）→ 唐代（38 張）→ 明朝（63 張），各含 `FEATURED`（大圖）與 `MORE`（縮圖），合計 **137 張** |
| `MUSIC_URL` / `MUSIC_TITLE` | 背景音樂路徑與曲名 |

### RSVP 出席回覆

| 設定 | 說明 |
|---|---|
| **`SHEET_WEBAPP_URL`** | **★ Apps Script Web App 的 `/exec` 網址（RSVP 寫表與電子喜帖寄信都靠它）** |
| `GOOGLE_FORM_URL` / `RSVP_FORM_LINK` / `RSVP_FORM_ACTION` | Google 表單網址（嵌入與備援連結） |
| `RSVP_ENTRY_IDS` | Google 表單預填欄位 ID（`entry.xxx`） |
| `RSVP_FIELDS` / `RSVP_BTN_TEXT` / `RSVP_THANKS_*` | 表單欄位與送出後提示文案 |
| `RSVP_ERR_*` / `RSVP_FALLBACK_*` | 錯誤與備援出口文案 |

RSVP 流程（**維持不變**）：送出後**不跳轉新分頁**、**不寄送任何通知信**，於頁內顯示「感謝您的回覆」→ 自動清空表單 → 內容寫入 Google 試算表。選「不克出席」時，人數欄位隱藏並停用。

### 電子喜帖

| 設定 | 說明 |
|---|---|
| `ECARD_PHOTO_POOL` | 隨機婚紗照池，**137 張全池** |
| `ECARD_SUBJECT` / `ECARD_MAIL_SUBJECT` / `ECARD_GREETING` / `ECARD_BODY` / `ECARD_INVITE_TEXT` | 信件主旨與內文 |
| `ECARD_PHOTO` / `ECARD_VIDEO_POSTER` / `ECARD_VIDEO_URL` | 信件內嵌圖片（以 `cid:` 直接內嵌，非外部連結）與影片示意圖 |
| `ECARD_SLIDES` / `ECARD_SLIDE_MS` | 網站上喜帖卡片輪播海報 |
| `E_INVITATION_*` / `TRAILER_*` | 電子喜帖與結婚預告片區塊文案與示意圖 |

電子喜帖為**手動寄送**（於網站輸入賓客信箱後送出），寄送成功後自動清空輸入框；8 秒內對同一人＋同一主旨的重複送出會被去重（回 `deduped:true`）。

### 其他

| 設定 | 說明 |
|---|---|
| `SITE_URL` / `OG_IMAGE` | 網站網址與社群分享縮圖 |
| `FORM_ENDPOINT` / `RSVP_MAIL_TO` | FormSubmit 備援信箱 |

---

## ⚠️ Google Apps Script 待辦（重要）

**`scripts/*.gs` 只是 repo 內的版本控管副本；部署到 GitHub Pages 不會更新 Google 端的 Apps Script 專案。** Google 端必須手動同步，否則線上仍是舊版、電子喜帖**不會真的寄出**。

請執行（約 2 分鐘）：

1. 開啟回覆試算表 → 上方選單「**擴充功能 (Extensions)**」→「**Apps Script**」
2. 將 `scripts/rsvp-to-sheet.gs` **全文**貼上（覆蓋預設內容）→ 按 💾 儲存
3. 函式下拉選 **`testEcard`** → 執行 → 同意 **Gmail 寄信權限**
4. 右上「**部署 (Deploy)**」→「**管理部署**」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
5. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL`，並重新部署網站

座位表後端同理：`scripts/seating-from-sheet.gs` 需同步至 Google 端，並將 `/exec` 網址填入 `js/seating-config.js` 的 `API_URL`。

### 驗證方式

瀏覽器開啟 `…/exec?diag=1`，應回傳：

```json
{ "ok": true, "version": "vNN", "mailScope": true, ... }
```

- `mailScope: true` → Gmail 寄信權限已授予
- `version` → 應等於目前 repo 的 `ENDPOINT_VERSION`
- 另含 `photoPool`（137）、`videoPoster`、`lastEcard`（最近一次寄送結果）等診斷欄位

只要 `mailScope` 仍為 `false`，網站送出電子喜帖會顯示「電子喜帖功能尚未完成授權…」且**不會寄出**（這是預期行為，不會誤報成功）。

---

## 目前最新版本與版本歷程

**目前最新版本：`v81`**

| 版本 | 內容 |
|---|---|
| v24 | RSVP 主題化主要 CTA 按鈕 |
| v25 / v26 | 早期開發（無 CHANGES 檔） |
| v27 | 電子喜帖改為「視覺主視覺」 |
| v28 | 電子喜帖海報修正 |
| v29 | RSVP「出席人數」區塊版面修正 |
| v30 | RSVP 送出流程改為「頁內提示 + 自動清空 + 寫入 Google 試算表」 |
| v31 | RSVP 改為「只寫入 Google 試算表」，不再寄送通知信 |
| v32 | RSVP 送出「真正可用」：失敗不再卡死 + 備援出口 |
| v33 | RSVP 表單正式接通 Google 試算表 |
| v34 | RSVP 流程修正與驗證 |
| v35 | 電子喜帖／相簿相關調整（無 CHANGES 檔） |
| v36 | 相簿朝代分類修正（戰國／唐代／明朝） |
| v37 | **電子喜帖寄信鏈路修復**（找出「信件沒收到」的根本原因：Apps Script 缺少 Gmail 權限；前端改為可讀取真實回應，不再一律顯示成功） |
| v38 | 電子喜帖寄信鏈路修復（第 2 棒：AI Engineer 複查）— 修正 `videoPoster` 相對路徑未轉絕對網址 |
| v39 | 電子喜帖寄信鏈路「架構面」強化（第 3 棒：Software Architect）— 移除 opaque 誤判、錯誤分類、去重、`lastEcard` 診斷 |
| v40 | Product Manager 最終驗證報告（真實瀏覽器 34/34 通過） |
| v41 | **大人出席人數上限 10 人**（小孩維持 0–4）＋ 電子喜帖去重窗口 90 秒 → **8 秒** |
| v42 | **電子喜帖寄送成功後自動清空輸入框**（失敗／授權未完成時不清空） |
| v43 | **婚禮當日注意事項內容補齊**（婚宴 12:00／Dress code 正式服裝／拍照／禮金／其他提醒）＋ **座位表連結預留**（`SEATING_URL`） |
| v44–v59 | 版面、座位表、電子喜帖與驗證迭代（詳見各 `changelog/CHANGES-vNN.md`） |
| v61 | 座位表 Apps Script 離線驗證 harness（`scripts/verify-seating-gs.js`，29 項斷言） |
| v65–v75 | 座位表遠端名單來源（gviz／CSV／Apps Script 四層備援）、字級控制、版面修正 |
| v77–v79 | 電子喜帖信件內嵌媒體、循環 GIF、版面調整 |
| v80 | 相簿浮水印去除與朝代主題重新分類（戰國 39／唐代 42／明朝 56，共 137） |
| **v81** | **相簿改用原始照片並重新分類（零影像處理）**：自使用者最新上傳的 137 張原始照片逐位元放入相簿，sha256 137/137 驗證通過；主題維持三類，數量為 **戰國 36／唐代 38／明朝 63，合計 137**；`index.html` 的 `site-version` 為 v81 |

> v81 已部署至正式站。

---

## Repo 整理紀錄

### 本輪整理（v81 之後）

本輪以 **consumer-based 引用掃描**（HTML + CSS `url()` + JS config 資源池 + `.gs` 後端 + workflow）＋ **md5 全樹重複比對** 盤點全部 250 個檔案，僅刪除**零引用且屬程式產物**的檔案：

| 刪除檔案 | 類型 | 原因 |
|---|---|---|
| `scripts/verify-v58.py` | 一次性驗證腳本 | v58 專版 Playwright 驗證腳本，已被 `scripts/verify-seating-gs.js` 取代；無任何引用 |
| `scripts/send-invitation.gs` | 過時後端腳本 | 舊版「表單觸發自動寄喜帖」腳本，已被 `scripts/rsvp-to-sheet.gs` 取代；無任何引用 |

- **檔案數變化：250 → 248**（刪除 2 個程式產物）。
- 未發現 md5 完全重複檔、未發現 `.bak`／`.orig`／`.tmp`／`.DS_Store` 等殘留檔。
- **保留但標示為未使用**（依安全規則不刪，供人工確認）：`images/` 下 18 張未被任何消費者引用的照片 — `ch1-encounter.jpg`、`ch2-knowing.jpg`、`ch3-understanding.jpg`、`ch4-love.jpg`、`ch5-forever.jpg`、`ch5-forever-gongbi.jpg`、`g1–g6.jpg`、`m1–m6.jpg`。這些屬**內容資產**（照片），部分於 `index.html` 註解中標示為「可替換」的替代圖，部分為早期版本素材，刪除不可由程式還原，故一律保留。
- 目錄結構維持既有分類（頁面／樣式／腳本／圖片／音訊／媒體／版本紀錄），**未更動任何線上載入路徑**。
- **版本紀錄歸檔**：50 個 `CHANGES-vNN.md` 由 repo 根目錄移入 `changelog/`，內容逐位元不變（byte-identical），上方樹狀圖與說明同步更新。

### 前次整理（v43 時期）

移除了 52 個已確認無用的檔案（詳見 `changelog/CHANGES-v43.md`）：

- `.github/workflows/deploy.yml` — 已死的舊版 v14 部署流程（從未執行、其下載網址已過期 403），且與 `deploy-site.yml` **同名**造成誤選風險。
- `scripts/` 下 31 個歷史版本的驗證腳本與一次性產生器（v30–v40）。
- `sheets/` 下 20 個已被取代的縮圖／聯絡表（7.4 MB，全站 0 引用）。

---

*Built with care. 願三生有幸，每一世都能遇見你。*
