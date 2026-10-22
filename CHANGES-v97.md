# v97 — 「三生三世」章節標籤（第一世／第二世／第三世）重新設計

**上線網址**：https://jack25860.github.io/jack-and-lily-wedding/
**版本**：v96 → **v97**（依 TASK CONTINUATION：v96 複製為 v97 後修改，v96 目錄未動）
**只動**：`index.html`（版本標記 + 一行 CSS 引用）、`css/v97-lives.css`（新增）

---

## 一、問題：不是「顏色選得不好」，是「文字被放在它無法控制的底色上」

用真實 Chromium（1440×900 / 390×844）量測 v96 線上站，`.tl-panel__no` 的實際渲染值：

| 屬性 | v96 實測值 | 問題 |
|---|---|---|
| `color` | `#E3A9B2`（`--wine-on-dark`） | **深底專用的「提亮酒紅」被拿到照片上用**，實體上是淺粉紅 |
| `font-size` | 14px | 合規，但它是全章節最弱的字 |
| `font-weight` | **300** | 襯線細體 ＋ 粉色 ＋ 疊在照片上 = 三重稀釋 |
| `letter-spacing` | **7px**（0.5em） | 三個字被拉成 84px 寬，與相鄰 44px 主標「相遇」的字距（11.44px／0.26em）**節奏完全不同** |
| `background` | 無 | 直接壓在照片上 |
| `filter` | `none`（v93 已移除舊的 `brightness(1.9)`） | 目前沒有補償 |

### 真正的根因：對比度隨「背後那張照片」浮動

三張照片亮度不同，同一條粉色在三張上的對比都不一樣。實測（隱藏字形後取該區域的真實合成底色，取 mean / p95 / 最亮像素）：

| 視窗 | 第一世 | 第二世 | 第三世 |
|---|---|---|---|
| 1440×900 | mean 4.24 / **最差 2.20** | mean 3.65 / **最差 2.18** | mean 4.83 / **最差 2.47** |
| 390×844 | mean 4.68 / **最差 2.13** | mean 3.49 / **最差 2.57** | mean 4.47 / **最差 3.02** |

**六個取樣點全部未達 WCAG AA 4.5:1**，最差只有 **2.13:1**。

這也解釋了為什麼「看起來突兀」：它在照片暗處還算讀得到，一到亮處（照片的霧氣、天光、水面）就整片消失 —— 同一組字在同一個區塊裡**時而可見、時而隱形**，眼睛會覺得「這幾個字不屬於這裡」。

> 這是**結構性**問題，不是色票選錯。所以 v97 不換顏色，而是**給文字一個它自己控制的底**。

---

## 二、解法：酒紅底 ＋ 金細框的「小籤牌」

站上已經有這個語彙 —— `.trailer__tag`（電影標籤）、`.rsvp__fields li`（圓角籤）都是同一套做法。v97 讓章節標籤加入它們，而不是繼續當「壓在照片上的裸字」。

```css
.tl-panel__no{
  display: inline-flex; align-items: center; justify-content: center;
  padding: 6px 18px;
  border: 1px solid rgba(201,169,97,.52);
  border-radius: 2px;                                    /* 與 .btn / .trailer__tag 一致 */
  background: linear-gradient(180deg, rgba(42,10,17,.94), rgba(42,10,17,.88));
  box-shadow: 0 8px 22px -12px rgba(0,0,0,.85), 0 0 0 1px rgba(201,169,97,.10) inset;

  font-size: 14px;                                       /* 中文不動的下限 */
  font-weight: 500;                                      /* Noto Serif TC 只實際載入 300/400/500 */
  line-height: 1.5;
  letter-spacing: .14em;                                 /* 14px × .14 = 1.96px（原 7px） */
  text-indent: .14em;                                    /* 抵掉行尾多出的那一格字距 */
  color: var(--gold-light);                              /* #EBDCB6 */
  filter: none; text-shadow: none;
  margin-bottom: 20px;
}
@media (max-width: 640px){
  .tl-panel__no{ padding: 5px 14px; letter-spacing:.12em; text-indent:.12em; margin-bottom:16px; }
}
```

