global.window = {};
require('/workspace/webpages/jack-and-lily-wedding-v35/js/config.js');
var fs = require('fs');
var c = window.WEDDING_CONFIG;
var base = '/workspace/webpages/jack-and-lily-wedding-v35/';

var fail = 0;
function chk(cond, msg) { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fail++; }

// 1. theme order
var order = c.GALLERY_THEMES.map(function (t) { return t.NAME; }).join('>');
chk(order === '戰國>唐代>明朝', 'theme order 戰國>唐代>明朝 (got ' + order + ')');

// 2. preview 4-6 each
c.GALLERY_THEMES.forEach(function (t) {
  chk(t.FEATURED.length >= 4 && t.FEATURED.length <= 6, t.NAME + ' preview count = ' + t.FEATURED.length + ' (4-6)');
});

// 3. every SRC exists
var missing = [], all = [];
c.GALLERY_THEMES.forEach(function (t) {
  t.FEATURED.concat(t.MORE).forEach(function (p) { all.push(p.SRC); if (!fs.existsSync(base + p.SRC)) missing.push(p.SRC); });
});
chk(missing.length === 0, 'all gallery SRC exist (missing=' + missing.length + (missing.length ? ' ' + missing.join(',') : '') + ')');

// 4. no duplicates, counts
var uniq = Array.from(new Set(all));
chk(all.length === uniq.length, 'no duplicate gallery photos (items=' + all.length + ', unique=' + uniq.length + ')');
chk(all.length === 142, 'gallery total = 142 (got ' + all.length + ')');

// 5. per theme counts
var exp = { '戰國': 14, '唐代': 47, '明朝': 81 };
c.GALLERY_THEMES.forEach(function (t) {
  var n = t.FEATURED.length + t.MORE.length;
  chk(n === exp[t.NAME], t.NAME + ' total = ' + n + ' (expected ' + exp[t.NAME] + ')');
});

// 6. pool covers ALL photos, exists
var pm = c.ECARD_PHOTO_POOL.filter(function (p) { return !fs.existsSync(base + p); });
chk(pm.length === 0, 'all ECARD_PHOTO_POOL files exist (missing=' + pm.length + ')');
var pu = Array.from(new Set(c.ECARD_PHOTO_POOL));
chk(pu.length === c.ECARD_PHOTO_POOL.length, 'pool has no duplicates (' + c.ECARD_PHOTO_POOL.length + ')');
var poolSet = new Set(pu), galSet = new Set(uniq);
var poolCoversGal = uniq.every(function (p) { return poolSet.has(p); });
var galCoversPool = pu.every(function (p) { return galSet.has(p); });
chk(poolCoversGal && galCoversPool, 'ECARD_PHOTO_POOL == all gallery photos (pool=' + pu.length + ', gallery=' + uniq.length + ')');

// 7. featured photos are all couple shots (verified list)
var feat = [];
c.GALLERY_THEMES.forEach(function (t) { t.FEATURED.forEach(function (p) { feat.push(p.SRC.replace('images/album/', '')); }); });
var expectedFeat = ['zg1.jpg','zg2.jpg','zg3.jpg','zg4.jpg','n03.jpg','n04.jpg',
                    'tg1.jpg','tg2.jpg','tg3.jpg','tg4.jpg','n09.jpg','n13.jpg',
                    'p20.jpg','p49.jpg','p50.jpg','p52.jpg','p54.jpg','p56.jpg'];
chk(JSON.stringify(feat) === JSON.stringify(expectedFeat), 'preview photos = verified 兩人合照 set');

// 8. other config untouched
chk(c.SHEET_WEBAPP_URL.indexOf('AKfycbwMfQ2N') > 0, 'SHEET_WEBAPP_URL still set');
chk(c.RSVP_PREFILL_FORM === false, 'RSVP_PREFILL_FORM false');
chk(c.RSVP_SENDING_TEXT === '傳送中…', 'RSVP_SENDING_TEXT intact');

console.log('\n' + (fail === 0 ? 'ALL CONFIG CHECKS PASSED' : fail + ' CHECK(S) FAILED'));
process.exit(fail === 0 ? 0 : 1);
