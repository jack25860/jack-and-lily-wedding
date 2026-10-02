#!/usr/bin/env node
/**
 * v36 config verification: GALLERY_THEMES dynasty split + ECARD_PHOTO_POOL coverage.
 * Loads js/config.js in a sandbox and asserts the corrected classification.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const cfgSrc = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(cfgSrc, sandbox);
const C = sandbox.window.WEDDING_CONFIG;

let pass = 0, fail = 0;
const results = [];
function chk(tag, name, cond, extra) {
  results.push([tag, name, !!cond, extra]);
  if (cond) { pass++; console.log('PASS [' + tag + '] ' + name); }
  else { fail++; console.log('FAIL [' + tag + '] ' + name + '  ' + JSON.stringify(extra)); }
}

const themes = C.GALLERY_THEMES;
chk('themes', '三個主題', themes.length === 3, themes.length);
chk('themes', '順序 戰國 → 唐代 → 明朝', themes.map(t => t.NAME).join(',') === '戰國,唐代,明朝', themes.map(t => t.NAME));

const albumDir = path.join(ROOT, 'images', 'album');
const onDisk = fs.readdirSync(albumDir).filter(f => f.endsWith('.jpg')).map(f => f.replace('.jpg', ''));
const all = [];
themes.forEach(t => {
  const files = [...t.FEATURED, ...t.MORE].map(x => x.SRC.replace('images/album/', '').replace('.jpg', ''));
  all.push(...files);
  chk('themes', t.NAME + ' 預覽 4-6 張', t.FEATURED.length >= 4 && t.FEATURED.length <= 6, t.FEATURED.length);
  chk('themes', t.NAME + ' 全部檔案存在', files.every(f => fs.existsSync(path.join(albumDir, f + '.jpg'))), files.filter(f => !fs.existsSync(path.join(albumDir, f + '.jpg'))));
});
chk('themes', '全部 142 張、無重複、無遺漏', all.length === 142 && new Set(all).size === 142 && onDisk.every(f => all.includes(f)), [all.length, new Set(all).size, onDisk.length]);

// corrected dynasty split
const byName = {};
themes.forEach(t => { byName[t.NAME] = [...t.FEATURED, ...t.MORE].map(x => x.SRC.replace('images/album/', '').replace('.jpg', '')); });
chk('split', '戰國 39 張', byName['戰國'].length === 39, byName['戰國'].length);
chk('split', '唐代 47 張', byName['唐代'].length === 47, byName['唐代'].length);
chk('split', '明朝 56 張', byName['明朝'].length === 56, byName['明朝'].length);
chk('split', '戰國含 n50-n74（黑甲冑）', ['n50', 'n60', 'n74'].every(f => byName['戰國'].includes(f)), 'missing');
chk('split', '戰國不含 n49（唐代）', !byName['戰國'].includes('n49'), 'n49 wrongly in ZG');
chk('split', '唐代含 n09-n49', ['n09', 'n30', 'n49'].every(f => byName['唐代'].includes(f)), 'missing');
chk('split', '唐代不含 n50', !byName['唐代'].includes('n50'), 'n50 wrongly in TG');
chk('split', '明朝僅 p01-p56', byName['明朝'].every(f => f.startsWith('p')), byName['明朝'].filter(f => !f.startsWith('p')));
chk('split', '明朝不含任何 n*', !byName['明朝'].some(f => f.startsWith('n')), byName['明朝'].filter(f => f.startsWith('n')));

// pool
const pool = C.ECARD_PHOTO_POOL.map(p => p.replace('images/album/', '').replace('.jpg', ''));
chk('pool', 'ECARD_PHOTO_POOL 142 張', pool.length === 142, pool.length);
chk('pool', 'pool 無重複', new Set(pool).size === 142, new Set(pool).size);
chk('pool', 'pool 與相簿完全一致', pool.length === all.length && pool.every(f => all.includes(f)) && all.every(f => pool.includes(f)), 'mismatch');

// featured couple shots (verified visually) present
chk('featured', '戰國預覽含兩人合照 n03/n04', ['n03', 'n04'].every(f => byName['戰國'].slice(0, 6).includes(f)), byName['戰國'].slice(0, 6));
chk('featured', '唐代預覽含兩人合照 n09/n13', ['n09', 'n13'].every(f => byName['唐代'].slice(0, 6).includes(f)), byName['唐代'].slice(0, 6));
chk('featured', '明朝預覽含兩人合照 p20/p49', ['p20', 'p49'].every(f => byName['明朝'].slice(0, 6).includes(f)), byName['明朝'].slice(0, 6));

// unchanged settings
chk('keep', 'SHEET_WEBAPP_URL 已設定', /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(C.SHEET_WEBAPP_URL), C.SHEET_WEBAPP_URL);
chk('keep', 'RSVP_SENDING_TEXT 存在', !!C.RSVP_SENDING_TEXT, C.RSVP_SENDING_TEXT);
chk('keep', 'RSVP_THANKS_TITLE = 感謝您的回覆', C.RSVP_THANKS_TITLE === '感謝您的回覆', C.RSVP_THANKS_TITLE);
chk('keep', 'ECARD_VIDEO_URL 預留欄位存在', 'ECARD_VIDEO_URL' in C, 'missing');

console.log('\n==== ' + pass + '/' + (pass + fail) + ' PASSED ====');
results.filter(x => !x[2]).forEach(x => console.log('  FAIL [' + x[0] + '] ' + x[1] + ' :: ' + JSON.stringify(x[3])));
process.exit(fail === 0 ? 0 : 1);
