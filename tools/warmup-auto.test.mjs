/* Dev-only test for warmFromWork (approach-set auto-fill). The code is extracted from index.html.
   Run: node tools/warmup-auto.test.mjs */
import fs from 'fs';
import assert from 'assert/strict';
const src = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const a = src.indexOf('const WARM_RAMP='), b = src.indexOf('\n', src.indexOf('function warmFromWork'));
const z = src.indexOf('\n', src.indexOf('const rd=x=>', a)); // end of function body line
const warmFromWork = new Function(src.slice(a, z + 1) + 'return warmFromWork')();
let n = 0; const t = (name, f) => { f(); n++; console.log('ok  ' + name); };
const w = r => r.map(x => x[0]);
t('3 warm-ups lb, bar 45, plate pair 5', () => {
  assert.deepEqual(warmFromWork(132, 3, { bar: 45, inc: 5 }), [[90, 8], [110, 5], [132, 2]]);
  assert.deepEqual(w(warmFromWork(255, 3, { bar: 45, inc: 5 })), [180, 215, 255]);
});
t('kg rounding with 2.5 plate pair', () => assert.deepEqual(w(warmFromWork(100, 3, { bar: 20, inc: 5 })), [70, 85, 100]));
t('machine step rounding without bar', () => assert.deepEqual(w(warmFromWork(120, 3, { inc: 10 })), [80, 100, 120]));
t('working weight below the bar', () => assert.deepEqual(w(warmFromWork(40, 3, { bar: 45, inc: 5 })), [40, 40, 40]));
t('never below the bar when work above', () => assert.ok(warmFromWork(50, 3, { bar: 45, inc: 5 }).every(x => x[0] >= 45 && x[0] <= 50)));
t('monotonic and last equals work for every count', () => {
  for (const c of [1, 2, 3, 4, 5]) for (const wk of [47.5, 60, 132, 138, 255.5]) {
    const r = warmFromWork(wk, c, { bar: 45, inc: 5 }); assert.equal(r.length, c);
    assert.equal(r[c - 1][0], wk);
    for (let i = 1; i < c; i++) assert.ok(r[i][0] >= r[i - 1][0]);
    assert.ok(r.every(x => x[0] <= wk));
  }
});
t('invalid input gives empty', () => { assert.deepEqual(warmFromWork(0, 3, {}), []); assert.deepEqual(warmFromWork(NaN, 3, {}), []); assert.deepEqual(warmFromWork(100, 9, {}), []); });
console.log(n + ' passed');
