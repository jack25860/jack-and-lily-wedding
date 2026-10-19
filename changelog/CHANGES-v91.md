# v91 — 燈箱文字移除、箭頭置中、畫質提升

線上：https://jack25860.github.io/jack-and-lily-wedding/

依 TASK CONTINUATION 規則，自 v90 複製為 `repo_v91` 後修改。`repo`、`repo_v87_baseline`、
`repo_v88`、`repo_v89`、`repo_v90` 皆未改動。

---

## 1. 移除兩段不該給賓客看的文字

依使用者提供的三張截圖定位，兩段文字皆位於「交通資訊」卡片，且內容為佔位符：

| 位置 | 移除前 | 處置 |
|---|---|---|
| 交通資訊 → 開車自駕 清單 | `<li><span>建議進場方式</span><b>［待補充］</b></li>` | 整列刪除 |
| 交通資訊 → 大眾運輸 清單 | `<li><span>其他</span><b>［待補充］</b></li>` | 整列刪除 |

**未加任何替代文案**，符合「直接移除，不要改成別的文案」的要求。
驗證：`document.body.innerText` 不含「建議進場方式」；`li span` 中無「其他」；DOM 不含
`OTHER_TRANSIT` 鍵。

## 2. 燈箱「下一張」按鈕真正置中

### 量測顯示的矛盾

`getBoundingClientRect()` 一路顯示按鈕框與照片中心差 **0.00px**（桌機 450 = 450，
手機 422 = 422），但肉眼仍覺得偏斜。因此問題不在元素框，而在**字形墨跡**。

### 根因：襯線字元的 ascent/descent 不對稱

舊版按鈕的內容是純文字 `›`（U+203A），`font-size:2rem; line-height:1`。
襯線字體（Noto Serif TC / Songti TC）的 U+203A 墨跡並不在 em box 的垂直正中。
以 6× DPR 截圖、把照片暫時隱藏後只量箭頭本身，得到：

| 視窗 | 箭頭墨跡中心 vs 照片中心 |
|---|---|
| 桌機 1440×900 | **+5.17px**（偏低） |
| 手機 390×844 | **+2.92px**（偏低） |

（正值 = 偏低。這正是使用者看到的「按鈕沒有置中、看起來偏斜」。）
`line-height:1` 使 em box 與行高同高，但 glyf 的基線落點仍由字體設計決定，
所以換字型或換字重就會再跑掉一次 —— 這是無法靠 `top/transform` 修掉的。

### 修法：改用幾何對稱的 SVG，不依賴字型度量

```html
<button class="lb-nav lb-next" id="lbNext" aria-label="下一張">
  <svg class="lb-nav__ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M8.75 4.75 16.5 12l-7.75 7.25"/>
  </svg>
</button>
```

```css
.lb-nav__ico{display:block;width:26px;height:26px;fill:none;stroke:currentColor;
  stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.lb-nav{top:50%;transform:translateY(-50%);line-height:0;padding:0;
  box-sizing:border-box;align-items:center;justify-items:center}
```

折線路徑的頂點與底點關於 `y=12` 完全對稱（4.75 與 19.25，midpoint = 12），
而 viewBox 24×24 置中於 26×26 的 svg box，所以**墨跡中心必然等於按鈕圓心，
且與字型檔完全無關**。

### 修正後量測

| 視窗 | 照片 | 按鈕框 vs 照片 | 箭頭墨跡 vs 照片 |
|---|---|---|---|
| 1440×900 | 1067×1600 直幅 | 0.00px | **−0.17px** |
| 1440×900 | 1600×1067 橫幅 | 0.01px | **−0.16px** |
| 390×844 | 1067×1600 直幅 | 0.01px | **−0.16px** |
| 390×844 | 1600×1067 橫幅 | 0.01px | **−0.16px** |

直幅與橫幅互換時數值不變 —— 切換照片不會跳動。全部 ≤1px。

## 3. 燈箱畫質提升（≤2 秒）

### 新舊版本

