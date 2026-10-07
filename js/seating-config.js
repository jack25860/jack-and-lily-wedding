/* ══════════════════════════════════════════════════════════════════════════════
   座位表遠端名單設定  js/seating-config.js   （v61）
   ──────────────────────────────────────────────────────────────────────────────
   ★ 這是「問卷回覆 → 座位表」的設定檔。設定好 API_URL 後，座位表頁面會自動以
     fetch 取得名單並重繪；不需要再手動替換 js/seating-data.js。

   ★ 欄位對應（姓名／桌次／座位／備註）是「在 Apps Script 那邊」設定的，
     本檔不需要重複填；請改 scripts/seating-from-sheet.gs 的 COL_NAME / COL_TABLE /
     COL_SEAT / COL_NOTE（可指定欄名或第幾欄）。

   ★ 若 API_URL 留空、或 API 逾時／失敗，頁面會自動回退到 js/seating-data.js
     的備援名單，並在座位圖下方以不打擾的方式提示，畫面不會空白或壞掉。
   ══════════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  window.SEATING_CONFIG = {

    /* ── 1. 名單來源（Apps Script Web App /exec 網址）─────────────────────────
       部署 scripts/seating-from-sheet.gs 為「網頁應用程式」後，把結尾為 /exec
       的網址貼在這裡。留空 "" = 一律使用 js/seating-data.js 的備援名單。
       範例：
         API_URL: "https://script.google.com/macros/s/AKfycb..../exec"                */
    API_URL: "",

    /* 對應 Apps Script 回傳 JSON 的欄位名稱（一般不需要改） */
    KEYS: {
      guests: "guests",   /* 賓客陣列（每筆含 name / table / seat / note） */
      tables: "tables",   /* 桌次陣列（可省略） */
      venue: "venue"      /* 場地覆寫（可省略） */
    },

    /* ── 2. 逾時與快取 ──────────────────────────────────────────────────── */
    API_TIMEOUT_MS: 8000,     /* 連線／回應逾時（毫秒）；逾時即回退備援名單 */
    CACHE_TTL_MS: 300000,     /* 瀏覽器端快取存活時間（毫秒，預設 5 分鐘） */
    CACHE_KEY: "ssss-seating-remote-v1",

    /* ── 3. 之後自動重試 ────────────────────────────────────────────────── */
    RETRY_MS: 60000,          /* 首次失敗後每隔多久自動重試一次（0 = 不重試） */

    /* ── 4. 狀態提示文字（不干擾、不遮擋座位圖）───────────────────────────── */
    STATUS_ID: "seatDataStatus",
    TEXT_LIVE: "名單已連線：即時讀取問卷回覆（共 {n} 位賓客）",
    TEXT_CACHED: "名單已連線：使用快取的名單（共 {n} 位賓客）",
    TEXT_FALLBACK: "目前顯示備援名單：暫時無法讀取問卷回覆，將自動重試。",
    TEXT_LOCAL: "目前顯示備援名單（尚未設定問卷回覆連線）。"
  };
})();
