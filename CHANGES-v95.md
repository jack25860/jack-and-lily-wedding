# v95 — 按鈕文字置中（水平 ＋ 垂直）

**線上網址（未新增任何網址）**：https://jack25860.github.io/jack-and-lily-wedding/
**基準**：GitHub Pages 線上 v94（`site-version` meta 實測 = v94）
**方式**：依 TASK CONTINUATION 複製為 v95 後修改，v93 / v94 檔案一字未動

---

## 一、量測方法（為什麼之前的檢查沒抓到）

肉眼與 `align-items:center` 都不足以判斷「字是否在框內置中」——`align-items:center`
對齊的是**行盒**，不是**字**。因此本輪改用**像素級墨跡框**量測：

1. 對每個控制項截圖（device_scale_factor = 4）
2. 再把所有文字與 SVG 設為 `transparent`，對同一個元素截第二張
3. 兩張相減 → 差值遮罩就是**可見字形真正佔的區域**
4. 比較「按鈕框中心」與「墨跡中心」的 dx / dy

這個方法不依賴任何字型度量假設，因此能抓到 `line-height` 與字型 fallback 造成的偏移。

環境：真實 Chromium（Playwright），桌機 1440×900。

---

## 二、根因（兩個，皆經 A/B 實測確認）

### A. 垂直偏上 ─ `line-height` 由 `body` 繼承，不是字面高度

```css
body { line-height: 1.9 ~ 1.95 }      /* v93 起 */
```

這條一路繼承進 `.btn` / `.note-card__link` / `.nav__link`。
12px 的字因此住進 **22.8px** 的行盒，多出的 ~10.8px「半 leading」上下等分。

但字型自身的 ascent / descent **並不對稱**（Cinzel ≈ 0.98em / 0.22em），
墨跡重心因此高於行盒中心 —— 於是 `align-items:center` 把「行盒」置中了，
「字」卻看起來偏上。

**實測**：送出祝福 **−1.48px**、查看座位表 **+1.02px**。

> 為什麼使用者看得到、而 Linux CI 只量到 1px？
> 訪客機器若 fallback 到 Songti / PingFang（字面重心更低），同一條 1.9 會把偏差**放大**。
> 我用 `@font-face{src:local('__none__')}` 強制走 fallback 鏈重測：
> v94 的 dy 由 1.0→**1.91px**、dx 由 1.0→**1.65px** 明顯惡化。
> 也就是說，原設計把「偏移量」交給了訪客的作業系統決定。

### B. 水平偏左 ─ `letter-spacing` 在字尾多留一格

CSS 的 `letter-spacing` 會在**最後一個字之後也加一個字距**。
當標籤交由 flex 置中時，行盒含這段尾端空隙，可見字形因此**偏左 ½ 字距**。

專案原本只在 `.btn` 用 `text-indent:.28em` 抵掉；其餘全部漏掉：

| 選擇器 | letter-spacing | text-indent（v94） | 實測偏左 |
|---|---|---|---|
| `.btn` | .28em | .28em ✅ | 0.00px |
| `.nav__link` | .24em | **缺** ❌ | **+1.74px** |
| `.totop__text` | .24em | **缺** ❌ | **+1.61px** |
| `.fontctl__opt` | .08em | **缺** ❌ | +0.5px |

---

## 三、修正內容（只動對齊，不動尺寸）

新增 `css/v95-buttons.css`（`index.html` / `seating.html` / `ecard-video.html` 皆已引入）。

```css
/* 1. 單行標籤：行盒 = 字面高度 */
.btn, .nav__link, .note-card__link, .totop__text, .fontctl__opt, … {
  line-height: 1;
}

/* 2. 支援的引擎再把行盒裁到 cap-height / 基線 → 真正的字形置中 */
@supports (text-box-trim: trim-both) {
  .btn, .nav__link, … {
    text-box-trim: trim-both;
    text-box-edge: cap alphabetic;
  }
}

/* 3. 抵掉 letter-spacing 在字尾多留的那一格 */
.nav__link   { text-indent: .24em; }
.totop__text { text-indent: .24em; }

/* 4. 用 min-height 鎖回 v94 實測盒高，padding 完全不動 */
.btn { min-height: calc(32px + 1.9em); }   /* 54.8px，與 v94 相同 */
```

**關鍵取捨**：`line-height:1` 會讓盒高變矮，所以用 `min-height: calc(padding + border + 原行盒)`
把高度鎖回去 —— **置中修好了，尺寸一格沒變**（見下表 box h 欄）。