三個設計決定：

1. **底色 88–94% 不透明**：對比與照片徹底脫鉤，不再有任何「看運氣」的區間。
2. **金 `#EBDCB6` 而非粉紅**：`--gold-light` 本來就是深底上的標準字色（`.btn`、`.tl-panel__en` 都用它）。標籤回到「金色 ＋ 酒紅 ＋ 米白」的主色系，突兀感消失。
3. **字距 7px → 1.96px**：標籤是「第幾世」的索引，不是裝飾性押韻。收斂後與 44px 主標的字距比例接近，層級變得清楚：**籤牌 14px → 英文小標 12px 大寫 → 主標 44px**。

---

## 三、修正後實測（同一套量測方法、同一捲動位置）

| 視窗 | 標籤 | v96 最差對比 | **v97 最差對比** | 尺寸（w×h） | 字級／字重／字距 |
|---|---|---|---|---|---|
| 1440×900 | 第一世 | 2.20 ❌ | **12.77 ✅** | 87.8 × 35 | 14px / 500 / 1.96px |
| 1440×900 | 第二世 | 2.18 ❌ | **12.65 ✅** | 87.8 × 35 | 14px / 500 / 1.96px |
| 1440×900 | 第三世 | 2.47 ❌ | **12.71 ✅** | 87.8 × 35 | 14px / 500 / 1.96px |
| 390×844 | 第一世 | 2.13 ❌ | **12.78 ✅** | 78.7 × 33 | 14px / 500 / 1.68px |
| 390×844 | 第二世 | 2.57 ❌ | **12.49 ✅** | 78.7 × 33 | 14px / 500 / 1.68px |
| 390×844 | 第三世 | 3.02 ❌ | **12.59 ✅** | 78.7 × 33 | 14px / 500 / 1.68px |

- **對比 2.13–3.02:1 → 12.49–12.78:1**（約 5 倍），全部遠超 AA 4.5:1，也超過 AAA 7:1。
- **三張照片、六個取樣點全部落在 12.49–12.78 的窄帶內** —— 這正是「不再受照片影響」的證據。
- 中文 **14px**，符合「中文不小於 14px」。

### 文字色實際值
`#EBDCB6` on `#2C0F15 ~ #2F1218`（合成後實測底色）→ 12.49–13.14:1

---

## 四、回歸檢查

### 1. 我們的故事（`.chapter__no`）完全未受影響
v97 只選擇 `.tl-panel__no`，`.chapter__no` 實測仍是：`14px` / `rgb(110,22,38)` / 無背景 / 無邊框（= v96 原樣）。

### 2. 溢位與破版

| 頁面 | 320 | 390 | 768 | 1024 | 1440 |
|---|---|---|---|---|---|
| index.html | 0px | 0px | 0px | 0px | 0px |
| seating.html | 0px | 0px | 0px | 0px | 0px |
| ecard-video.html | 0px | 0px | 0px | 0px | 0px |
| ecard-email-preview.html | 0px | 0px | 0px | 0px | 0px |

- **JS error：0**（全 20 組）
- **破圖：0**（`broken=1` 是站上一個 `src=""` 的空 `<img>`，v96 線上完全相同，非本次引入）

### 3. 文件差異（逐行 diff）
```
4c4
< <meta name="site-version" content="v97">
---
> <meta name="site-version" content="v96">
112d111
<   <link rel="stylesheet" href="css/v97-lives.css">
```
`index.html` 僅此兩處變動。`seating.html`、`ecard-video.html`、所有 JS、所有圖片、`styles.css`、`v93/v94/v95/v96` 各層 CSS **皆未觸碰**。

---

## 五、檔案

| 檔案 | 動作 |
|---|---|
| `css/v97-lives.css` | **新增** |
| `index.html` | 版本標記 v96→v97、新增一行 CSS 引用 |
| `CHANGES-v97.md` | 本報告 |

**未動**：`styles.css`、`v93-typography.css`、`v94-story.css`、`v95-buttons.css`、`v96-circle.css`、`seating.html`、`ecard-video.html`、`ecard-email-preview.html`、`js/*`、`images/*`
