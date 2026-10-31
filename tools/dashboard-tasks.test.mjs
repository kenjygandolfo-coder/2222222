/* Dev-only unit test for the pure task-triage helper that powers the Planner
   Dashboard (Phase 6). NOT shipped in the service-worker SHELL (tools/ is
   dev-only). Run: `node tools/dashboard-tasks.test.mjs` - exits 0 with a PASS
   summary, non-zero on the first failed assertion.

   The dashboardTasks() body below is MIRRORED VERBATIM from index.html. If you
   change the convention in one place, change it in the other.
   Convention:
     - dashboardTasks(tasks, todayKey) triages the PENDING tasks (!done);
       completed tasks are always excluded. It returns
       { pendingCount, overdue:[...], dueToday:[...], upcoming:[...] } where:
         * pendingCount = number of pending (!done) tasks.
         * overdue  = pending with a due date strictly before today
           (t.due && t.due<todayKey), sorted by due ASC then created ASC.
         * dueToday = pending with t.due==todayKey, sorted by created ASC.
         * upcoming = remaining pending (no due, or due>todayKey), sorted by PORD
           priority (high>med>low) then dated-before-undated then due ASC then
           created ASC (mirrors V.tasks()'s pending order).
     - It never mutates the input (uses .slice()); null/undefined/empty input
       yields {pendingCount:0, overdue:[], dueToday:[], upcoming:[]}. */

// ---- MIRROR of index.html dashboardTasks() ----
function dashboardTasks(tasks,todayKey){const PORD={high:0,med:1,low:2};const pending=(tasks||[]).slice().filter(t=>t&&!t.done);
const overdue=pending.filter(t=>t.due&&t.due<todayKey).sort((a,b)=>a.due<b.due?-1:a.due>b.due?1:a.created-b.created);
const dueToday=pending.filter(t=>t.due==todayKey).sort((a,b)=>a.created-b.created);
const upcoming=pending.filter(t=>!t.due||t.due>todayKey).sort((a,b)=>{if(PORD[a.prio]!=PORD[b.prio])return PORD[a.prio]-PORD[b.prio];if(!!a.due!=!!b.due)return a.due?-1:1;if(a.due&&b.due&&a.due!=b.due)return a.due<b.due?-1:1;return a.created-b.created});
return{pendingCount:pending.length,overdue,dueToday,upcoming}}
// ---- end mirror ----

let failed = 0, passed = 0;
function assert(label, cond) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.error(`  FAIL  ${label}`); }
}
function eqArr(a, b) { return a.length === b.length && a.every((x, i) => x === b[i]); }
// task factory: id doubles as `created` unless overridden, so ordering is explicit.
const tk = (id, { done = false, prio = 'med', due = '', created = id } = {}) =>
  ({ id, title: 't' + id, desc: '', prio, due, remind: '', done, subtasks: [], created });
const ids = list => list.map(t => t.id);
const TODAY = '2024-06-15';

console.log('dashboardTasks edge cases:');

// null / undefined / empty input -> zeroed result with empty arrays
{
  for (const [label, input] of [['null', null], ['undefined', undefined], ['empty', []]]) {
    const out = dashboardTasks(input, TODAY);
    assert(`${label} -> pendingCount 0`, out.pendingCount === 0);
    assert(`${label} -> empty arrays`,
      out.overdue.length === 0 && out.dueToday.length === 0 && out.upcoming.length === 0);
  }
}

// done tasks are excluded from the count and every bucket
{
  const list = [
    tk(1, { done: true, due: '2024-06-01' }),   // done + overdue date -> excluded
    tk(2, { done: true, due: TODAY }),           // done + due today -> excluded
    tk(3, { done: false, due: TODAY }),          // pending due today
  ];
  const out = dashboardTasks(list, TODAY);
  assert('done excluded from pendingCount', out.pendingCount === 1);
  assert('done excluded from overdue', out.overdue.length === 0);
  assert('done excluded from dueToday', eqArr(ids(out.dueToday), [3]));
}

// overdue vs due-today vs future split with a fixed todayKey
{
  const list = [
    tk(1, { due: '2024-06-10' }), // overdue
    tk(2, { due: TODAY }),         // due today
    tk(3, { due: '2024-06-20' }), // future -> upcoming
  ];
  const out = dashboardTasks(list, TODAY);
  assert('overdue bucket', eqArr(ids(out.overdue), [1]));
  assert('dueToday bucket', eqArr(ids(out.dueToday), [2]));
  assert('future bucket -> upcoming', eqArr(ids(out.upcoming), [3]));
  assert('pendingCount counts all pending', out.pendingCount === 3);
}

// overdue sorted by due ASC then created ASC
{
  const list = [
    tk(3, { due: '2024-06-12', created: 1 }),
    tk(1, { due: '2024-06-10', created: 9 }),
    tk(2, { due: '2024-06-10', created: 2 }), // same due as id1, earlier created -> first
  ];
  const out = dashboardTasks(list, TODAY);
  assert('overdue sorted by due then created', eqArr(ids(out.overdue), [2, 1, 3]));
}

// dueToday sorted by created ASC
{
  const list = [
    tk(3, { due: TODAY, created: 30 }),
    tk(1, { due: TODAY, created: 10 }),
    tk(2, { due: TODAY, created: 20 }),
  ];
  const out = dashboardTasks(list, TODAY);
  assert('dueToday sorted by created', eqArr(ids(out.dueToday), [1, 2, 3]));
}

// a task with no due date is surfaced in the upcoming bucket
{
  const list = [tk(1, { prio: 'low', due: '' })];
  const out = dashboardTasks(list, TODAY);
  assert('no-due task -> upcoming', eqArr(ids(out.upcoming), [1]));
  assert('no-due task not overdue/dueToday',
    out.overdue.length === 0 && out.dueToday.length === 0);
}

// upcoming order: priority (high>med>low), then dated-before-undated, then due ASC, then created ASC
{
  const list = [
    tk(1, { prio: 'low', due: '' }),
    tk(2, { prio: 'high', due: '' }),
    tk(3, { prio: 'high', due: '2024-06-20' }), // high + has due -> before high undated
    tk(4, { prio: 'med', due: '' }),
  ];
  const out = dashboardTasks(list, TODAY);
  assert('upcoming priority + dated-first order', eqArr(ids(out.upcoming), [3, 2, 4, 1]));
}

// input array is not mutated (order preserved in the original)
{
  const list = [tk(3, { due: '2024-06-20' }), tk(1, { due: '2024-06-01' }), tk(2, { due: TODAY })];
  const before = ids(list);
  dashboardTasks(list, TODAY);
  assert('input array not mutated', eqArr(ids(list), before));
}

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed) { console.error('DASHBOARD TASKS TEST FAILED'); process.exit(1); }
console.log('PASS: all dashboardTasks edge cases hold.');
