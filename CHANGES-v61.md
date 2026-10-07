# 變更紀錄 v61（婚禮網站）

> 本版在 v60 的基礎上，依 TASK CONTINUATION 規則複製為 v61 後修改；**v60 保持不變**。
> 部署沿用既有 `.github/workflows/deploy-site.yml`（未新增、未修改任何 workflow）。
> 原始版本目錄：`webpages/san-sheng-san-shi-wedding-v60/`（未動）。

---

## 任務一：電子喜帖影片頁 —— 移除壓在影片內容上的那一行文字

### 問題定位（以真實瀏覽器實測，不是憑截圖猜測）

在 v60 線上頁面以真實 Chromium 開啟（桌機 1440×900、手機 390×844），
用 `document.elementsFromPoint()` 對影片框內數十個取樣點逐一列舉「實際畫在最上層、
且有可見文字」的元素，結果只有 **一個** 元素命中：

| 元素 | 文字 | 位置 | 與影片框關係 |
|---|---|---|---|
| `span.badge` | `LOOP · 循環播放` | 影片框內底部置中（`left:50%; bottom:clamp(12px,2.6vw,20px); z-index:3`） | **完全落在影片 rect 內** |

也就是使用者截圖上那行壓在畫面內容上的字，就是這個「LOOP · 循環播放」膠囊標籤。

> 補充：使用者提供的截圖中，影片畫面**本身**也燒錄了一段英文標語
> （`KNOW EACH OTHER AND STAY TOGETHER`）。該行屬於影片檔內容，不是 DOM 文字，
> 因此不會、也不應該由這個標籤來取代——移除浮動標籤後它就會完整露出。
> 影片檔為 `media/ecard-video.mp4` / `.webm`，本版未改動。

### 修改內容（`ecard-video.html`）

1. **刪除 DOM**：移除 `<span class="badge"><i aria-hidden="true"></i><span>LOOP · 循環播放</span></span>`。
2. **刪除 CSS**：移除 `.badge{…}`、`.badge i{…}` 與 `@keyframes pulse{…}`
   （原樣保留為說明註解，避免日後誤以為樣式遺失）。
3. **清理**：`@media(prefers-reduced-motion:reduce)` 內的 `.badge i{animation:none}`
   一併移除（元素已不存在，留著是死碼）。
4. 新增 `<meta name="site-version" content="v61">` 供版本辨識。

### 刻意「不動」的部分（確保既有功能無回歸）

- 影片元素本身（`autoplay / loop / muted / playsinline`、各項續播與 autoplay 修正）
- 右下角**漂浮音效開關**（v55／v59 的絲滑化動效與 `soundLabel` 文案）
- 點擊防護層 `.frame__shield`、裝飾框 `.frame__inner`、`.frame__glow` 等
- 電子喜帖首頁／`ecard-email-preview.html`／HD GIF 相關邏輯

### 驗收（真實瀏覽器，桌機＋手機）

- 影片框內可見文字浮層：**0 個**（修正前為 1 個）
- `.badge` 元素存在於 DOM：**False**
- 影片 `currentTime` 2 秒後確實前進（真的在播）、`loop === true`
- 漂浮音效開關仍存在且可見
- `console` error **0**、`pageerror` **0**
- `scrollWidth === clientWidth`（無水平溢位）

---

## 任務二：座位表名單 —— 自動連到問卷回覆的 Google 試算表

### 架構

```
問卷（Google 表單）→ 問卷回覆（Google 試算表）
                          │
                          │  讀取（唯讀，不寫入、不寄信）
                          ▼
             scripts/seating-from-sheet.gs  →  部署為 Apps Script Web App
                          │
                          │  GET /exec → application/json
                          ▼
   seating.html  ──fetch──▶  js/seating-config.js 的 API_URL
                          │
                  成功 ────┴──── 失敗 / 逾時 / 未設定
                    │                    │
              以遠端名單重繪        自動回退 js/seating-data.js 備援名單
              ＋寫入 localStorage    ＋頁面下方一行不打擾的提示＋自動重試
```

