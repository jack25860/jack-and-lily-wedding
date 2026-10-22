# v98 —「三生三世」章節標籤：移除酒紅底＋金細框，改為 S4（羽化遮罩＋左右金色細線）

- 版本：v97 → **v98**
- 線上：https://jack25860.github.io/jack-and-lily-wedding/
- 基準：v97（線上 md5 與本機 `site_v97` 逐位元組一致後，複製為 `site_v98` 再改）
- 未動：`styles.css`、`v93-typography.css`、`v94-story.css`、`v95-buttons.css`、`v96-circle.css`、`v97-lives.css`、所有 JS、所有圖片、`seating.html`、`ecard-video.html`、`ecard-email-preview.html`

---

## 1. 為什麼要換掉 v97 的籤牌

v97 用「酒紅近不透明底 ＋ 1px 金框 ＋ 2px 圓角 ＋ 投影」處理 `.tl-panel__no`。它解決了可讀性（12.2–12.7:1），但使用者反映「圖框方式很突兀、沒有一致的美感」。盤點全頁 59 個四面帶框的元素後，原因有四層：

| 元素 | 尺寸 | 圓角 | 底色 | 載體 | 角色 |
|---|---|---|---|---|---|
| `.trailer__frame` 影片框 | 1354×761 | 0 | 實心深底 | 容器 | 內容容器 |
| `.venue-map` 地圖 | 1020×522 | 0 | 實心深底 | 容器 | 內容容器 |
| `.venue-photo` 場地照 | 495×… | 0 | 實心深底 | 容器 | 內容容器 |
| `.btn` 按鈕 | 260×55 | 2px | 透明 | 可點擊元件 | 互動 |
| `.rsvp__fields li` 膠囊 | 72×47 | 100px | 透明 | 可點擊元件 | 互動 |
| **`.tl-panel__no`（v97）** | **88×35** | **2px** | **近不透明** | **純文字標籤** | **純資訊** |

1. **語彙不合**：四框在此站只用於「內容容器」（且從不壓在照片上）或「可點擊元件」。v97 的籤牌是全站唯一「不透明底 ＋ 邊框 ＋ 投影」三重疊加的**純文字**元素。
2. **層級被倒轉**：「第幾世」是三級資訊，卻佔用了最高階的視覺訊號（邊界）。而 44px 主標、12px 英文小標、正文——整個面板沒有任何其他元素擁有「邊界」。
3. **兩種幾何語言描述同一件事**：`.tl-panel__content:before` 已有一條垂直金線；v97 再加上一個金色矩形框——都是金、都是 1px、形狀卻不同。
4. **框內 78% 是空的，且重複三次**：外框 88×35，三個字的墨跡只有 45×13（邊長為字寬的 1.96 倍、高度的 2.69 倍）。三張照片各一次，眼睛會讀成「三個平行區塊」，而非同一段落的三個序號。

---

## 2. v98 的做法（Technical Artist 的 S4）

- **無邊框、無圓角、無投影**
- **羽化 radial-gradient 深底**：`rgba(9,7,6,.94)` → `0`，最外圈 alpha = 0 ⇒ 不存在可看見的邊
- 字：`#EBDCB6` / 14px / 500 / `letter-spacing .14em` / `text-indent .14em`
- **左右各一條 26px 金色漸層細線**（手機 20px），與 `.section__head .eyebrow` 完全相同的語彙
- 手機斷點：`padding 15px 30px`、`letter-spacing .12em`、`gap .8em`

