# v69 變更紀錄 — 座位圖整團高亮修正

## 問題
線上 v68 查詢結果顯示「大人 3 位、兒童椅 1 位」，但座位圖上只有**部分座位**閃爍變色，
同團其他大人的座位沒有被標示出來。

## 根因
`js/seating.js` 的 `showHit()` 只取 `g.seat`（單一座位）加上 `seat-hit`：

```js
var sc = tn.seats[Number(g.seat) - 1];
if (sc) sc.classList.add("seat-hit");
```

v67 起資料模型已改為「同行團體（party）」，一筆回覆對應 `seat`～`seatEnd` 的**連續座位區間**，
但高亮邏輯仍停留在「一人一格」的舊思維，因此一團 4 人只亮 1 格。

## 修正
1. **整團高亮**：`showHit()` 改為依 `seat..seatEnd` 逐一標示**所有**座位。
2. **兒童椅一致標示**：落在 `childSeatFrom..seatEnd` 的座位額外加 `seat-hit--child`，
   命中時保留青色外框（`#2f6b7a`），維持兒童椅辨識。
3. **整團外框弧線**：新增 `partyArcPath()` 與 `.tbl-partyarc`，沿桌緣把同團座位圈成一個視覺群組。
4. **結果卡對應**：
   - 座位號碼改為「第 X～Y 號（本團體共 N 位）」。
   - 兒童椅區塊加上座位號碼「（第 X～Y 號）」。
   - 提示文字明確寫出「本團體 N 個座位（第 X～Y 號）將以金色閃爍」。
5. **版本標記**：`site-version` → `v69`。

## 變更檔案
- `seating.html`
- `js/seating.js`
- `css/seating.css`
- `CHANGES-v69.md`

## 驗證
- 真實 Chromium 線上驗證：整團座位全部閃爍、與結果卡人數／座位區間一致、無水平溢位。