| | v89/v90 | v91 |
|---|---|---|
| 尺寸（最長邊） | 1000px（667×1000） | **1600px（1067×1600）** |
| 像素數 | 0.67 Mpx | **1.71 Mpx（2.56×）** |
| 格式 | WebP | WebP（method=4） |
| 品質 | 自適應 ≤110KB | 自適應 90→76，上限 280KB |
| 單張大小 | 79.8–109 KB（均 83 KB） | 199–329 KB（均 ~256 KB） |
| 137 張總計 | 11.4 MB | **35 MB** |

來源為 `images/album/*.jpg`（已是 1600px 原生尺寸），**不做 upscale**，因此
1600px 就是來源的真實解析度上限，畫質提升來自「不再預先縮到 1000px」。

### 限速實測（Chromium CDP，4 Mbps / 20 ms RTT）

| 視窗 | 照片 | 傳輸 | 點開 → 清晰顯示 |
|---|---|---|---|
| 1440×900 | 直幅 1067×1600 | 321 KB / 680 ms | **1391 ms** |
| 1440×900 | 橫幅 1600×1067 | 275 KB / 579 ms | **1282 ms** |
| 390×844 | 直幅 1067×1600 | 321 KB / 693 ms | **1323 ms** |
| 390×844 | 橫幅 1600×1067 | 274 KB / 553 ms | **1105 ms** |

全部 ≤2 秒，最差 1391 ms。量測方式為 `performance.now()` 計時至
`img.complete && naturalWidth>0 && .is-loaded && computed opacity === 1`
（即真正畫出來的時刻，非 request 完成）。

## 4. 動畫：開啟／關閉皆有縮放，無閃爍

原本 `transition` 引用了 **未定義的 CSS 變數 `--ease-io`**（:root 只有 `--ease` /
`--ease-soft` / `--ease-out`），整個 `transition` 宣告被瀏覽器視為無效 →
燈箱開啟時 `opacity` 從 0 直接跳到 1，就是使用者感覺到的「突然出現」。
已修正 14 處 `var(--ease-io)` → `var(--ease-soft)`。

| 互動 | 視窗 | 影格 | 相異透明度影格 | 最大單格透明度變化 | 相異縮放影格 |
|---|---|---|---|---|---|
| 燈箱開啟 | 桌機 | 14 | 10 | 0.315 | 12（0.94 → none） |
| 燈箱關閉 | 桌機 | 9 | 8 | 0.314 | 8 |
| 燈箱開啟 | 手機 | 38 | 28 | 0.139 | 34（0.94 → none） |
| 燈箱關閉 | 手機 | 38 | 27 | 0.103 | 31 |

「相異縮放影格」證明是**逐格從 scale(0.94) 縮放到 1**，不是瞬間切換。

## 5. 驗收（對本機 127.0.0.1:8123 以真實 Chromium 量測）

| 項目 | 桌機 1440×900 | 手機 390×844 |
|---|---|---|
| 版本標記 | v91 | v91 |
| 相簿預覽 | 6 / 6 / 6 = 18 | 6 / 6 / 6 = 18 |
| 相簿總數 | 36 / 45 / 56 = 137 | 36 / 45 / 56 = 137 |
| 「建議進場方式」 | 已移除 | 已移除 |
| 「其他」列 | 已移除 | 已移除 |
| 箭頭偏移（直/橫） | −0.17 / −0.16 px | −0.16 / −0.16 px |
| 燈箱載入 | 1282–1391 ms | 1105–1323 ms |
| 破圖 | 0 / 145 | 0 / 145 |
| 水平溢位 | 0px（1440=1440） | 0px（390=390） |
| Console 錯誤 | 0 | 0 |
| Page error | 0 | 0 |
| 失敗的站內請求 | 0 | 0 |

## 6. 檔案異動

```
index.html                     兩段文字移除、箭頭改 SVG、site-version v91
css/styles.css                 --ease-io 修正、.lb-nav__ico 新增、.lb-nav 幾何置中
images/album-lb/*/*.webp       137 張重新產生（1600px）
changelog/CHANGES-v91.md       本文件
```

`js/app.js`、`js/config.js`、`images/album/*.jpg`、`audio/`、`media/` 皆未變動。