沿用本專案既有的靜態網站串接 Google 模式（`scripts/rsvp-to-sheet.gs` 為寫入端；
本版新增的是**唯讀**的讀取端），同樣以 Apps Script Web App 為 JSON API。

### 新增／修改的檔案

| 檔案 | 動作 | 說明 |
|---|---|---|
| `scripts/seating-from-sheet.gs` | **新增** | Apps Script Web App：`doGet()` 讀取問卷回覆試算表，輸出座位表 JSON。可設定欄位對應。 |
| `js/seating-config.js` | **新增** | 前端設定：`API_URL`、逾時、快取、重試、提示文字。 |
| `js/seating.js` | 修改 | `DATA` 改為可重新賦值；新增 `deriveAll()` 讓名單可換掉後重繪；`buildMap()`／`initSearch()`／`bindZoom()` 改為可重複呼叫而不重複綁定；新增遠端載入、快取、逾時、回退、狀態列。 |
| `seating.html` | 修改 | 載入 `js/seating-config.js`；新增 `#seatDataStatus` 狀態列節點；版本註解更新為 v61。 |
| `css/seating.css` | 修改 | 新增 `.seat-data-status` 樣式（置中一行小字、無底色、不遮擋座位圖）。 |
| `scripts/verify-seating-gs.js` | **新增** | 離線驗證 Apps Script 的測試腳本（stub 試算表，29 項斷言）。 |

### 欄位對應（可設定）

Apps Script 檔頭的三個常數就是「姓名欄／桌次欄／座位欄」的對應，每欄有三種指定方式，
解析順序為 **欄名 → 別名 → 第幾欄**：

```javascript
var COL_NAME  = { header: '您的姓名', aliases: ['姓名','大名','名字','name'],        index: 0 };
var COL_TABLE = { header: '桌次',     aliases: ['桌次','桌號','第幾桌','table'],      index: 0 };
var COL_SEAT  = { header: '座位',     aliases: ['座位','座位號','座號','第幾位'],     index: 0 };
var COL_NOTE  = { header: '備註',     aliases: ['備註','註記','note'],               index: 0 };
```

- **欄名改了** → 只改 `header` 字串。
- **欄名完全對不上** → 設 `index`（第幾欄，從 1 起算）即可強制以位置取值。
- **出席欄位** `COL_ATTEND` + `ONLY_ATTENDING = true` 會自動剔除「不克出席」的回覆；
  若你的問卷沒有出席欄，把 `header`/`index` 留空即不篩選。
- **未分配桌次**的賓客不會進座位圖（圖上沒有位子可放），但會列在回傳 JSON 的
  `unplaced` 陣列裡，不會被默默丟掉。
- **桌名／場地**：`VENUE_OVERRIDE` 可覆寫場地設定；`tables[].name` 可為每桌命名。
  留空則沿用 `js/seating-data.js` 的 `VENUE`。

### 前端設定（`js/seating-config.js`）

```javascript
API_URL: "",              // ← 部署 Apps Script 後把結尾為 /exec 的網址貼這裡
API_TIMEOUT_MS: 8000,     // 逾時即回退備援名單
CACHE_TTL_MS: 300000,     // 瀏覽器端快取 5 分鐘（先秒開，再更新）
RETRY_MS: 60000,          // 失敗後每 60 秒自動重試
```

### 保留不動的既有功能

模糊比對、同名／相似候選、查無資料提示、座位變色（`.is-hit` + `.seat-hit`）、
呼吸燈（`ringBreath` / `seatBreath` 2.1s）、「姓名-幾桌」浮動標籤、
自動捲動聚焦、縮放鈕、Tt 字級鈕、背景音樂開關 — **全部沿用 v60 邏輯**，
v61 只把「名單從哪裡來」改成可抽換。

### 驗收

**A. Apps Script 離線驗證（`node scripts/verify-seating-gs.js`）：29/29 PASS**
涵蓋：正常讀取、欄位對應（含中文「第 12 桌」解析為 12）、不克出席剔除、
未排桌 → `unplaced`、無姓名 → 略過、排序、`?format=health`、
JSONP、只用 `index` 的欄位對應、找不到姓名欄時回 `ok:false` 而非拋錯、空試算表。

