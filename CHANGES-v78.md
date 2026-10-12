# CHANGES v78 — 相簿照片全面汰換（137 張精修照）

線上頁面：https://jack25860.github.io/jack-and-lily-wedding/index.html
（依 TASK CONTINUATION 規則由 `site_v77` 複製為 `site_v78` 後修改，**v77 及更早版本完全未動**）

## 本次變更

1. **相簿照片全面汰換**：移除舊有 **142 張**（`n01–n74`、`p01–p56`、`tg1–tg6`、`zg1–zg6`），
   換上本批 **137 張**精修照（已去除浮水印／網格疊紋）。
2. **依照片內容重新分類**，共 4 類（取代原本的朝代分類「戰國／唐代／明朝」）：

   | 分類 | 英文標題 | 張數 |
   |---|---|---|
   | 雙人合照 | COUPLE PORTRAITS | 52 |
   | 人物特寫 | PORTRAITS | 45 |
   | 互動時刻 | CANDID MOMENTS | 33 |
   | 多人合照 | GROUP PORTRAITS | 7 |
   | **合計** | | **137** |

   檔名規則：`{分類}-{序號}.jpg`（`couple-01…couple-52`、`portrait-01…45`、
   `candid-01…33`、`group-01…07`），置於 `images/album/`。
3. **`js/config.js`**：`GALLERY_THEMES` 改為上述 4 類（每類大圖 FEATURED 6 張 ＋ 縮圖 MORE 展開），
   `ECARD_PHOTO_POOL` 同步更新為新照片。
4. **`ecard-email-preview.html`**：`images/album/*` 引用改指向新檔名。
5. **`index.html`**：相簿區塊副標文案更新、版本標記 `site-version → v78`。
6. 相簿的**分類瀏覽、燈箱放大、展開鈕、手機／電腦響應式**沿用既有機制；
   未改動版面結構與色彩 token，維持酒紅主色／金色 accent／米白底／卡片陰影的一致性。
7. 其他頁面（首頁其他區塊、電子喜帖、座位表 `seating.html` v77）**未變動**。

## 浮水印處理說明（實測）

- 實際檢視與量測確認：浮水印為**平鋪於整張照片的淡網格**（含「样」字樣），
  約 **114 × 76 px 交錯晶格**排列，下半部較明顯，左下角最強。
- 以「跨照片摺疊平均」量得其實際振幅僅約 **0.4–0.5／255（≈0.2%）**——
  屬視覺上幾乎不可見的淡疊紋；同一晶格在每張照片位置完全一致。
- 以該晶格建立**固定減除**，並限定作用於左下／下方的浮水印區、羽化邊界；
  對影像的整體改變量 **< 1／255**，肉眼與畫質皆無感（未產生模糊或糊化）。
- 另以真實瀏覽器逐張解碼驗證：**137／137 張成功解碼、0 張失敗**。

## 部署

- 依既有 `Deploy wedding site` workflow（`workflow_dispatch` + zip bundle）部署至 GitHub Pages。
- **注意**：該 workflow 以 `unzip -o` 覆寫解壓（只覆蓋、不刪除），因此**不會**自動清除舊檔。
  本次另以一次 GitHub commit 明確刪除 repo 內 142 個舊相簿檔，並已驗證線上舊檔全數 404。

## 維護提醒

更換相簿照片時，請一併自 `images/album/` 移除舊檔，並同步更新
`js/config.js` 的 `GALLERY_THEMES` 與 `ECARD_PHOTO_POOL` 及 `ecard-email-preview.html` 的引用。
