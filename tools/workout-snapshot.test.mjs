/* Dev-only unit test for workout snapshots (saved workouts are immutable).
   NOT shipped in the service-worker SHELL (tools/ is dev-only).
   Run: `node tools/workout-snapshot.test.mjs`; non-zero exit on failure.

   gFreeze() and the migration loop are MIRRORED VERBATIM from index.html
   (gMigWl takes its routine/day-items as parameters here instead of reading S). */
import assert from 'node:assert/strict';

function gFreeze(w,dayItems,unit){const items=(dayItems||[]).map(x=>({j:x.j,n:x.n,p:!!x.p,e:JSON.parse(JSON.stringify(x.e))})),have=new Set(items.map(x=>x.n)),ex=w.ex||{},wm=w.warm||{};items.forEach(x=>{const q=ex[x.n];if(Array.isArray(q)&&q.length>(x.e.s||0))x.e.s=q.length;const m=wm[x.n];if(Array.isArray(m)&&m.length>(x.e.w||0))x.e.w=m.length});let j=1000;[...Object.keys(ex),...Object.keys(wm)].forEach(n=>{if(have.has(n))return;have.add(n);const q=ex[n],m=wm[n];items.push({j:j++,n,p:false,e:{n,k:0,s:Array.isArray(q)?q.length:0,w:Array.isArray(m)?m.length:0}})});return{t:w.t,u:unit,items}}
function migrate(W,P,dayItemsOf,unit){let ch=false;Object.keys(W).forEach(k=>{const w=W[k];if(!w||w.sn)return;const di=P.findIndex(p=>p[1]==w.t);w.sn=gFreeze(w,di>=0?dayItemsOf(di):null,unit);ch=true});return ch}

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };

const fullBody = [['Mon', 'Full A', [{ n: 'Squat', k: 1, s: 3 }, { n: 'Bench', k: 1, s: 3 }]]];
const fiveDay = [['Mon', 'Push', [{ n: 'Bench', k: 1, s: 4 }]], ['Tue', 'Pull', [{ n: 'Row', k: 1, s: 4 }]]];
const itemsOf = P => di => P[di][2].map((e, j) => ({ j, n: e.n, p: e.k == 1, e }));
const mk = () => ({ d: '2024-01-01', t: 'Full A', ex: { Squat: [[100, 5, 2], [100, 5, 2], [100, 5, 2]], Bench: [[60, 8, 2]] }, warm: { Squat: [[40, 5]] } });

t('legacy entry frozen with its own names and sets', () => {
  const s = gFreeze(mk(), itemsOf(fullBody)(0), 'kg');
  assert.equal(s.t, 'Full A');
  assert.deepEqual(s.items.map(x => x.n), ['Squat', 'Bench']);
  assert.equal(s.items[0].e.s, 3);
  assert.equal(s.items[0].e.w, 1);
  assert.equal(s.items[0].p, true);
});

t('routine change does not alter the frozen snapshot', () => {
  const W = { a: mk() };
  migrate(W, fullBody, itemsOf(fullBody), 'kg');
  const before = JSON.stringify(W.a.sn);
  fullBody[0][2][0].s = 9; fullBody[0][1] = 'Renamed';
  migrate(W, fiveDay, itemsOf(fiveDay), 'kg');
  assert.equal(JSON.stringify(W.a.sn), before);
  fullBody[0][2][0].s = 3; fullBody[0][1] = 'Full A';
});

t('title absent from routine still gets items from ex keys', () => {
  const s = gFreeze(mk(), null, 'kg');
  assert.deepEqual(s.items.map(x => x.n), ['Squat', 'Bench']);
  assert.equal(s.items[0].e.s, 3);
  assert.equal(s.items[0].e.w, 1);
  assert.equal(s.items[1].p, false);
  assert.notEqual(s.items[0].j, s.items[1].j);
});

t('day items cover less than ex: extra names added, sets never fewer than logged', () => {
  const w = mk(); w.ex.Row = [[50, 10, 2]];
  const s = gFreeze(w, [{ j: 0, n: 'Squat', p: true, e: { n: 'Squat', k: 1, s: 1 } }], 'kg');
  assert.deepEqual(s.items.map(x => x.n), ['Squat', 'Bench', 'Row']);
  assert.equal(s.items[0].e.s, 3);
});

t('migration is idempotent and never overwrites an existing sn', () => {
  const W = { a: mk(), b: Object.assign(mk(), { sn: { t: 'Keep', u: 'kg', items: [] } }) };
  assert.equal(migrate(W, fiveDay, itemsOf(fiveDay), 'kg'), true);
  assert.equal(W.b.sn.t, 'Keep');
  const snap = JSON.stringify(W);
  assert.equal(migrate(W, fullBody, itemsOf(fullBody), 'kg'), false);
  assert.equal(JSON.stringify(W), snap);
});

console.log(`\n${passed} passed.`);
console.log('PASS: workout snapshot logic holds.');
