# v45 — 電子喜帖「信件中自動循環播放」

**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**版本**：v45（由 v44 複製；**v44 及更早版本皆未更動**）
**部署**：沿用既有 `deploy-site.yml`（`workflow_dispatch` + `zip_url`）— **未新增、未修改任何 workflow**

---

## 一、素材檢視（使用者提供的影片）

| 項目 | 量測值 |
|---|---|
| 檔名 | `file-1791081554733-vnuqv58t-mmexport1791081345203.mp4` |
| 長度 | 18.23 秒 |
| 尺寸 | 2160 × 2880（直式 3:4） |
| 影格率 | 50 fps |
| 編碼 | HEVC（影像）＋ AAC（音訊） |
| 原始大小 | 87.6 MB |

**內容**：正式的電子喜帖影片。畫面自酒紅色的「囍」字封印開場，依序為中式大囍剪紙底紋、彩繪花鳥、雙喜剪紙，中段花瓣粒子紛飛間浮現「**我們結婚了 · 2027-04-17**」，其後為新人的婚紗影像，最後收在「**王宥岑 & 杜伊穠**」與喜宴資訊。

**結論：內容完全適合作為電子喜帖的循環播放素材**（即是喜帖本體），故採用。

---

## 二、先確認的技術限制（本次實作的前提）

需求是「電子喜帖要在信件中**自動循環播放**」。實測與查證後確認：

1. **信件內無法自動播放 `<video>`**：Gmail（網頁／Android／iOS）、Outlook（Windows 版／Outlook.com／iOS／Android）、Yahoo Mail 等主流信箱**封鎖 `<video>` 標籤與 JavaScript**，`autoplay`／`loop`／`muted` 屬性在信件內**完全不會生效**；即使內嵌技術上可行，信箱也一律**禁止自動播放音訊**，只會顯示靜態 fallback 圖。
2. **`cid:` 內嵌附件在 Gmail 不解析**：把 GIF 以內嵌附件（`cid:`）方式夾帶，Gmail／Yahoo 網頁版**不會顯示**；且 Outlook 等用戶端對動畫 GIF 亦常只顯示第一格。
3. **唯一會被信箱自動播放的動態形式 = 以「公開網址」引用的動畫 GIF**（圖片不需 JavaScript，各信箱皆支援，並自動循環）。

