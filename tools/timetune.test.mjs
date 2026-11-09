/* Dev-only unit test for the Daily routine (TimeTune) pure helpers.
   Loads the block between TT-PURE-START/END in index.html verbatim.
   Run: node tools/timetune.test.mjs */
import fs from 'fs';
import assert from 'assert';
const src = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const m = src.match(/\/\* TT-PURE-START \*\/([\s\S]*?)\/\* TT-PURE-END \*\//);
assert(m, 'pure block not found');
const T = new Function(m[1] + 'return{ttMin,ttFmt,ttInp,ttEnd,ttSnap,ttClamp,ttMove,ttPx,ttFromPx,ttInk,ttLayout,ttDay,ttFor,ttNowMin,ttAssign,ttDelTpl,ttDefault,ttNorm,TT_DAYS,TT_PAL}')();

// time <-> string
assert.equal(T.ttMin('07:30'), 450); assert.equal(T.ttMin('24:00'), 1440);
assert(isNaN(T.ttMin('25:00'))); assert(isNaN(T.ttMin('9:75'))); assert(isNaN(T.ttMin('')));
assert.equal(T.ttFmt(450), '07:30'); assert.equal(T.ttFmt(1440), '24:00'); assert.equal(T.ttFmt(-5), '00:00');
assert.equal(T.ttInp(1440), '00:00'); assert.equal(T.ttEnd('00:00'), 1440); assert.equal(T.ttEnd('10:00'), 600);
// position
assert.equal(T.ttPx(60), 60); assert.equal(T.ttPx(60, 2), 120); assert.equal(T.ttFromPx(120, 2), 60);
// snap / clamp / move
assert.equal(T.ttSnap(62, 5), 60); assert.equal(T.ttSnap(67, 15), 60); assert.equal(T.ttSnap(70, 15), 75);
assert.deepEqual(T.ttClamp(-10, 5), [0, 5]); assert.deepEqual(T.ttClamp(1439, 1500), [1435, 1440]); assert.deepEqual(T.ttClamp(600, 600), [600, 605]);
assert.deepEqual(T.ttMove({ s: 600, e: 660 }, 633, 5), { s: 635, e: 695 });
assert.deepEqual(T.ttMove({ s: 600, e: 660 }, -50, 5), { s: 0, e: 60 });
assert.deepEqual(T.ttMove({ s: 600, e: 660 }, 5000, 5), { s: 1380, e: 1440 });
// ink contrast
assert.equal(T.ttInk('#F59E0B'), '#1b1b1b'); assert.equal(T.ttInk('#3B82F6'), '#fff'); assert.equal(T.ttInk('bad'), '#fff');
// overlap layout
let L = T.ttLayout([{ id: 'a', s: 0, e: 60 }, { id: 'b', s: 30, e: 90 }, { id: 'c', s: 60, e: 120 }, { id: 'd', s: 200, e: 260 }]);
assert.deepEqual(L.a, { lane: 0, lanes: 2 }); assert.deepEqual(L.b, { lane: 1, lanes: 2 });
assert.deepEqual(L.c, { lane: 0, lanes: 2 }); assert.deepEqual(L.d, { lane: 0, lanes: 1 });
assert.deepEqual(T.ttLayout([{ id: 'x', s: 0, e: 60 }, { id: 'y', s: 60, e: 120 }]), { x: { lane: 0, lanes: 1 }, y: { lane: 0, lanes: 1 } });
// template for date (2026-11-09 is a Monday)
const tt = T.ttDefault();
assert.equal(T.ttDay('2026-11-09'), 'Mon'); assert.equal(T.ttDay('2026-11-14'), 'Sat'); assert.equal(T.ttDay('2026-11-15'), 'Sun');
assert.equal(T.ttFor(tt, '2026-11-09').id, 'wd'); assert.equal(T.ttFor(tt, '2026-11-15').id, 'we');
T.ttAssign(tt, 'Sun', 'wd'); assert.equal(T.ttFor(tt, '2026-11-15').id, 'wd');
T.ttAssign(tt, 'Sun', 'nope'); assert.equal(tt.assign.Sun, 'wd');
assert.equal(T.ttNowMin(new Date(2026, 10, 9, 13, 45)), 825);
// delete template reassigns, keeps at least one
assert.equal(T.ttDelTpl(tt, 'wd'), true); assert.equal(tt.templates.length, 1); assert(T.TT_DAYS.every(d => tt.assign[d] == 'we'));
assert.equal(T.ttDelTpl(tt, 'we'), false);
// normalisation of untrusted/imported data
assert.equal(T.ttNorm(undefined).templates.length, 2); assert.equal(T.ttNorm([]).templates.length, 2);
const bad = T.ttNorm({ n: 5, templates: [{ id: 1, name: '', blocks: [{ id: 'q', title: 'x<b>', icon: '', color: 'red;x', s: 900, e: 100 }, { id: 'q', s: 'z', e: 5 }, { id: 'q', s: 0, e: 30, color: '#ef4444' }] }], assign: { Mon: 'zz' } });
assert.equal(bad.templates.length, 1); assert.equal(bad.templates[0].name, 'Routine'); assert.equal(bad.templates[0].blocks.length, 2);
const bl = bad.templates[0].blocks; assert(bl.every(b => b.e > b.s && /^#[0-9A-F]{6}$/i.test(b.color)));
assert.notEqual(bl[0].id, bl[1].id); assert(T.TT_DAYS.every(d => bad.assign[d] == '1'));
assert(!JSON.stringify(T.ttNorm(T.ttDefault())).includes('undefined'));
console.log('timetune ok');
