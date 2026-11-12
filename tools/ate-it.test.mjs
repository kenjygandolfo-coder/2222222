/* Dev-only test: the Logged meals "Ate it" mark is visual only.
   ateOn/ateShift/toggle/mpSig/tot are MIRRORED from index.html.
   Run: `node tools/ate-it.test.mjs` */
import assert from 'node:assert/strict';
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
let S;
function ateOn(d,i,e){const a=(S.ate||{})[d];return !!a&&a[i]==e.i}
function ateShift(d,i){const a=(S.ate||{})[d];if(!a)return;const o={};Object.keys(a).forEach(k=>{k=+k;if(k<i)o[k]=a[k];else if(k>i)o[k-1]=a[k]});if(Object.keys(o).length)S.ate[d]=o;else delete S.ate[d]}
function toggle(day,i){const e=(S.log[day]||[])[i];if(!e)return;const A=(S.ate??={})[day]??={};if(A[i]==e.i){delete A[i];if(!Object.keys(A).length)delete S.ate[day]}else A[i]=e.i}
function mpSig(list){return JSON.stringify((list||[]).map(e=>({i:e.i,q:e.q,m:e.m||MEALS[0]})))}
function tot(d){const t={k:0,p:0,c:0,f:0};(S.log[d]||[]).forEach(e=>{const f=S.foods.find(x=>x.id==e.i);if(!f)return;const m=f.b=='g'?e.q/100:e.q;for(const n of['k','p','c','f'])t[n]+=f[n]*m});return t}
const D = '2030-01-01';
const mk = () => { S = { foods: [{ id: 1, b: 'g', k: 100, p: 10, c: 5, f: 2 }, { id: 2, b: 'u', k: 50, p: 1, c: 2, f: 3 }], log: { [D]: [{ i: 1, q: 200, m: 'Lunch' }, { i: 2, q: 3, m: 'Snack' }, { i: 1, q: 50, m: 'Dinner' }] } }; };
let n = 0; const t = (name, fn) => { mk(); fn(); n++; console.log('ok  ' + name); };

t('toggle does not change totals, log or meal plan signature', () => {
  const sig = mpSig(S.log[D]), tt = JSON.stringify(tot(D)), raw = JSON.stringify(S.log);
  toggle(D, 0); toggle(D, 2);
  assert.ok(ateOn(D, 0, S.log[D][0]));
  assert.equal(mpSig(S.log[D]), sig); assert.equal(JSON.stringify(tot(D)), tt); assert.equal(JSON.stringify(S.log), raw);
});
t('toggle twice unmarks and cleans up', () => {
  toggle(D, 1); toggle(D, 1);
  assert.equal(S.ate[D], undefined);
});
t('remove shifts later marks correctly', () => {
  toggle(D, 0); toggle(D, 2);
  ateShift(D, 1); S.log[D].splice(1, 1);
  assert.ok(ateOn(D, 0, S.log[D][0])); assert.ok(ateOn(D, 1, S.log[D][1]));
  ateShift(D, 0); S.log[D].splice(0, 1);
  assert.ok(ateOn(D, 0, S.log[D][0])); assert.equal(Object.keys(S.ate[D]).length, 1);
});
t('stale mark with different food is ignored', () => {
  toggle(D, 0); S.log[D][0] = { i: 2, q: 1, m: 'Snack' };
  assert.ok(!ateOn(D, 0, S.log[D][0]));
});
console.log(n + ' passed');