> 參考：[Can I Email — HTML video in email](https://www.caniemail.com/)（Gmail／Outlook 不支援 `<video>`）；[Email on Acid 信箱支援對照表](https://www.emailonacid.com/blog/article/email-development/a-how-to-guide-to-embedding-html5-video-in-email)；[CID 內嵌於 Gmail 的限制](https://resources.mailertogo.com/glossary/cid-attachment-email)。

---

## 三、最終採用的策略：**方案 A ＋ 方案 B 並用**

| 位置 | 作法 | 效果 |
|---|---|---|
| **信件內** | **循環 GIF**（`ecard-loop.gif`，公開網址引用）＋ 點擊後開啟網站播放頁 | 收信當下即自動循環播放；點擊看完整影片 |
| **網站播放頁** | `ecard-video.html`：`<video autoplay loop muted playsinline>` | **真正的自動循環播放**完整 18 秒影片 |

**為何兩者都做**：GIF 解決「信件內無法自動播放」的限制（所有信箱可見、自動循環），網站播放頁則提供完整、高畫質、真正 `loop` 的觀看體驗。GIF 以「公開網址」引用（非 `cid:` 附件），確保 Gmail 也能顯示。

### 素材製作參數

| 檔案 | 規格 | 大小 |
|---|---|---|
| `media/ecard-loop.gif` | **430 × 573**、6 fps、64 色、**來回（boomerang）無縫循環** | **1.96 MB** |
| `media/ecard-video.mp4` | 720 × 960、H.264 + AAC、`+faststart` | 4.4 MB |
| `media/ecard-video.webm` | 720 × 960、**VP9 + Opus**（H.264 無法解碼時的備援） | 6.7 MB |
| `images/ecard-video-poster.jpg` | 720 × 960 海報圖 | 161 KB |

- **GIF 循環技巧**：取影片 8.0–10.6 秒（花瓣紛飛、字卡浮現段），**正放後倒放拼接**，首尾影格完全相同 → 循環無跳格、無縫接軌。
- **檔案大小**：1.96 MB（符合 1–2 MB 目標），GIF 寬度 430px **低於建議的 600px 上限**，載入更快。
- 原始影片已壓縮為 720×960 的網路版（87.6 MB → 4.4 MB）。

---

## 四、變更檔案

| 檔案 | 變更 |
|---|---|
| `ecard-video.html` | **新增** — 網站端影片播放頁（直式 3:4 金框、酒紅／金／宣紙米色、自動循環播放＋暫停鈕、返回網站連結、RWD） |
| `media/ecard-loop.gif` | **新增** — 信件內自動循環播放的 GIF |
| `media/ecard-video.mp4` | **新增** — 網路版循環影片（H.264） |
| `media/ecard-video.webm` | **新增** — 備援影片（VP9 + Opus，供不支援 H.264 的瀏覽器） |
| `images/ecard-video-poster.jpg` | **新增** — 影片海報圖 |
| `scripts/rsvp-to-sheet.gs` | 信件 HTML：影片區塊改為「**循環 GIF ＋ 點擊看完整影片**」；新增 `ECARD_LOOP_GIF_URL`；`ECARD_VIDEO_URL` 填入播放頁網址；`ENDPOINT_VERSION` → `v45` |
| `js/config.js` | `ECARD_VIDEO_URL` 填入播放頁網址（原本為空字串） |

**維持不變**：酒紅 `#6E1626`／金 `#C9A961`／宣紙米色；RSVP 送出流程；電子喜帖為**手動寄送**、信件內直接內嵌圖片與隨機婚紗照（**142 張全池**）；大人出席人數上限 10 人；電子喜帖去重窗期 8 秒；寄送成功後清空輸入框；結婚預告片區塊（v44 倒數上映文案）；婚禮當日注意事項區塊。

### 影片格式備援（雙來源）

播放頁使用**雙來源**而非單一檔案，確保任何瀏覽器都能自動循環播放：

```html
<source src="media/ecard-video.mp4"  type="video/mp4">   <!-- H.264：Safari / iOS / 多數桌面瀏覽器 -->
<source src="media/ecard-video.webm" type="video/webm">  <!-- VP9：支援 VP9 但不含 H.264 解碼器的瀏覽器 -->
```

**為什麼需要 WebM？** 驗證時發現本機的開源 Chromium（Playwright headless shell）**不含 H.264 解碼器**，載入 MP4 時出現 `DEMUXER_ERROR_NO_SUPPORTED_STREAMS`，影片完全無法播放。真實使用者裝置（Safari／Chrome／Edge 正式版）皆有 H.264，MP4 即足夠；但加上 VP9 備援可讓**不含專利解碼器**的瀏覽器環境也能正常播放，屬提升相容性、非修補功能缺陷。播放器另於 `loadeddata` / `canplay` 時重試 `play()`，確保切換來源後仍自動循環。

---

## 五、待確認事項

- **影片頁 `ecard-video.html` 設為 `noindex`**：僅供喜帖信件連結使用，不希望被搜尋引擎收錄；若需被收錄請移除該 meta。

---

## 六、⚠️ 使用者待辦（必要，否則電子喜帖仍不會寄出）

**Google 端 Apps Script 專案目前仍是舊版且未授予 Gmail 寄信權限。** repo 裡的 `scripts/rsvp-to-sheet.gs` 只是版本控管副本；**部署到 GitHub Pages 不會更新 Google 端的 Apps Script 專案**。

請執行（約 2 分鐘）：

1. 開啟回覆試算表 → 「擴充功能」→「Apps Script」
2. 將 `scripts/rsvp-to-sheet.gs`（**v45 全文**）貼上並儲存
3. 函式選 **`testEcard`** → 執行 → 同意 **Gmail 寄信權限**
4. 「部署」→「管理部署」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
5. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL` 並重新部署網站

**驗證方式**：開啟 `/exec?diag=1`，出現 `"version":"v45"` 且 `"mailScope":true` 即完成。
