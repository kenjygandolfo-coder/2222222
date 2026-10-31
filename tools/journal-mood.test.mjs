/* Dev-only unit test for the pure journal mood aggregation math (Phase 4).
   NOT shipped in the service-worker SHELL (tools/ is dev-only).
   Run: `node tools/journal-mood.test.mjs` — exits 0 with a PASS summary,
   non-zero on the first failed assertion.

   The moodSummary()/moodDistribution() bodies below are MIRRORED VERBATIM from
   index.html. If you change the convention in one place, change it in the other.
   Convention:
     - moodSummary(journal, days=30) looks back over the last `days` calendar
       days ending today (today included). points = days WITH a mood 1..5 in
       ascending date order, count = points.length, avg = mean rounded to one
       decimal (r1) or null when count==0.
     - moodDistribution(journal, days=30) = {1..5: count} over the same window.
     - Date stepping uses the same fmt()/new Date(y,m-1,d) local-midnight scheme
       as the app so keys line up with today(). */

const fmt = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
const today = () => fmt(new Date());
const r1 = n => Math.round(n * 10) / 10;

// ---- MIRROR of index.html moodSummary() / moodDistribution() ----
function moodSummary(journal,days=30){journal=journal||{};
const end=today(),[ey,em,ed]=end.split('-').map(Number),points=[];
for(let i=days-1;i>=0;i--){const dd=new Date(ey,em-1,ed-i),k=fmt(dd),e=journal[k];
if(e&&e.mood>=1&&e.mood<=5)points.push({d:k,mood:e.mood})}
const count=points.length,avg=count?r1(points.reduce((t,p)=>t+p.mood,0)/count):null;
return{points,count,avg}}
function moodDistribution(journal,days=30){const s=moodSummary(journal,days),out={1:0,2:0,3:0,4:0,5:0};
s.points.forEach(p=>{out[p.mood]++});return out}
// ---- end mirror ----

// Helpers to build day keys relative to today.
const dayKey = offset => { const x = new Date(); x.setDate(x.getDate() + offset); return fmt(x); };
const entry = (mood, text = '') => ({ mood, text, updated: 1 });

let failed = 0, passed = 0;
function assert(label, cond) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.error(`  FAIL  ${label}`); }
}
function eqArr(a, b) { return a.length === b.length && a.every((x, i) => x === b[i]); }

console.log('moodSummary / moodDistribution edge cases:');

// empty / null journal -> count 0, avg null
{
  const s = moodSummary({});
  assert('empty journal -> count 0', s.count === 0);
  assert('empty journal -> avg null', s.avg === null);
  assert('empty journal -> no points', s.points.length === 0);
  const sn = moodSummary(null);
  assert('null journal -> count 0, avg null', sn.count === 0 && sn.avg === null);
}

// single day -> count 1, avg equals that mood
{
  const j = { [dayKey(0)]: entry(4) };
  const s = moodSummary(j);
  assert('single day -> count 1', s.count === 1);
  assert('single day -> avg equals mood', s.avg === 4);
  assert('single day -> point date/mood correct', s.points[0].d === dayKey(0) && s.points[0].mood === 4);
}

// several days -> correct avg (rounded to 1 decimal) and ascending order
{
  const j = { [dayKey(-2)]: entry(5), [dayKey(-1)]: entry(2), [dayKey(0)]: entry(4) };
  const s = moodSummary(j);
  assert('several days -> count 3', s.count === 3);
  // mean of 5,2,4 = 11/3 = 3.666... -> 3.7
  assert('several days -> avg rounded to 1 decimal (3.7)', s.avg === 3.7);
  assert('several days -> points in ascending date order',
    eqArr(s.points.map(p => p.d), [dayKey(-2), dayKey(-1), dayKey(0)]));
  assert('several days -> moods follow dates', eqArr(s.points.map(p => p.mood), [5, 2, 4]));
}

// days OUTSIDE the N-day window are excluded
{
  const j = { [dayKey(0)]: entry(3), [dayKey(-29)]: entry(1), [dayKey(-30)]: entry(5), [dayKey(-45)]: entry(5) };
  const s = moodSummary(j, 30); // window = last 30 days: offsets 0..-29 included, -30 and -45 excluded
  assert('window excludes day -30 and -45', s.count === 2);
  assert('window keeps day 0 and -29', eqArr(s.points.map(p => p.d), [dayKey(-29), dayKey(0)]));
  // avg of 1 and 3 = 2.0
  assert('window avg correct (2)', s.avg === 2);
}

// a day with mood 0 (text-only) is ignored by the summary
{
  const j = { [dayKey(0)]: entry(0, 'just writing'), [dayKey(-1)]: entry(3) };
  const s = moodSummary(j);
  assert('mood 0 (text only) excluded', s.count === 1 && s.points[0].mood === 3);
}

// distribution counts per level are correct within the window
{
  const j = {
    [dayKey(0)]: entry(5), [dayKey(-1)]: entry(5), [dayKey(-2)]: entry(3),
    [dayKey(-3)]: entry(1), [dayKey(-4)]: entry(5), [dayKey(-40)]: entry(1)
  };
  const d = moodDistribution(j, 30);
  assert('distribution level 1 == 1', d[1] === 1);
  assert('distribution level 2 == 0', d[2] === 0);
  assert('distribution level 3 == 1', d[3] === 1);
  assert('distribution level 4 == 0', d[4] === 0);
  assert('distribution level 5 == 3', d[5] === 3);
  const total = d[1] + d[2] + d[3] + d[4] + d[5];
  assert('distribution total == in-window count (5)', total === 5);
}

// empty distribution -> all zeros
{
  const d = moodDistribution({});
  assert('empty distribution all zeros', d[1] === 0 && d[2] === 0 && d[3] === 0 && d[4] === 0 && d[5] === 0);
}

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed) { console.error('JOURNAL MOOD TEST FAILED'); process.exit(1); }
console.log('PASS: all moodSummary/moodDistribution edge cases hold.');
