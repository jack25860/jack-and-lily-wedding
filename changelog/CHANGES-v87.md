# v87 — 主視覺畫質與手機裁切修正 ＋ 裝飾材質壓縮

## 版本
- site-version: v87
- 基底：v86（線上版本）

## 主視覺（Hero）
- **問題**：`images/hero.jpg` 僅 1584×672，經 `background-size:cover` 放大 1.45×–1.74×（Ken Burns 動畫再乘 1.13×，最高約 1.96×），於高解析螢幕偏軟。
- **修正**：主視覺重製為 **2560×1088**（`images/hero.jpg`），維持原水墨風格、構圖與色盤（酒紅／炭黑／米色天空／金色地平線）。
- **手機裁切**：原橫式主視覺在手機（≤640px）僅顯示約 **19.6%** 寬度，且置中裁切會切掉右側山脊上的騎士。
  - 新增直式主視覺 **`images/hero-mobile.jpg`（1080×2184）**，騎士置於畫面中上、完整入鏡。
  - `index.html` 改用 `<picture>` art direction：桌機載入橫式、手機（≤640px）載入直式；`<link rel="preload">` 亦依 media query 分流。
  - CSS `.hero__bg` 由 `background-image` 改為 `<img>` + `object-fit:cover`；手機 `object-position:center 42%` 微調取景。

## 裝飾材質壓縮
| 檔案 | 舊 | 新 | 用途 |
|---|---|---|---|
| `texture-ink.jpg` | 680 KB | 105 KB | footer overlay（opacity .24） |
| `texture-paper.jpg` | 706 KB | 20 KB | 宣紙底（tile 640/520px） |
| `texture-silk.jpg` | 707 KB | 137 KB | dress／verse 背景（opacity .2–.5） |
| **合計** | **2.04 MB** | **263 KB** | **約 8× 縮減** |

- 僅尺寸縮放與重新壓縮（progressive JPEG），未改變色調與圖樣；材質皆為低透明度疊加，視覺無差異。

## 風格一致性
- 未更動任何設計 token（`--wine`／`--gold`／`--paper`／`--ink`）、字體、版面間距與區塊結構。
- 桌機／手機實測：無水平溢出、無破圖、版面與 v86 一致。

## 注意
- 舊版 `images/hero.jpg` 已被新版覆蓋（同名）；`images/hero-mobile.jpg` 為新增檔案。
