/* Dev-only unit test for the pure calendar grouping/sorting helper (Phase 5).
   NOT shipped in the service-worker SHELL (tools/ is dev-only).
   Run: `node tools/calendar-group.test.mjs` - exits 0 with a PASS summary,
   non-zero on the first failed assertion.

   The upcomingEvents() body below is MIRRORED VERBATIM from index.html. If you
   change the convention in one place, change it in the other.
   Convention:
     - upcomingEvents(events, todayKey) returns the events whose date
       ('YYYY-MM-DD') is todayKey or later (date >= todayKey), sorted ASCENDING
       by date then time. An empty time ('') sorts before any set time, so an
       all-day event leads its day.
     - It never mutates the input; null/empty input yields an empty array. */

// ---- MIRROR of index.html upcomingEvents() ----
function upcomingEvents(events,todayKey){return(events||[]).filter(e=>e&&e.date&&e.date>=todayKey).slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.time||'')<(b.time||'')?-1:(a.time||'')>(b.time||'')?1:0)}
// ---- end mirror ----

// ---- MIRROR of index.html pastEvents() ----
// pastEvents(events, todayKey) returns events with date strictly before today
// (today excluded), sorted DESCENDING by date then time (most recent first).
// It never mutates the input; null/empty input yields an empty array.
function pastEvents(events,todayKey){return(events||[]).filter(e=>e&&e.date&&e.date<todayKey).slice().sort((a,b)=>a.date>b.date?-1:a.date<b.date?1:(a.time||'')>(b.time||'')?-1:(a.time||'')<(b.time||'')?1:0)}
// ---- end mirror ----

let failed = 0, passed = 0;
function assert(label, cond) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.error(`  FAIL  ${label}`); }
}
function eqArr(a, b) { return a.length === b.length && a.every((x, i) => x === b[i]); }
const ev = (id, date, time = '', title = '') => ({ id, date, time, title, desc: '', created: id });
const ids = list => list.map(e => e.id);

console.log('upcomingEvents edge cases:');

// empty / null input -> empty array
{
  assert('empty array -> []', upcomingEvents([], '2024-06-01').length === 0);
  assert('null events -> []', upcomingEvents(null, '2024-06-01').length === 0);
  assert('undefined events -> []', upcomingEvents(undefined, '2024-06-01').length === 0);
}

// past events (date < today) are excluded, today and future are kept
{
  const list = [ev(1, '2024-05-31'), ev(2, '2024-06-01'), ev(3, '2024-06-02')];
  const out = upcomingEvents(list, '2024-06-01');
  assert('past event excluded', !ids(out).includes(1));
  assert('today kept, future kept', eqArr(ids(out), [2, 3]));
}

// sorted ascending by date
{
  const list = [ev(3, '2024-06-10'), ev(1, '2024-06-02'), ev(2, '2024-06-05')];
  const out = upcomingEvents(list, '2024-06-01');
  assert('ascending by date', eqArr(ids(out), [1, 2, 3]));
}

// same day: empty time (all day) sorts before a set time, then by time ascending
{
  const list = [ev(3, '2024-06-02', '18:30'), ev(1, '2024-06-02', ''), ev(2, '2024-06-02', '09:00')];
  const out = upcomingEvents(list, '2024-06-01');
  assert('same-day: all-day first then by time', eqArr(ids(out), [1, 2, 3]));
}

// mixed dates and times together
{
  const list = [
    ev(4, '2024-06-03', '08:00'),
    ev(2, '2024-06-02', '12:00'),
    ev(1, '2024-06-02', ''),
    ev(3, '2024-06-02', '12:00'),
    ev(5, '2024-05-01', '00:00') // past -> dropped
  ];
  const out = upcomingEvents(list, '2024-06-01');
  assert('mixed: past dropped, rest date-then-time ordered',
    eqArr(ids(out), [1, 2, 3, 4]));
}

// events with no date are ignored
{
  const list = [ev(1, '2024-06-02'), { id: 2, time: '', title: 'no date' }];
  const out = upcomingEvents(list, '2024-06-01');
  assert('event without a date is ignored', eqArr(ids(out), [1]));
}

// input array is not mutated (order preserved in the original)
{
  const list = [ev(3, '2024-06-10'), ev(1, '2024-06-02')];
  const before = ids(list);
  upcomingEvents(list, '2024-06-01');
  assert('input array not mutated', eqArr(ids(list), before));
}

// a date exactly equal to today is included (boundary)
{
  const out = upcomingEvents([ev(1, '2024-06-01', '10:00')], '2024-06-01');
  assert('date == today is included (>=)', out.length === 1 && out[0].id === 1);
}

console.log('\npastEvents edge cases:');

// empty / null input -> empty array
{
  assert('past: empty array -> []', pastEvents([], '2024-06-01').length === 0);
  assert('past: null events -> []', pastEvents(null, '2024-06-01').length === 0);
}

// only strictly-past events are selected; today and future are excluded
{
  const list = [ev(1, '2024-05-30'), ev(2, '2024-05-31'), ev(3, '2024-06-01'), ev(4, '2024-06-02')];
  const out = pastEvents(list, '2024-06-01');
  assert('past: only date < today selected', eqArr(ids(out), [2, 1]));
  assert('past: today excluded', !ids(out).includes(3));
  assert('past: future excluded', !ids(out).includes(4));
}

// sorted descending by date (most recent first)
{
  const list = [ev(1, '2024-05-02'), ev(3, '2024-05-20'), ev(2, '2024-05-10')];
  const out = pastEvents(list, '2024-06-01');
  assert('past: descending by date', eqArr(ids(out), [3, 2, 1]));
}

// same day: later time sorts first (descending by time)
{
  const list = [ev(1, '2024-05-10', '09:00'), ev(3, '2024-05-10', '18:30'), ev(2, '2024-05-10', '12:00')];
  const out = pastEvents(list, '2024-06-01');
  assert('past: same-day descending by time', eqArr(ids(out), [3, 2, 1]));
}

// input array is not mutated
{
  const list = [ev(1, '2024-05-02'), ev(3, '2024-05-20'), ev(2, '2024-05-10')];
  const before = ids(list);
  pastEvents(list, '2024-06-01');
  assert('past: input array not mutated', eqArr(ids(list), before));
}

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed) { console.error('CALENDAR GROUP TEST FAILED'); process.exit(1); }
console.log('PASS: all upcomingEvents edge cases hold.');
