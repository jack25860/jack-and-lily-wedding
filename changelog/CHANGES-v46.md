# v46 變更說明 — 電子喜帖信件：GIF 直接內嵌、一打開就自動循環播放

**版本**：v46（由 v45 複製；v45 及更早版本皆未更動）
**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**部署**：沿用既有 `deploy-site.yml`（`workflow_dispatch` + `zip_url`）— **未新增、未修改任何 workflow**

---

## 一、使用者回饋與問題定位

> 「我要直接在裡面，一打開就可以看到，不是連結」

**截圖顯示**：信件中影片只是一個連結文字「**▶ 點此觀看電子喜帖影片**」，沒有直接顯示任何動態內容。

**根因（已查證）**：該連結文字是 **v34–v44 舊版模板**的用語。經查線上 Apps Script 端點：

```
GET /exec?diag=1  →  {"ok":true,"version":"v42","mailScope":true,"videoUrl":"", ...}
```

- 線上 Apps Script 仍是 **v42**（`videoUrl:""` → 走「以圖片代替」分支，只輸出一個連結）。
- **v45 的循環 GIF 從未被實際寄出** —— 因為 v45 的 `.gs` 從未貼上 Google 端（repo 內的 `.gs` 只是版本控管副本）。

也就是說：**問題不在 v45 的程式碼，而在 Google 端仍是舊版**。本次 v46 除了修正模板，也再次強調這個待辦。

---

## 二、v46 修正內容

### 1. 信件模板：GIF 直接內嵌顯示（主要呈現）

`scripts/rsvp-to-sheet.gs` 的 `videoTag` 改為：

- **主要呈現**：`<img src="https://…/media/ecard-loop.gif">` **直接內嵌顯示**，一打開信件即自動循環播放，**不需點擊**。
- **加分**：GIF 本身可點擊 → 連到網站播放頁 `ecard-video.html`（完整循環影片）；下方另有一行次要連結「▶ 點此觀看完整循環影片」。
- 使用**絕對公開網址**（非 `cid:` 內嵌附件 —— Gmail 網頁版不解析 `cid:`，且 CID 形式的 GIF 常只顯示第一格）。

### 2. 循環 GIF 最佳化（更適合信件）

| 項目 | v45 | **v46** |
|---|---|---|
| 尺寸 | 430 × 573 | **360 × 480** |
| 顏色 | 64 色 | **32 色** |
| 檔案大小 | 2,018,480 bytes（1.93 MB） | **1,328,676 bytes（1.27 MB）** |
| 影格 | 31 格、來回無縫循環 | 31 格、來回無縫循環（不變） |

**理由**：業界對「信件內動畫 GIF」的建議是**壓在 1–2 MB 以內**（Litmus／Mailmunch 等建議 1 MB 為實務上限），2 MB 對行動網路偏重。v46 縮至 **1.27 MB**，載入更快、更不易被信箱延遲或降級顯示。

### 3. 版本字串

`ENDPOINT_VERSION` → **`v46`**（`/exec?diag=1` 可驗證）。

---

## 三、技術限制（本次實作的前提，已實測確認）

1. **信件內無法自動播放 `<video>`**：Gmail／Outlook 等主流信箱**封鎖 `<video>` 標籤與 JavaScript**，`autoplay`／`loop`／`muted` 在信件內**完全不會生效**；Gmail 甚至會直接移除 `<video>` 標籤。
2. **`cid:` 內嵌附件在 Gmail 不解析**：以內嵌附件夾帶圖片，Gmail 網頁版不會顯示；CID 形式的 GIF 常只顯示第一格。
3. **唯一會被信箱自動播放的動態形式 = 以「公開網址」引用的動畫 GIF**（圖片不需 JS，各信箱皆支援並自動循環）。

> 佐證：[Can I Email](https://www.caniemail.com/)（Gmail／Outlook 不支援 `<video>`）、[Litmus：GIF 檔案大小建議](https://www.litmus.com/blog/animated-gifs-in-email-10-tips-for-keeping-files-sizes-small)、[Warmy：信件 GIF 最佳實務](https://www.warmy.io/blog/email-best-practices/animated-gifs-in-email)。

---

## 四、驗證結果

| 驗證 | 結果 |
|---|---|
| 信件 HTML 真實 Chromium 渲染（桌機 660×900 ＋ 行動版 390×844） | 見 `email_results.json` |
| GIF 以 `<img>` **直接內嵌顯示**（非僅連結） | ✅ |
| GIF 來源為**絕對公開網址**（非 `cid:`） | ✅ |
| **GIF 逐格在動**（像素比對，每格變化 > 1%） | ✅ |
| 點擊 GIF 可連到網站播放頁（加分） | ✅ |
| 婚紗照正常顯示（無破圖） | ✅ |
| 無水平捲動、無 console error、無 pageerror | ✅ |
| 公開存取（外部收件人視角，無授權標頭） | GIF `image/gif 200`、播放頁 `text/html 200` ✅ |

---

## 五、⚠️ 使用者待辦（必要，否則電子喜帖仍不會寄出／仍是舊版）

**這是本次問題的真正根因。** repo 裡的 `scripts/rsvp-to-sheet.gs` 只是版本控管副本；**部署到 GitHub Pages 不會更新 Google 端的 Apps Script 專案**。目前 Google 端仍是 **v42**。

請執行（約 2 分鐘）：

1. 開啟回覆試算表 → 「擴充功能」→「Apps Script」
2. 將 `scripts/rsvp-to-sheet.gs`（**v46 全文**）貼上並儲存
3. 函式選 **`testEcard`** → 執行 → 同意 **Gmail 寄信權限**
4. 「部署」→「管理部署」→ 編輯現有部署 → 版本選「**新版本**」→ 部署
5. 若產生新網址，填入 `js/config.js` 的 `SHEET_WEBAPP_URL` 並重新部署網站

**驗證方式**：開啟 `/exec?diag=1`，出現 `"version":"v46"` 且 `"mailScope":true` 即完成。

---

## 六、變更檔案（v46）

| 檔案 | 變更 |
|---|---|
| `scripts/rsvp-to-sheet.gs` | 信件模板：GIF **直接內嵌顯示**（主要呈現）＋ 點擊為次要連結；`ENDPOINT_VERSION` → `v46` |
| `media/ecard-loop.gif` | 最佳化：430×573／64 色／1.93 MB → **360×480／32 色／1.27 MB** |
| `CHANGES-v46.md` | 新增 |

**維持不變**：酒紅 `#6E1626`／金 `#C9A961`／宣紙米色；RSVP 送出流程；電子喜帖為**手動寄送**、信件內直接內嵌圖片與隨機婚紗照（**142 張全池**）；大人出席人數上限 10 人；電子喜帖去重窗期 8 秒；寄送成功後清空輸入框；結婚預告片倒數文案；婚禮當日注意事項區塊。
