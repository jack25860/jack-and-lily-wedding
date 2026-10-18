# 婚禮網站 v88 修正紀錄

線上網址：https://jack25860.github.io/jack-and-lily-wedding/
修正基準：v87（線上版本，md5 已核對一致）

---

## 一、燈箱左右切換鈕未垂直置中

### 症狀
點開照片後，左（‹）右（›）兩顆切換鈕與照片的垂直中心不對齊，在電腦版與手機版都看得出來 —— 按鈕相對照片「偏低」。

### 以真實瀏覽器量測（Playwright + Chromium）

| 版本 | 視窗 | 燈箱中心 | 照片中心 | 左鈕中心 | 右鈕中心 |
|---|---|---|---|---|---|
| v87 | 1440×900 | 450.0 | **427.8** | 450.0 | 450.0 |
| v87 | 390×844 | 422.0 | **400.1** | 422.0 | 422.0 |

也就是說：**箭頭本身正確地位在視窗正中央（Δ=0），偏掉的是「照片」—— 照片比中心高了 21.9～22.2px**，所以肉眼看起來像箭頭偏低。

### 根因（兩層）

1. **`.lb-cap`（圖說）是 `.lb-stage` 的文件流子元素。**
   `.lb-stage` 的高度 = 照片高度 + 圖說高度 + `margin-top:20px`。燈箱把整個 stage 垂直置中後，照片被往上推了（圖說高度的一半＋margin），照片中心因此離視窗中心約 22px。箭頭用 `top:50%` 對齊的是「視窗」，於是與照片中心錯開。

2. **`.lb-stage` 只設了 `min-height`，沒有垂直對齊。**
   直幅照片（4640×6960）時 stage 被撐高，看不出來；換成橫幅照片（6960×4640）時，照片貼齊 stage 頂端，照片與箭頭的相對位置大幅跳動。

### 修正

```css
/* 修改前 */
.lb-stage{position:relative;max-width:min(1180px,92vw);max-height:88vh}
.lb-cap{text-align:center;margin-top:20px;...}

/* 修改後 */
.lb-stage{position:relative;display:flex;align-items:center;justify-content:center;
          max-width:min(1180px,92vw);max-height:88vh}
.lb-cap{position:absolute;top:100%;left:0;right:0;margin-top:14px;...}
```

- **stage 改 flex 垂直置中** → 照片永遠在 stage 正中，任何長寬比都不再位移。
- **圖說改絕對定位**（`top:100%` 掛在照片下方）→ 脫離文件流，stage 高度 = 照片高度 → **照片中心 = 視窗中心 = 箭頭中心**。
- 手機版圖說字級／字距微調，避免貼邊。
- `.lb-cap{pointer-events:none}` 避免圖說區塊攔截點擊。

### 修正後量測（Δ = 按鈕中心 − 燈箱中心）

| 視窗 | 照片 | 燈箱中心 | 照片中心 | 左鈕 | 右鈕 | Δ左 | Δ右 | 結果 |
|---|---|---|---|---|---|---|---|---|
| 1440×900 | 4640×6960（直） | 450 | 450 | 450 | 450 | 0.0px | 0.0px | PASS |
| 1440×900 | 6960×4640（橫） | 450 | 450 | 450 | 450 | 0.0px | 0.0px | PASS |
| 390×844 | 4640×6960（直） | 422 | 422 | 422 | 422 | 0.0px | 0.0px | PASS |
| 390×844 | 6960×4640（橫） | 422 | 422 | 422 | 422 | 0.0px | 0.0px | PASS |

橫直幅互換時數值完全不變 —— 位置不再跳動。

---

## 二、相簿預設只展示「兩人合照」

### 做法
1. **視覺辨識 137 張照片**：以 4×4 標註縮圖拼板（每格標檔名）分批送視覺模型，逐格判定 `people=n` 與 `COUPLE / SOLO / GROUP / SCENERY / DETAIL`。
2. 依判定結果重建 `js/config.js` 的 `GALLERY_THEMES`：
   - `FEATURED` = 雙人合照（預設顯示）
   - `MORE` = 其餘照片（收進「展開相簿」）
   - `ALT` 依新順序重編（`<主題> <序號>`）
3. 三個主題的**總數不變**，只是預設可見的數量改變。

| 主題 | 總數 | 預設顯示（雙人） | 展開後新增 |
|---|---|---|---|
| 戰國 | 36 | 15 | 21 |
| 唐代 | 45 | 31 | 14 |
| 明朝 | 56 | 37 | 19 |
| **合計** | **137** | **83** | **54** |

### 按鈕文案
- 修改前：`展開全部 21 張相簿`（語意不清，且與「相簿」量詞不符）
- 修改後：`展開相簿 · 另有 21 張` / 展開後 `收合相簿`
- 加入 `aria-label`，並在相簿引言下方新增一行淡金色提示：
  「預設只呈現兩人的合影；其餘的影像，收在相簿裡，點開即可看見。」

### 驗證

| 檢查 | 桌機 1440×900 | 手機 390×844 |
|---|---|---|
| 預設可見張數 | 83（其中雙人 83/83） | 83（83/83） |
| 展開後可見張數 | 137 / 137 | 137 / 137 |
| `aria-expanded` 切換 | false → true | false → true |
| 展開區 `hidden` | true → false | true → false |
| 破圖 | 0 / 137 | 0 / 137 |
| 水平溢位 | scrollWidth 1440 = clientWidth 1440 | 390 = 390 |
| Console 錯誤 | 0 | 0 |

---

## 三、順帶修正：重複開啟燈箱的計時器競態

`closeLb()` 原本用 `window.setTimeout(...,760)` 在淡出後設 `hidden`。
若在 760ms 內重新點開照片，這個「舊的」計時器仍會執行，把剛打開的燈箱又設回 `hidden` —— 症狀是「有時點了沒反應」。

修正：把計時器存進 `lbCloseTimer`，`openLb()` 開頭先 `clearTimeout`。並且發現 `lbCloseTimer` 未宣告會拋 `ReferenceError`（實測會讓整個 gallery 的 click 綁定失效），已一併補上 `var ... lbCloseTimer=null` 宣告。

---

## 四、未變更的部分（確認無回歸）

- 137 張照片檔案**完全未重新編碼**（`images/album/**` 與 `originals-v86/**` 皆未動）。
- 燈箱原檔仍為 4640×6960（`originals-v86`），切換照片時即時換上對應原檔：實測 `warring-01 → warring-02 → warring-10 → warring-11` 逐張對應正確。
- v87 的其他修正（RSVP token、audio preload、焦點管理、SEO、overflow-x）皆保留。

---

## 五、檔案變更

```
index.html          版本標記 v87→v88；新增相簿說明一行
css/styles.css      .lb-stage flex 置中、.lb-cap 絕對定位；手機版圖說微調；相簿提示樣式
js/app.js           展開按鈕文案／aria-label；lbCloseTimer 競態修正
js/config.js        GALLERY_THEMES 重排（FEATURED=雙人 83、MORE=其餘 54）
changelog/CHANGES-v88.md   本文件
```
