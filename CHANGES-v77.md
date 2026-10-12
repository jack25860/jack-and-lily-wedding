# v77 變更摘要 — 修正右下角浮動鈕重疊

線上頁面：https://jack25860.github.io/jack-and-lily-wedding/seating.html
前一版：v76（未更動）

## 問題

「快速查詢座位」浮動鈕（`.seat-fab`）與背景音樂開關（`.music`）**使用完全相同的定位**：

```css
.seat-fab{position:fixed;right:clamp(14px,2.4vw,30px);bottom:clamp(14px,2.4vw,30px);z-index:820;...}
.music  {position:fixed;right:clamp(14px,2.4vw,30px);bottom:clamp(14px,2.4vw,30px);z-index:800;}
```

且 `.seat-fab` 的 `z-index:820` 高於 `.music` 的 `800`，因此浮動鈕**完全覆蓋**音樂鈕。

### 真實瀏覽器實測（1280×577，線上 v76）

| 元素 | x | y | 寬 | 高 | z-index |
|---|---|---|---|---|---|
| `#seatFab` | 1085 | 499 | 156 | 48 | 820 |
| `#music` | 1097 | 507 | 144 | 40 | 800 |
| `#fontctl` | 1191 | 439 | 50 | 50 | 800 |

重疊面積 = **144 × 40 = 5760 px² = 音樂鈕的 100%** → 音樂鈕被完全遮住且無法點擊。

## 修正

將「快速查詢座位」浮動鈕由**右下角改置左下角**（`right` → `left`）：

```css
.seat-fab{position:fixed;left:clamp(14px,2.4vw,30px);bottom:clamp(14px,2.4vw,30px);z-index:820;...}
```

### 為何選左下角而非往上堆疊

右下角已有兩個浮動元件，且**字級鈕的展開面板是「向上展開」**（`bottom:calc(100% + 10px)`，實測 y 377–429）。若把浮動鈕往上堆，會撞到字級展開面板；往下或往左都會離開安全區。左下角完全空著，且與全站「回到頂端」鈕同側，視覺平衡。

## 未變更

- 姓名查詢、即時建議、最近查詢（上限 3 筆）、同名候選
- 整團座位金色閃爍高亮、兒童椅標示（顏色＋外環＋圖示＋圖例，僅依 `childSeats` 判定）
- 固定 16 桌、無效桌號顯示「由現場人員安排」、超額處理
- 手機單指平移、查詢動畫不閃動、貼心提醒 6 項、場地比例（viewBox 647 × 740）
- 背景音樂鈕與字級鈕的位置與行為

## 變更檔案

- `css/seating.css`（`.seat-fab` 定位）
- `seating.html`（版本標記 v77、變更說明文字）
- `CHANGES-v77.md`（新增）
