/* Dev-only unit test for the pure habit streak math (Phase 3).
   NOT shipped in the service-worker SHELL (tools/ is dev-only).
   Run: `node tools/habit-streak.test.mjs` — exits 0 with a PASS summary,
   non-zero on the first failed assertion.

   The habitStreaks() body below is MIRRORED VERBATIM from index.html. If you
   change the convention in one place, change it in the other. Convention:
     - BEST    = longest run of consecutive calendar days true in log, ever.
     - CURRENT = consecutive done days ending TODAY; if today is not yet marked,
       counts the run ending YESTERDAY instead (so an unmarked today does not
       break an active run); 0 only when neither today nor yesterday is done.
     - A gap of >=1 missing day breaks a run. */

const fmt = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
const today = () => fmt(new Date());

// ---- MIRROR of index.html habitStreaks() (today() is the shared helper above) ----
function habitStreaks(log) {
  log = log || {};
  const keys = Object.keys(log).filter(k => log[k]).sort();
  if (!keys.length) return { current: 0, best: 0 };
  const dnum = k => { const [y, m, d] = k.split('-').map(Number); return Math.floor(new Date(y, m - 1, d).getTime() / 864e5); };
  const nums = keys.map(dnum);
  let best = 1, run = 1;
  for (let i = 1; i < nums.length; i++) { if (nums[i] == nums[i - 1] + 1) run++; else run = 1; if (run > best) best = run; }
  const set = new Set(nums), tn = dnum(today());
  let start = set.has(tn) ? tn : (set.has(tn - 1) ? tn - 1 : null), current = 0;
  if (start != null) { let c = start; while (set.has(c)) { current++; c--; } }
  return { current, best };
}
// ---- end mirror ----

// Helpers to build day keys relative to today.
const dayKey = offset => { const x = new Date(); x.setDate(x.getDate() + offset); return fmt(x); };
const logOf = (...offsets) => { const o = {}; for (const off of offsets) o[dayKey(off)] = true; return o; };

let failed = 0, passed = 0;
function eq(label, got, want) {
  const ok = got.current === want.current && got.best === want.best;
  if (ok) { passed++; console.log(`  PASS  ${label}  -> current=${got.current} best=${got.best}`); }
  else { failed++; console.error(`  FAIL  ${label}  -> got current=${got.current} best=${got.best}, want current=${want.current} best=${want.best}`); }
}

console.log('habitStreaks edge cases:');

// empty log
eq('empty log', habitStreaks({}), { current: 0, best: 0 });
eq('null log', habitStreaks(null), { current: 0, best: 0 });

// single done today
eq('single done today', habitStreaks(logOf(0)), { current: 1, best: 1 });

// single done yesterday, today not done -> current counts the run ending yesterday
eq('single done yesterday (today unmarked)', habitStreaks(logOf(-1)), { current: 1, best: 1 });

// 5-day consecutive run ending today
eq('5-day run ending today', habitStreaks(logOf(-4, -3, -2, -1, 0)), { current: 5, best: 5 });

// 5-day run ending yesterday, today not yet marked -> current still equals run length
eq('5-day run ending yesterday (today unmarked)', habitStreaks(logOf(-5, -4, -3, -2, -1)), { current: 5, best: 5 });

// gap in the middle: best = longest run, current = tail run only
// days: -10..-7 (run of 4), gap at -6, then -2,-1,0 (run of 3 ending today)
eq('mid gap (best longest, current tail)', habitStreaks(logOf(-10, -9, -8, -7, -2, -1, 0)), { current: 3, best: 4 });

// gap where the older run is the current tail (ending today) but a longer older block exists
eq('mid gap current shorter than best', habitStreaks(logOf(-20, -19, -18, -17, -16, -1, 0)), { current: 2, best: 5 });

// fully non-consecutive days, none touching today/yesterday -> current 0, best 1
eq('non-consecutive, none recent', habitStreaks(logOf(-10, -7, -4)), { current: 0, best: 1 });

// non-consecutive but one is today -> current 1, best 1
eq('non-consecutive, one is today', habitStreaks(logOf(-10, -7, 0)), { current: 1, best: 1 });

// old block only, nothing near today -> current 0, best = block length
eq('old block only (current 0)', habitStreaks(logOf(-30, -29, -28)), { current: 0, best: 3 });

// today + a stale run that does not touch yesterday -> current 1 (only today), best = stale run
eq('today plus stale run', habitStreaks(logOf(-10, -9, -8, 0)), { current: 1, best: 3 });

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed) { console.error('STREAK TEST FAILED'); process.exit(1); }
console.log('PASS: all habitStreaks edge cases hold.');
