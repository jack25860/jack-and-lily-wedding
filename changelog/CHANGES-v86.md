# v86 — 最終版精修照片全面替換（縮圖瀏覽 + 點開看原檔）

## 版本
- site-version: v86
- 基底：v85（線上版本）

## 影像
- 來源：攝影師最終版精修 `精修137.zip`（137 張 4640×6960 原始檔，2.03 GiB）
- 相簿縮圖：**僅尺寸縮放**（長邊 1600px、JPEG q82、progressive），共 **39.2 MiB**，全部 < 100 MB 上限
- 原始精修檔：**位元不變**（僅改檔名），託管於 GitHub Release `originals-v86`，燈箱點開才載入
- 未去浮水印、未修陰影、未調色，原檔 sha256 與攝影師交付檔一致

## 分類（僅三主題，名稱未變）
| 主題 | 張數 | FEATURED |
|---|---|---|
| 戰國 | 36 | 6 |
| 唐代 | 45 | 6 |
| 明朝 | 56 | 6 |
| 合計 | **137** | 18 |

歸類依 ZIP 內攝影師資料夾：`戰國_导出_导出` → 戰國、`唐代_导出_导出` → 唐代、`明朝大婚_导出_导出` → 明朝。

## 效能
- 每張縮圖輸出 `width`/`height`，避免版面跳動
- `loading="lazy"` + `decoding="async"`，首屏只載入可視範圍
- 燈箱：點開才請求原檔，含「正在載入原圖…」狀態與失敗重試（失敗時退回顯示縮圖）

## 電子喜帖
- `ECARD_PHOTO_POOL` 改為本次 137 張（`js/config.js` 與 `scripts/rsvp-to-sheet.gs` 同步）
- `ECARD_PHOTO` 預設 `images/album/warring/warring-01.jpg`
- `ecard-email-preview.html` 引用同步更新

## 清理
- 舊版 `images/album/*.jpg`（137 個扁平檔名）已刪除，避免 404 與空間浪費

## 注意
- `scripts/rsvp-to-sheet.gs` 為鏡像，需手動貼回 Apps Script 並重新部署才會生效於寄信後端
