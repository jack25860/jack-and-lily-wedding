/* ══════════════════════════════════════════════════════════════════════════════
   座位表遠端名單設定  js/seating-config.js   （v67）
   ──────────────────────────────────────────────────────────────────────────────
   ★ 這是「問卷回覆 → 座位表」的設定檔。設定好資料來源後，座位表頁面會自動以
     fetch 取得名單並重繪；不需要再手動替換 js/seating-data.js。

   ★ v67 資料來源（四層，依序嘗試）：
       1) SHEET_GVIZ_URL ── Google 試算表 gviz JSON 端點（最推薦、最穩定）
          直接讀取問卷回覆試算表，含「出席人數／出席大人人數／出席兒童人數／
          需要兒童椅數量」等欄位，因此表單填寫人數與查詢結果能完全一致。
       2) SHEET_CSV_URL  ── Google 試算表「發布到網路」的 CSV 網址
       3) API_URL        ── Google Apps Script Web App（/exec）JSON 端點
       4) js/seating-data.js ── 本機備援名單（前三者皆失敗時）

   ★ 欄位對應（姓名／桌次／人數／兒童椅）在「前端」以 SHEET_COLS 設定，
     可指定欄名或第幾欄；Apps Script 端另有 COL_* 設定。

   ★ 若所有來源皆失敗，頁面會自動回退到 js/seating-data.js 的備援名單，
     並在座位圖下方以不打擾的方式提示，畫面不會空白或壞掉。
   ══════════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  window.SEATING_CONFIG = {

    /* ── 1. 名單來源 ─────────────────────────────────────────────────────────
       (1) SHEET_GVIZ_URL：Google 試算表 gviz JSON 端點（最推薦）。
           格式：https://docs.google.com/spreadsheets/d/<試算表ID>/gviz/tq?tqx=out:json&gid=<工作表gid>
           試算表需設為「知道連結的人可以檢視」。留空 "" = 不使用此來源。
       (2) SHEET_CSV_URL：Google 試算表 → 檔案 → 共用 → 發布到網路 →
           選擇該工作表、格式選「逗號分隔值 (.csv)」→ 發布 → 複製網址。
           留空 "" = 不使用此來源。
       (3) API_URL：部署 scripts/seating-from-sheet.gs 為「網頁應用程式」後，
           把結尾為 /exec 的網址貼在這裡。留空 "" = 不使用此來源。
       三者皆留空 = 一律使用 js/seating-data.js 的備援名單。 */
    SHEET_GVIZ_URL: "https://docs.google.com/spreadsheets/d/1oxlmhFgKS93pIWfRInJF0AXqpXRLxeU8v5ZJCnZFpW0/gviz/tq?tqx=out:json&gid=0",
    SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/1oxlmhFgKS93pIWfRInJF0AXqpXRLxeU8v5ZJCnZFpW0/export?format=csv&gid=0",
    API_URL: "https://script.google.com/macros/s/AKfycbw67DFeox7j77KVSzfMTazfOQiCeIyoUyiJo96s7yPxUVP92e9EBX3sBEVVsFUSbOBu/exec",

    /* ── 2. 試算表欄位對應（v67 新增）────────────────────────────────────────
       每個欄位可用 header（欄名完全相符）或 index（第幾欄，從 1 起算）。
       解析順序：header 完全相符 → aliases 完全相符 → aliases 部分相符 → index。 */
    SHEET_COLS: {
      name:      { header: "您的姓名",       aliases: ["姓名", "大名", "名字", "name"], index: 2 },
      attend:    { header: "是否能出席本次盛宴", aliases: ["是否出席", "出席", "attend"], index: 6 },
      partySize: { header: "出席人數",       aliases: ["出席總人數", "人數", "partySize"], index: 7 },
      adults:    { header: "出席大人人數",   aliases: ["大人人數", "成人人數", "adults"], index: 8 },
      children:  { header: "出席兒童人數",   aliases: ["兒童人數", "小孩人數", "children"], index: 9 },
      childSeats:{ header: "需要兒童椅數量", aliases: ["兒童椅數量", "兒童椅", "childSeats"], index: 10 },
      table:     { header: "桌次",           aliases: ["桌號", "第幾桌", "桌", "table"], index: 11 },
      seat:      { header: "座位",           aliases: ["座位號", "座位號碼", "座號", "seat"], index: 0 },
      note:      { header: "備註",           aliases: ["註記", "備注", "note"], index: 0 }
    },

    /* 視為「不克出席」的字串（會從名單剔除） */
    ATTEND_NO_VALUES: ["不克出席", "不出席", "否", "No", "no", "N", "n", "無法出席"],

    /* 對應 Apps Script 回傳 JSON 的欄位名稱（一般不需要改） */
    KEYS: {
      guests: "guests",   /* 賓客陣列（每筆含 name / table / seat / note / partySize / adults / children / childSeats） */
      tables: "tables",   /* 桌次陣列（可省略） */
      venue: "venue",     /* 場地覆寫（可省略） */
      unplaced: "unplaced" /* 已回覆但尚未分配桌次的姓名（可省略） */
    },

    /* ── 3. 逾時與快取 ─────────────────────────────────────────────────────── */
    API_TIMEOUT_MS: 20000,    /* 連線／回應逾時（毫秒）；逾時即回退備援名單。
                                 Apps Script 冷啟動偶爾需 10~28 秒，故放寬至 20 秒；
                                 逾時期間頁面已先顯示備援名單，不會空白。 */
    CACHE_TTL_MS: 300000,     /* 瀏覽器端快取存活時間（毫秒，預設 5 分鐘） */
    CACHE_KEY: "ssss-seating-remote-v5",   /* v67：資料結構新增 partySize/children/childSeats，快取鍵一併更新 */

    /* ── 4. 之後自動重試 ───────────────────────────────────────────────────── */
    RETRY_MS: 60000,          /* 首次失敗後每隔多久自動重試一次（0 = 不重試） */

    /* ── 5. 狀態提示文字（不干擾、不遮擋座位圖）──────────────────────────────
       以下文字僅在「所有來源皆失敗」時顯示，作為容錯提示。 */
    STATUS_ID: "seatDataStatus",
    TEXT_FALLBACK: "目前顯示備援名單：暫時無法讀取問卷回覆，將自動重試。",
    TEXT_LOCAL: "目前顯示備援名單（尚未設定問卷回覆連線）。"
  };
})();