```css
.tl-panel__no{
  display:inline-flex; align-items:center; justify-content:center; gap:.92em;
  border:0; border-radius:0; box-shadow:none;
  background: radial-gradient(closest-side ellipse at 50% 50%,
      rgba(9,7,6,.94) 0%, rgba(9,7,6,.91) 46%,
      rgba(9,7,6,.62) 72%, rgba(9,7,6,.24) 88%, rgba(9,7,6,0) 100%);
  padding:17px 36px;
  color:var(--gold-light); font-size:14px; font-weight:500;
  line-height:1.5; letter-spacing:.14em; text-indent:.14em;
  text-shadow:none; filter:none; margin:0 0 20px;
}
.tl-panel__no::before,.tl-panel__no::after{content:"";display:block;width:26px;height:1px;flex:none}
.tl-panel__no::before{background:linear-gradient(90deg,rgba(201,169,97,0),rgba(201,169,97,.92))}
.tl-panel__no::after {background:linear-gradient(90deg,rgba(201,169,97,.92),rgba(201,169,97,0))}
@media (max-width:640px){
  .tl-panel__no{padding:15px 30px;gap:.8em;letter-spacing:.12em;text-indent:.12em;margin-bottom:16px}
  .tl-panel__no::before,.tl-panel__no::after{width:20px}
}
```

---

## 3. 量測方法（為什麼用「差分遮罩」而非顏色門檻）

第一版的遮罩用「綠色門檻」判斷字形像素，結果在第一張照片（tl1.jpg，山林）上嚴重誤判：深綠的樹葉滿足 `g>90 & r<90 & b<90`，被當成墨跡，導致 dx 偏 49px、底色讀到亮灰 `[105,103,102]`。

v98 改用**差分遮罩**：
1. 同一格畫面拍兩張：字形塗純綠 / 字形透明
2. 遮罩 = 綠通道上升 > 55、紅藍通道變化 < 40 的像素 —— **只有標籤自己的字形**能造成這個變化，照片兩張完全相同
3. 對每個字形像素取 ±4 CSS px 環帶，取**最亮**那一點當最差底色
4. `contrast(#EBDCB6, 最差底色)`

**控制組驗證**：把 v98 的羽化底刪掉（回到裸字），同樣的管線必須量到劇烈波動——實測 3.92–5.78（n=3，另 3 點因字形與背景對比不足無法取樣）。這證明管線確實讀得到照片的亮度，不是讀到一個常數。

---

## 4. 量測結果（桌機 1440×900 / 手機 390×844）

| 取樣點 | v97 最差 | **v98 最差** | v98 最差底色 | 標籤框 | 墨跡 |
|---|---|---|---|---|---|
| 桌機 · 第一世 | 12.46 | **13.96** | `#12100E` | 199.59×55 | 45.0×13.5 |
| 桌機 · 第二世 | 12.23 | **13.94** | `#131010` | 199.59×55 | 45.0×13.5 |
| 桌機 · 第三世 | 12.65 | **14.17** | `#130D0A` | 199.59×55 | 45.0×13.5 |
| 手機 · 第一世 | 12.26 | **13.48** | `#171413` | 171.12×51 | 44.5×13.5 |
| 手機 · 第二世 | 12.22 | **13.37** | `#181512` | 171.12×51 | 44.5×13.5 |
| 手機 · 第三世 | 12.65 | **13.85** | `#17100B` | 171.12×51 | 44.5×13.5 |

- 六點最差 **13.37:1**，AA（4.5:1）與 AAA（7:1）皆通過，餘裕 **2.97 倍**
- 六點全部落在 **13.37–14.17** 的窄帶（1.06×），代表對比已與背後照片脫鉤
- **邊框 0px、圓角 0px、box-shadow `none`、背景 = radial-gradient** —— 全部經 computed style 確認
- 中文 **14px**（符合不小於 14px 的要求）

### 置中（文字 ＋ 左右細線的整體）
| 視窗 | dx | dy |
|---|---|---|
| 1440×900 | +0.21px | +0.75px |
| 390×844 | +0.19px | +0.75px |

dy 0.75px 來自 2× 裝置像素的字形反鋸齒量化（實體 1.5 裝置 px），肉眼不可辨。

---

## 5. 變更檔案

| 檔案 | 變更 |
|---|---|
| `css/v98-lives.css` | **新增**（96 行） |
| `index.html` | `site-version` v97→v98；新增一行 `<link href="css/v98-lives.css">` |

`diff -rq site_v97 site_v98` 的完整輸出：
```
Only in site_v98/css: v98-lives.css
Files site_v97/index.html and site_v98/index.html differ
```
`index.html` 的行級 diff 僅 2 處（版本標記 + 一行 CSS 引用）。