**B. 前端真實瀏覽器驗證（桌機 1440×900 ＋ 手機 390×844）：78/78 PASS**

| 情境 | 結果 |
|---|---|
| API 成功 | 狀態列「即時讀取問卷回覆（共 N 位賓客）」；依 API 的桌次繪製；精確查詢命中；座位變色＋呼吸燈有實際變化；模糊比對命中；相似候選列出 2 筆可點；查無資料有提示 |
| API HTTP 500 | 回退備援名單，狀態列「暫時無法讀取問卷回覆，將自動重試」；座位圖仍在、查詢仍可用 |
| API 逾時 | 逾時後回退備援名單；頁面不壞；查詢仍可用 |
| 未設定 API_URL | 明確提示「尚未設定問卷回覆連線」並顯示備援名單（不靜默失敗） |

四種情境都：`console` 無非預期 error、無 `pageerror`、無水平溢位。

**C. 回歸比對**：同一份 `js/seating-data.js` 備援資料、同樣操作、同樣視窗下，
v60 與 v61 的座位圖截圖**逐像素差異最大值僅 3**（差異範圍正好落在那張會呼吸的
高亮桌次上，是 2.1s 動畫的取樣相位差），尺寸相同 732×1316 —
證明 v61 沒有改動座位圖的繪製結果。

**D. `index.html`**：沒有任何連到 `seating.html` 的連結，也沒有載入任何座位表 script。

### ⚠️ 無法端到端驗證的部分（需要您手動完成一次）

Apps Script 的 Web App 部署**只能由您在瀏覽器完成**（沒有任何 API 可以代替建立
Apps Script 專案或核發 `/exec` 網址）。因此：

- 本版已把 `js/seating-config.js` 的 `API_URL` 留為 `""` — 網站上線後座位表頁
  **會安全地顯示備援名單**，不會空白、不會壞掉。
- 前端解析與繪製邏輯已用**模擬 JSON**（成功／HTTP 500／逾時／未設定四種）驗證通過。
- 真實試算表的 `doGet` 讀取已用離線 stub 完整驗證，但**未對真實試算表執行過**。

### 部署步驟（一次設定，之後永久自動）

1. 開啟**問卷回覆試算表** → 功能表 **擴充功能 → Apps Script**。
2. 把 `scripts/seating-from-sheet.gs` 的內容整份貼上，存檔。
   （`SPREADSHEET_ID` 已填入本專案使用的試算表 ID，通常不需修改；
   若問卷回覆在別的試算表，改這一行即可。）
3. 右上 **部署 → 新增部署 → 類型選「網頁應用程式」**
   → 執行身分選 **我** → 誰可以存取選 **所有人**
   → **部署** → 授權。
4. 複製產生的網址，**結尾必須是 `/exec`**（不是 `/dev`；`/dev` 只有您本人能用）。
5. 開啟 `js/seating-config.js`，把該網址填入 `API_URL: ""` 裡面，然後重新部署網站。
6. **驗證**：直接用瀏覽器開啟那個 `/exec` 網址，應該看到
   `{"ok":true, "version":"seating-v61", ...}` 的 JSON。
   也可以開 `.../exec?format=health` 看簡短的健康檢查。

> 小技巧：把 `/exec` 網址貼回來給我，我可以幫您填進 `seating-config.js` 並重新部署。

> 之後若修改了 Apps Script，記得 **管理部署 → 編輯 → 版本選「新版本」**，
> 否則線上仍會執行舊程式碼。

---

## 其他說明

- **未新增或修改任何 GitHub Actions workflow**，部署沿用既有 `deploy-site.yml`。
- 本版**未**在 `index.html` 新增任何座位表入口（座位表仍為獨立頁、`noindex`）。
- `index.html` 的 `site-version` 標記仍是 `v59`，與 v60／v61 不一致 ——
  這是先前版本遺留的落差；因本版不需動到首頁，為避免風險**刻意未修改**，於此註明。
