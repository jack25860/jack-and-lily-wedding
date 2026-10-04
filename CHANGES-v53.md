# v53 變更說明 — 修正使用者回報的 Android 專屬影片播放問題（電子喜帖反覆跳回開頭）

**正式站**：https://jack25860.github.io/jack-and-lily-wedding/
**電子喜帖頁**：https://jack25860.github.io/jack-and-lily-wedding/ecard-video.html
**Repo**：jack25860/jack-and-lily-wedding（main）
**版本**：v53（由 v52 複製為新版本；v52 及更早版本皆保持不變）
**部署**：沿用既有 `deploy-site.yml`（`workflow_dispatch` + `zip_url`）— **未新增、未修改任何 workflow**

---

## 使用者回報（v52 上線後，附實機錄影）

- 結婚網站 `index.html`：**已沒問題**。
- 電子喜帖頁 `ecard-video.html`：**仍有問題，且只在 Android 手機上發生，iPhone 正常**。使用者形容「像影片一樣」有問題（影片播放異常）。

實機錄影顯示：影片播放中會**反覆跳回開頭**（畫面不斷重播前幾秒），音樂持續，但影片時間軸被反覆歸零。

---

## 一、根因（Android Chrome 專屬）

v52 的「硬性看門狗」每 400ms 檢查一次，其中新增了一段邏輯：

> 播放中但 `currentTime` 完全沒有前進（連續 8 次，約 3.2 秒）→ 強制 `load()` 並續播。

在 **Android Chrome** 上，行動網路／省電模式／緩衝期間，`currentTime` 常會短暫停頓（`stalled`／`waiting` 事件序列與 iOS Safari 不同）。於是看門狗誤判為「解碼卡死」，**反覆呼叫 `load()`**，而 `load()` 會把影片重新載入並歸零 → 影片不斷跳回開頭。iPhone 因事件序列不同，未觸發此誤判，故正常。

**以真實瀏覽器（Playwright，Android Chrome UA + 節流至 400kbps）重現：**

| 版本 | 慢速網路下 `load()` 呼叫次數 | 影片跳回開頭次數 |
|---|---|---|
| v52 | **7 次**（每約 3.2 秒一次） | 反覆跳回 |
| **v53** | **0 次** | **0 次** |

---

## 二、修正內容（`ecard-video.html` 頁內腳本）

| 項目 | v52 | **v53** |
|---|---|---|
| 播放中 `currentTime` 未前進 | 連續 8 次即 **`load()` 重新載入**（Android 反覆跳回開頭的元凶） | **完全移除**；絕不因緩衝而重新載入影片 |
| 看門狗 | 每 400ms；`paused`／`ended` 就 `play()`；另有上述 `load()` 邏輯 | 每 500ms；**只在真正 `paused` 時 `play()`**，並加入 300ms 節流避免 `play()` 風暴 |
| 觸碰事件監聽 | `click／pointerdown／mousedown／touchstart／touchend／dblclick` | 移除 `touchend／dblclick／mousedown`，避免與瀏覽器原生播放／暫停互相打架 |
| 初始強化 | `playsInline`／`preload="auto"`／必要時 `load()` | 維持不變 |
| 緩衝自我修復 | `pause／stalled／waiting／suspend／emptied／abort` → `resume()` | 維持不變（但 `resume()` 不再 `load()`） |
| 續播時機 | `visibilitychange／focus／pageshow／scroll` | 維持不變 |
| 循環 | `ended` → `currentTime=0` 續播 | 維持不變 |
| 音效 | `muted=false`、`volume>0`；頁面不提供任何音效開關 | 維持不變（政策擋下時於首次互動自動解除靜音） |

**核心原則**：看門狗只負責「把被暫停的影片重新播放」，**永不**以重新載入（`load()`）作為修復手段 —— 那正是 Android 上影片反覆跳回開頭的原因。

---

## 三、維持不變

酒紅 `#6E1626`／金 `#C9A961`／宣紙米色；RSVP 送出流程；電子喜帖手動寄送、142 張全池隨機婚紗照；大人上限 10 人；去重窗期 8 秒；寄送成功後清空輸入框；結婚預告片倒數文案；婚禮當日注意事項區塊；信件內嵌循環 GIF 的呈現方式。**結婚網站 `index.html` 未變更。**

---

## 四、驗證（真實瀏覽器，Android Chrome UA + 觸控）

以 Chromium（Playwright）模擬 Android Chrome（Pixel 7 UA、412×915、`is_mobile`、`has_touch`）：

- **連續播放**：取樣 24 秒（> 影片 18.2 秒），`stuck=0`、成功循環 1 次、`ended` 從未為真。
- **慢速網路（400kbps）**：`load()` 呼叫 **0 次**、影片跳回開頭 **0 次**、console 錯誤 0。
- **卡住自我修復**：外部 `pause()`、真實點擊影片、`stalled`+`waiting`、分頁隱藏→顯示，四種來源皆於約 1.5 秒內恢復播放且時間軸持續前進。
- **滑動／觸碰**：連續滑動與觸控點擊後，影片仍持續播放、未停止。
- **音效**：放寬自動播放政策時 `muted=false`、`volume>0`、`paused=false`，且 `webkitAudioDecodedByteCount>0`（確實解碼音訊）；預設政策下首次真實點擊即解除靜音並持續播放。
- **版面**：`scrollWidth === clientWidth`（無水平溢出）、console 錯誤 0、影片與海報素材皆回傳 200。

---

## 五、⚠️ 使用者待辦（必要）

**Google 端 Apps Script 專案仍無需更新** —— 本次 v53 僅變更前端 `ecard-video.html`，未變更 Apps Script 內容；若先前已完成授權則無需重做。`scripts/rsvp-to-sheet.gs` 放在 repo 只是版本控管副本，部署網站到 GitHub Pages 不會更新 Google 端專案。
