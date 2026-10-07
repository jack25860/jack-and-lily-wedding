/* ═══════════════════════════════════════════════════════════════════════════
   座位表資料檔  js/seating-data.js   （v60）
   ───────────────────────────────────────────────────────────────────────────
   ★ 這是「唯一需要替換」的檔案。
     正式座位表與桌次圖稍晚才會提供；屆時只要改這個檔案裡的資料，
     不需要動到任何程式邏輯（seating.html / js/seating.js / css/seating.css）。

   檔案結構（三個部分）：
     1. VENUE    ── 場地配置（舞台、紅毯步道、每側桌數、每桌座位數）
     2. TABLES   ── 每一桌的桌號、桌名、座位數
     3. GUESTS   ── 賓客名單（姓名 → 桌號 + 座位號）

   替換方式（兩種，任選其一）：
     A. 直接改本檔案的 VENUE / TABLES / GUESTS 內容（最簡單）。
     B. 若座位資料放在別的檔案（例如後台匯出的 JSON），
        可在 seating.html 載入本檔後，再賦值：
            window.SEATING_DATA.GUESTS = [ ... ];  // 或
            Object.assign(window.SEATING_DATA, 匯出的JSON);
        只要欄位名稱維持下列格式即可，程式會自動重新繪製。

   ⚠ 注意：本檔案必須在 js/seating.js「之前」載入（seating.html 已處理）。
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ─────────────────────────────────────────────────────────────────────────
     1. VENUE：場地配置（可依實際桌次圖微調）
     ───────────────────────────────────────────────────────────────────────── */
  var VENUE = {
    /* 每側桌數。目前 16 桌＝左右各 8 桌。
       若之後改成左右各 7 桌（共 14 桌）、或改為單側排列，改這裡即可。 */
    tablesPerSide: 8,

    /* 每一桌的「預設」座位數。單桌要不同數量時，在 TABLES 該桌覆寫 seats 欄位。 */
    seatsPerTable: 10,

    /* 紅毯步道寬度（佔座位區總寬的百分比，0~40 之間）。
       紅毯由舞台往後延伸，將座位區分為左右兩側。 */
    aisleWidthPct: 13,

    /* 舞台 / 紅毯 / 走道 的文字標示（可改為場地實際用語） */
    labels: {
      stage: "舞台",
      aisle: "紅毯步道",
      leftSide: "左側",
      rightSide: "右側"
    },

    /* 舞台是否顯示在中間有紅毯的位置（true＝置中於紅毯正上方，符合「紅毯由舞台延伸」） */
    stageCentered: true
  };

  /* ─────────────────────────────────────────────────────────────────────────
     2. TABLES：每一桌的資料
        no    : 桌號（數字，會直接顯示在座位圖上，例如 5 → 顯示「5」）
        name  : 桌名（可選；例如「男方主桌」，沒有可省略或留空字串）
        seats : 該桌座位數（可選；省略時採用 VENUE.seatsPerTable）
        side  : 'left' 或 'right'（可選；省略時由程式依 tablesPerSide 自動左右分配）
     ─────────────────────────────────────────────────────────────────────────
     目前為 16 桌示範（桌號 1~16）。之後請依實際桌次圖替換順序即可。 */
  var TABLES = [
    { no: 1,  name: "男方主桌" },
    { no: 2,  name: "" },
    { no: 3,  name: "" },
    { no: 4,  name: "" },
    { no: 5,  name: "" },
    { no: 6,  name: "" },
    { no: 7,  name: "" },
    { no: 8,  name: "" },
    { no: 9,  name: "女方主桌" },
    { no: 10, name: "" },
    { no: 11, name: "" },
    { no: 12, name: "" },
    { no: 13, name: "" },
    { no: 14, name: "" },
    { no: 15, name: "" },
    { no: 16, name: "" }
  ];

  /* ─────────────────────────────────────────────────────────────────────────
     3. GUESTS：賓客名單
        name  : 姓名（必填）
        table : 桌號（必填，對應 TABLES[].no）
        seat  : 座位號（必填，1 起算；單桌座位數以 TABLES[].seats 為準）
        note  : 備註（可選；例如「素食」）

     ── 模糊／部分比對說明 ──
     查詢「王小明」或「小明」都能查到同一筆，因為程式會做「包含比對」。
     若同一姓名有多筆（同名不同人），會列出候選讓使用者點選。
     ⚠ 目前為【示範資料】，請於取得正式名單後整份替換。
     ─────────────────────────────────────────────────────────────────────────
     示範資料刻意包含：
       • 「王小明」與「王小明」兩筆同名不同桌 → 驗證同名候選功能
       • 「陳」姓多筆 → 驗證部分比對會列出多位候選
  */
  var GUESTS = [
    /* ── 1 桌 ── */
    { name: "王大明", table: 1,  seat: 1,  note: "新郎父親" },
    { name: "林月娥", table: 1,  seat: 2,  note: "新郎母親" },
    { name: "王志豪", table: 1,  seat: 3 },
    { name: "王志玲", table: 1,  seat: 4 },
    { name: "張文彬", table: 1,  seat: 5 },
    { name: "李秀英", table: 1,  seat: 6 },
    { name: "陳建宏", table: 1,  seat: 7 },
    { name: "吳美鳳", table: 1,  seat: 8 },

    /* ── 2 桌 ── */
    { name: "王小明", table: 2,  seat: 3,  note: "同名示範 A" },
    { name: "許淑芬", table: 2,  seat: 4 },
    { name: "鄭俊傑", table: 2,  seat: 5 },
    { name: "黃麗華", table: 2,  seat: 6 },
    { name: "劉家豪", table: 2,  seat: 7 },
    { name: "蔡宛庭", table: 2,  seat: 8 },

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

    /* ── 5 桌（任務說明的範例：「王小明-5桌」）── */
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
    { name: "柯佳嬿", table: 7,  seat: 4 },

    /* ── 8 桌 ── */
    { name: "羅時豐", table: 8,  seat: 1 },
    { name: "沈玉琳", table: 8,  seat: 2 },
    { name: "鍾欣凌", table: 8,  seat: 3 },
    { name: "嚴立婷", table: 8,  seat: 4 },

    /* ── 9 桌（女方主桌）── */
    { name: "杜振發", table: 9,  seat: 1,  note: "新娘父親" },
    { name: "郭秋菊", table: 9,  seat: 2,  note: "新娘母親" },
    { name: "杜伊菱", table: 9,  seat: 3,  note: "新娘妹妹" },
    { name: "杜仲凱", table: 9,  seat: 4 },
    { name: "江美琪", table: 9,  seat: 5 },
    { name: "范文芳", table: 9,  seat: 6 },

    /* ── 10 桌 ── */
    { name: "李宗盛", table: 10, seat: 1 },
    { name: "林憶蓮", table: 10, seat: 2 },
    { name: "張清芳", table: 10, seat: 3 },
    { name: "陳綺貞", table: 10, seat: 4 },
    { name: "盧廣仲", table: 10, seat: 5 },

    /* ── 11 桌 ── */
    { name: "林書豪", table: 11, seat: 1 },
    { name: "王建民", table: 11, seat: 2 },
    { name: "陳金鋒", table: 11, seat: 3 },
    { name: "彭政閔", table: 11, seat: 4 },

    /* ── 12 桌 ── */
    { name: "吳寶春", table: 12, seat: 1 },
    { name: "江振誠", table: 12, seat: 2 },
    { name: "詹姆士", table: 12, seat: 3 },
    { name: "阿基師", table: 12, seat: 4 },

    /* ── 13 桌 ── */
    { name: "蔡依林", table: 13, seat: 1 },
    { name: "周杰倫", table: 13, seat: 2 },
    { name: "五月天", table: 13, seat: 3 },
    { name: "田馥甄", table: 13, seat: 4 },

    /* ── 14 桌 ── */
    { name: "陳時中", table: 14, seat: 1 },
    { name: "賴清德", table: 14, seat: 2 },
    { name: "韓國瑜", table: 14, seat: 3 },
    { name: "柯文哲", table: 14, seat: 4 },

    /* ── 15 桌 ── */
    { name: "黃仁勳", table: 15, seat: 1 },
    { name: "張忠謀", table: 15, seat: 2 },
    { name: "郭台銘", table: 15, seat: 3 },
    { name: "林百里", table: 15, seat: 4 },

    /* ── 16 桌 ── */
    { name: "比爾蓋茲", table: 16, seat: 1, note: "示範" },
    { name: "馬斯克",   table: 16, seat: 2, note: "示範" },
    { name: "巴菲特",   table: 16, seat: 3, note: "示範" },
    { name: "賈伯斯",   table: 16, seat: 4, note: "示範" }
  ];

  /* ─────────────────────────────────────────────────────────────────────────
     4. 查詢／顯示設定（可選）
     ───────────────────────────────────────────────────────────────────────── */
  var OPTIONS = {
    /* 查不到時顯示的提示文字 */
    notFoundText: "查無此姓名，請確認輸入或洽現場招待",
    /* 同名候選時顯示的引導文字 */
    candidatesText: "找到多位同名或相似的賓客，請選擇：",
    /* 查詢結果文字中的桌次後綴，例如「王小明-5桌」 */
    tableSuffix: "桌",
    /* 每桌是否顯示座位位置（例如「5桌 · 第6位」） */
    showSeatLabel: true
  };

  /* ── 對外暴露（請勿更名，程式以此為進入點）── */
  window.SEATING_DATA = {
    VENUE: VENUE,
    TABLES: TABLES,
    GUESTS: GUESTS,
    OPTIONS: OPTIONS
  };
})();