不支援 `text-box-trim` 的瀏覽器（Firefox）會自動略過那段 `@supports`，
只靠 `line-height:1` + 對稱 padding，仍有 ≤1px 誤差，不會破版。

---

## 四、修正前後數據（真實瀏覽器，1440×900，像素級墨跡框）

dx = 文字墨跡中心相對按鈕框中心的水平偏移（正 = 偏左）
dy = 垂直偏移（正 = 偏下）

| 控制項 | v94 dx | v94 dy | **v95 dx** | **v95 dy** | 盒高 |
|---|---|---|---|---|---|
| 送出祝福 `.btn` | +0.00 | **−1.48** | +0.00 | **−0.48** | 50 → 50 |
| 查看座位表 `.note-card__link` | +0.12 | **+1.02** | +0.12 | **+0.03** | 43 → 43 |
| 展開相簿 `.gtheme__toggle` | +0.37 | −0.62 | **−0.12** | +0.25 | 52 → 52 |
| ↑ TOP `.totop` | **+1.61** | **+1.87** | **+0.12** | +0.93 | 62 → 62 |
| THE WEDDING `.nav__link` | **+1.74** | −0.26 | **−0.25** | −0.25 | 35 → 35 |

### 全站逐顆量測（v95，桌機 1440）

`index.html` — 22 個帶字控制項

| 控制項 | 尺寸 | dx | dy |
|---|---|---|---|
| 開啟 Google Maps ×3 | 226×55 / 202×47 / 261×55 | −0.2 / −0.2 / −0.8 | −0.1 / −0.1 / −0.0 |
| 送出祝福 | 133×50 | 0.0 | −0.5 |
| 導覽 6 項 | 42–119×35 | −0.0 ~ −0.8 | −0.1 ~ −0.3 |
| 送出回覆 RSVP | 270×80 | +0.2 | −0.7 |
| 寄送喜帖邀請信 | 236×70 | 0.0 | −0.5 |
| 查看座位表 | 119×43 | +0.2 | 0.0 |
| Tt 字級鈕 | 50×50 | 0.0 | +0.5 |
| ↑ TOP | 63×62 | +0.2 | +0.8 |
| 展開相簿 ×3 | 244×52 | −0.2 | +0.5 / +0.5 / +1.5 |

`seating.html`：查詢座位 678×58 → dx **+0.2**、dy **−0.8**
`ecard-video.html`：← 回到婚禮網站 167×51 → dx **−0.5**、dy **+0.7**

> `music__btn` / `sound__btn` 的 dx 顯示 −12.5 是量測構面的差異：
> 該鈕是「圖示 + 文字」的群組，文字本身不在框心是**設計如此**。
> 改以內容群組量測，左右留白為 21.0 / 21.0 px、偏移 **0.00** — 群組是置中的。

### 後備字型（模擬訪客 OS，強制 Songti / PingFang fallback）

| | maxAbs dx | maxAbs dy |
|---|---|---|
| v94 線上 | 1.65px | **1.91px** |
| **v95** | **1.16px** | **0.97px** |

偏移不再隨訪客字型放大 —— 這是「使用者看到的問題」被真正解決的證據。

---

## 五、回歸驗證（無破版）

| 頁面 | 375px | 320px | 768px | 1440px |
|---|---|---|---|---|
| index.html | 溢位 0 | 溢位 0 | 溢位 0 | 溢位 0 |
| seating.html | 溢位 0 | 溢位 0 | 溢位 0 | 溢位 0 |
| ecard-video.html | 溢位 0 | 溢位 0 | 溢位 0 | 溢位 0 |

- 破圖 **0**、JS error **0**（全 9 組）
- 所有按鈕盒高與 v94 **完全相同**（見上表 box h 欄）

---

## 六、變更檔案

| 檔案 | 變更 |
|---|---|
| `css/v95-buttons.css` | **新增**（唯一新增檔） |
| `index.html` | 加 `<link>` 至 v95 CSS、`site-version` → v95 |
| `seating.html` | 同上 |
| `ecard-video.html` | 同上 ＋ 頁內 `#v95-page-scope`（該頁 `.btn` 自成一格，維持原盒高） |
| `CHANGES-v95.md` | 本報告 |

**未動**：`css/styles.css`、`css/v93-typography.css`、`css/v94-story.css`、所有 JS、所有圖片。

---

## 七、截圖

- `img/before_after_buttons.png` — 5 顆關鍵按鈕 4× 放大前後對照（藍線=框中心、紅線=墨跡中心、橘框=可見字形）
- `img/mobile_375.png` — 手機 375px 實拍
