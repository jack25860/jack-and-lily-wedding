/* ══════════════════════════════════════════════════════════════════════════════
   座位表資料檔  js/seating-data.js   （v66）
   ──────────────────────────────────────────────────────────────────────────────
   ★ 這是「備援名單」檔。
     正式名單來源 = 問卷回覆的 Google 線上表單（經 Google Apps Script Web App
     取得 JSON），設定於 js/seating-config.js 的 API_URL。
     只有當 API 未設定、逾時或失敗時，才會回退到本檔的示範資料。

   檔案結構（四個部分）：
     1. VENUE    ── 場地配置（舞台、紅毯步道、主桌、每側桌數、每桌座位數）
     2. TABLES   ── 每一桌的桌號、桌名、座位數
     3. GUESTS   ── 賓客名單（姓名 → 桌號 + 座位號）
     4. OPTIONS  ── 查詢／顯示設定

   ⚠ 注意：本檔案必須在 js/seating.js「之前」載入（seating.html 已處理）。
   v64 變更：
     • 桌數固定 16 桌（1 主桌 + 15 側桌）；API 只提供賓客名單，不再覆寫桌數。
     • 新增 OPTIONS.unassignedText（桌號無效時顯示「由現場人員安排」）。
   v66 變更：
     • 資料結構與 v65 相同（VENUE／TABLES／GUESTS／OPTIONS 四部分）；
       僅版本標記更新，查詢介面改版在 js/seating.js 與 css/seating.css。
   ══════════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ──────────────────────────────────────────────────────────────────────────────
     1. VENUE：場地配置（可依實際桌次圖微調）
     ──────────────────────────────────────────────────────────────────────────────
     v62 場地配置（使用者更新）：
       • 前方為大舞台，中央為紅毯步道。
       • 紅毯末端、舞台正前方有一張 12 人的「主桌」（位於紅毯中軸線上）。
       • 其餘 15 桌分列紅毯左右兩側（左 8 桌、右 7 桌）。
     ────────────────────────────────────────────────────────────────────────────── */
  var VENUE = {
    /* 主桌：舞台正前方、紅毯末端（紅毯中軸線上）。
       no    : 主桌桌號（對應 TABLES[].no 與 GUESTS[].table）
       name  : 主桌桌名（顯示於座位圖上）
       seats : 主桌座位數（12 人）
       若要取消主桌（改回全部側桌），把 mainTable 設為 null 即可。 */
    mainTable: { no: 1, name: "主桌", seats: 12 },

    /* 每一側的「側桌」格位數。目前 8 → 左右各 8 格（共 16 格），
       實際使用 15 桌（左 8、右 7），最後一格留空。
       若之後改成左右各 7 桌（共 14 桌），把這裡改成 7 即可。 */
    tablesPerSide: 8,

    /* 每一桌的「預設」座位數。單桌要不同數量時，在 TABLES 該桌覆寫 seats 欄位。 */
    seatsPerTable: 10,

    /* 紅毯步道寬度（佔座位區總寬的百分比，6~40 之間）。
       紅毯由舞台往後延伸，將座位區分為左右兩側。 */
    aisleWidthPct: 13,

    /* 舞台 / 紅毯 / 走道 / 主桌 的文字標示（可改為場地實際用語） */
    labels: {
      stage: "舞台",
      aisle: "紅毯步道",
      leftSide: "左側",
      rightSide: "右側",
      mainTable: "主桌"
    },

    /* 舞台是否顯示在中間有紅毯的位置（true＝置中於紅毯正上方） */
    stageCentered: true
  };

  /* ──────────────────────────────────────────────────────────────────────────────
     2. TABLES：每一桌的資料
        no    : 桌號（數字，會直接顯示在座位圖上，例如 5 → 顯示「5」）
        name  : 桌名（可選；例如「主桌」，沒有可省略或留空字串）
        seats : 該桌座位數（可選；省略時採用 VENUE.seatsPerTable）
        side  : 'left' 或 'right'（可選；省略時由程式依 tablesPerSide 自動左右分配）
        main  : true 表示這是主桌（可選；亦可由 VENUE.mainTable.no 判定）
     ──────────────────────────────────────────────────────────────────────────────
     v62：桌號 1 = 主桌（12 人，舞台正前方紅毯末端）；
          桌號 2~16 = 紅毯兩側共 15 桌（左 8、右 7）。 */
  var TABLES = [
    { no: 1,  name: "主桌", seats: 12, main: true },
    { no: 2,  name: "" },
    { no: 3,  name: "" },
    { no: 4,  name: "" },
    { no: 5,  name: "" },
    { no: 6,  name: "" },
    { no: 7,  name: "" },
    { no: 8,  name: "" },
    { no: 9,  name: "" },
    { no: 10, name: "" },
    { no: 11, name: "" },
    { no: 12, name: "" },
    { no: 13, name: "" },
    { no: 14, name: "" },
    { no: 15, name: "" },
    { no: 16, name: "" }
  ];

  /* ──────────────────────────────────────────────────────────────────────────────
     3. GUESTS：賓客名單（備援示範資料）
        name  : 姓名（必填）
        table : 桌號（必填，對應 TABLES[].no）
        seat  : 座位號（必填，1 起算；單桌座位數以 TABLES[].seats 為準）
        note  : 備註（可選；例如「素食」）

     ── 模糊／部分比對說明 ──
     查詢「王小明」或「小明」都能查到同一筆，因為程式會做「包含比對」。
     若同一姓名有多筆（同名不同人），會列出候選讓使用者點選。
     ⚠ 目前為【示範資料】，正式名單請由問卷回覆 API 提供。
     ──────────────────────────────────────────────────────────────────────────────
     示範資料刻意包含：
       • 「王小明」三筆同名不同桌 → 驗證同名候選功能
       • 「陳」姓多筆 → 驗證部分比對會列出多位候選
  */
  var GUESTS = [
    /* ── 1 桌（主桌，12 人）── */
    { name: "王大朋", table: 1,  seat: 1,  note: "新郎父親" },
    { name: "林月娥", table: 1,  seat: 2,  note: "新郎母親" },
    { name: "杜振發", table: 1,  seat: 3,  note: "新娘父親" },
    { name: "郭秋菊", table: 1,  seat: 4,  note: "新娘母親" },
    { name: "王有岑", table: 1,  seat: 5,  note: "新郎" },
    { name: "杜伊筠", table: 1,  seat: 6,  note: "新娘" },
    { name: "王志豪", table: 1,  seat: 7 },
    { name: "王志玲", table: 1,  seat: 8 },
    { name: "杜伊菱", table: 1,  seat: 9,  note: "新娘妹妹" },
    { name: "杜仲凱", table: 1,  seat: 10 },
    { name: "張文彬", table: 1,  seat: 11 },
    { name: "李秀英", table: 1,  seat: 12 },

    /* ── 2 桌 ── */
    { name: "王小明", table: 2,  seat: 3,  note: "同名示範 A" },
    { name: "許淑芬", table: 2,  seat: 4 },
    { name: "鄭俊傑", table: 2,  seat: 5 },
    { name: "黃麗華", table: 2,  seat: 6 },
    { name: "劉家豪", table: 2,  seat: 7 },
    { name: "蔡婉庭", table: 2,  seat: 8 },

    /* ── 3 桌 ── */
    { name: "陳志明", table: 3,  seat: 1 },
    { name: "陳怡君", table: 3,  seat: 2 },
    { name: "陳柏翰", table: 3,  seat: 3 },
    { name: "楊雅婷", table: 3,  seat: 4 },
    { name: "周文德", table: 3,  seat: 5 },
    { name: "徐巧芯", table: 3,  seat: 6 },

    /* ── 4 桌 ── */
    { name: "林志偉", table: 4,  seat: 1 },
    { name: "林宜蓁", table: 4,  seat: 2 },
    { name: "高志豪", table: 4,  seat: 3 },
    { name: "潘欣儀", table: 4,  seat: 4 },
    { name: "詹益昌", table: 4,  seat: 5 },
    { name: "賴雅雯", table: 4,  seat: 6 },

    /* ── 5 桌（任務範例：「王小明-5桌」）── */
    { name: "王小明", table: 5,  seat: 6,  note: "同名示範 B（任務範例）" },
    { name: "邱奕儒", table: 5,  seat: 1 },
    { name: "范姜群", table: 5,  seat: 2 },
    { name: "簡志勳", table: 5,  seat: 3 },
    { name: "洪詩涵", table: 5,  seat: 4 },
    { name: "曾冠廷", table: 5,  seat: 5 },

    /* ── 6 桌 ── */
    { name: "謝佳霖", table: 6,  seat: 1 },
    { name: "唐雨柔", table: 6,  seat: 2 },
    { name: "馮世寬", table: 6,  seat: 3 },
    { name: "蔣萬安", table: 6,  seat: 4 },
    { name: "余天賜", table: 6,  seat: 5 },

    /* ── 7 桌 ── */
    { name: "呂佩珊", table: 7,  seat: 1 },
    { name: "蘇建州", table: 7,  seat: 2 },
    { name: "盧彥勳", table: 7,  seat: 3 },
    { name: "柯佳彣", table: 7,  seat: 4 },

    /* ── 8 桌 ── */
    { name: "羅時豐", table: 8,  seat: 1 },
    { name: "沈玉琳", table: 8,  seat: 2 },
    { name: "鍾欣凌", table: 8,  seat: 3 },
    { name: "嚴立婷", table: 8,  seat: 4 },

    /* ── 9 桌 ── */
    { name: "江美琪", table: 9,  seat: 1 },
    { name: "范文芳", table: 9,  seat: 2 },
    { name: "李宗盛", table: 9,  seat: 3 },
    { name: "林憶蓮", table: 9,  seat: 4 },

    /* ── 10 桌 ── */
    { name: "張清芳", table: 10, seat: 1 },
    { name: "陳綺貞", table: 10, seat: 2 },
    { name: "盧廣仲", table: 10, seat: 3 },
    { name: "林書豪", table: 10, seat: 4 },

    /* ── 11 桌 ── */
    { name: "王建民", table: 11, seat: 1 },
    { name: "陳金鋒", table: 11, seat: 2 },
    { name: "彭政閔", table: 11, seat: 3 },
    { name: "吳寶春", table: 11, seat: 4 },

    /* ── 12 桌 ── */
    { name: "江振誠", table: 12, seat: 1 },
    { name: "詹姆士", table: 12, seat: 2 },
    { name: "阿基師", table: 12, seat: 3 },
    { name: "蔡依林", table: 12, seat: 4 },

    /* ── 13 桌 ── */
    { name: "周杰倫", table: 13, seat: 1 },
    { name: "五月天", table: 13, seat: 2 },
    { name: "田馥甄", table: 13, seat: 3 },
    { name: "陳時中", table: 13, seat: 4 },

    /* ── 14 桌 ── */
    { name: "賴清德", table: 14, seat: 1 },
    { name: "韓國瑜", table: 14, seat: 2 },
    { name: "柯文哲", table: 14, seat: 3 },
    { name: "黃仁勳", table: 14, seat: 4 },

    /* ── 15 桌 ── */
    { name: "張忠謀", table: 15, seat: 1 },
    { name: "郭台銘", table: 15, seat: 2 },
    { name: "林百里", table: 15, seat: 3 },
    { name: "王小明", table: 15, seat: 4, note: "同名示範 C" },

    /* ── 16 桌 ── */
    { name: "比爾蓋茲", table: 16, seat: 1, note: "示範" },
    { name: "馬斯克",   table: 16, seat: 2, note: "示範" },
    { name: "巴菲特",   table: 16, seat: 3, note: "示範" },
    { name: "賈伯斯",   table: 16, seat: 4, note: "示範" }
  ];

  /* ──────────────────────────────────────────────────────────────────────────────
     4. 查詢／顯示設定（可選）
     ────────────────────────────────────────────────────────────────────────────── */
  var OPTIONS = {
    /* 查不到時顯示的提示文字 */
    notFoundText: "查無此姓名，請確認輸入或洽現場招待",
    /* 同名候選時顯示的引導文字 */
    candidatesText: "找到多位同名或相似的賓客，請選擇：",
    /* 查詢結果文字中的桌次後綴，例如「王小明-5桌」 */
    tableSuffix: "桌",
    /* 每桌是否顯示座位位置（例如「5桌 · 第6位」） */
    showSeatLabel: true,
    /* v64：桌號無效／查無對應桌次時顯示的文字（不顯示錯誤桌號） */
    unassignedText: "由現場人員安排",
    /* v65：某桌填寫人數超過該桌上限時的提示文字（{n} 會代換為超額人數） */
    capacityText: "部分桌次人數已達上限，超額賓客將由現場人員安排。"
  };

  /* ── 對外暴露（請勿更名，程式以此為進入點）── */
  window.SEATING_DATA = {
    VENUE: VENUE,
    TABLES: TABLES,
    GUESTS: GUESTS,
    OPTIONS: OPTIONS
  };
})();
