/* Dev-only test for the Gym weekly volume + recovery logic. Pulls the REAL functions and
   constants out of index.html (no mirrored copies), so reverting the code makes it fail.
   Run: `node tools/gym-volume.test.mjs`; non-zero exit on failure. Not shipped in the SW shell. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extractor(src) {
function fn(name) {
    const i = src.indexOf('\nfunction ' + name + '(');
    if (i < 0) throw new Error('function not found: ' + name);
    let d = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) {
      if (src[k] === '{') d++;
      else if (src[k] === '}' && --d === 0) return src.slice(i + 1, k + 1);
    }
    throw new Error('unbalanced: ' + name);
  }
  /* single-line `const name=...` (may declare several comma separated consts on that line) */
  function konst(name) {
    const m = src.match(new RegExp('^const ' + name + '=.*$', 'm'));
    if (!m) throw new Error('const not found: ' + name);
    return m[0];
  }
  /* multi-line const: scan to the matching bracket, skipping strings and comments */
  function block(name) {
    const i = src.indexOf('\nconst ' + name + '=');
    if (i < 0) throw new Error('block not found: ' + name);
    let d = 0, k = src.indexOf('=', i) + 1, started = false;
    for (; k < src.length; k++) {
      const c = src[k];
      if (c === "'" || c === '"') { for (k++; src[k] !== c; k++) if (src[k] === '\\') k++; continue; }
      if (c === '/' && src[k + 1] === '*') { k = src.indexOf('*/', k) + 1; continue; }
      if ('{[('.includes(c)) { d++; started = true; }
      else if ('}])'.includes(c) && --d === 0 && started) return src.slice(i + 1, k + 1) + ';';
    }
    throw new Error('unbalanced: ' + name);
  }
  return { fn, konst, block };
}
const { fn, konst, block } = extractor(src);

const FNS = ['muscleOf', 'gvCredit', 'gvAdd', 'gvLog', 'gvPlan', 'gvStatus', 'gvFlags', 'gvReady', 'gMuscleSets'];
const CONSTS = ['r1', 'fmt', 'GV', 'MUSG', 'MUSL', 'GVUP', 'GVL', 'gvLbl', 'gvDay', 'gvMon', 'gvMus', 'gvSets', 'gvAgg', 'gvRatio', 'gvNorm'];
const code = [
  "const H='H',I='I';let LANG='en';",
  block('MMAP'), block('MRX'), block('MRX_ES'),
  ...CONSTS.map(konst), ...FNS.map(fn),
  'return{' + [...FNS, ...CONSTS.filter(c => c != 'GVUP'), 'GVUP', 'GVLO', 'MMAP', 'MRX', 'MRX_ES', 'setLang:v=>{LANG=v}', 'setPlan:(p,m)=>{PLAN=p;MX=m||{}}'].join(',') + '}',
].join('\n');
/* gMuscleSets reads gPlan/gday/gnm/gMethod: stubbed over a swappable plan */
const pre = "let PLAN=[],MX={};const gPlan=()=>PLAN,gday=i=>PLAN[i][2].map((e,j)=>({e,j})),gnm=(i,j,e)=>e.n,gMethod=n=>MX[n]||'equip';\n";
const G = new Function(pre + code)();

let passed = 0;
const t = (name, f) => { f(); passed++; console.log('ok  ' + name); };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' != ' + b);
const kindOf = n => (/squat|bench|row|press/i.test(n) ? 'H' : 'I');

t('mapping: exact MMAP names and EN keyword fallbacks', () => {
  assert.equal(G.muscleOf('Bench press').p, 'chest');
  assert.equal(G.muscleOf('Barbell overhead press').p, 'front delts');
  assert.deepEqual(G.muscleOf('Dumbbell shoulder press').s, ['side delts', 'triceps']);
  assert.equal(G.muscleOf('Incline dumbbell press').p, 'chest');
  assert.equal(G.muscleOf('Leg press').p, 'quads');
  assert.equal(G.muscleOf('Machine press').p, 'chest');
  assert.equal(G.muscleOf('Seated leg curl').p, 'hamstrings');
  assert.equal(G.muscleOf('Hammer curl').p, 'biceps');
  assert.equal(G.muscleOf('Rope pressdown').p, 'triceps');
});
t('mapping: rows give rear delts 0.5, pulldowns do not', () => {
  assert.ok(G.muscleOf('Seated cable row').s.includes('rear delts'));
  assert.ok(G.muscleOf('Barbell row').s.includes('rear delts'));
  assert.ok(!G.muscleOf('Lat pulldown').s.includes('rear delts'));
  assert.ok(!G.muscleOf('Wide-grip lat pulldown').s.includes('rear delts'));
});
t('mapping: Spanish names, accent-insensitive, curl femoral is not biceps', () => {
  assert.equal(G.muscleOf('Curl femoral').p, 'hamstrings');
  assert.equal(G.muscleOf('Curl con barra').p, 'biceps');
  assert.equal(G.muscleOf('Remo con barra').p, 'upper back');
  assert.equal(G.muscleOf('Elevaciones laterales').p, 'side delts');
  assert.equal(G.muscleOf('Elevación lateral en polea').p, 'side delts');
  assert.equal(G.muscleOf('Jalón al pecho').p, 'lats');
  assert.equal(G.muscleOf('Extensión de cuádriceps').p, 'quads');
  assert.equal(G.muscleOf('Sentadilla búlgara').p, 'quads');
  assert.equal(G.muscleOf('Peso muerto rumano').p, 'hamstrings');
  assert.equal(G.muscleOf('Empuje de cadera').p, 'glutes');
  assert.equal(G.muscleOf('Gemelos de pie').p, 'calves');
  assert.equal(G.muscleOf('Pájaros').p, 'rear delts');
  assert.equal(G.muscleOf('Press militar').p, 'front delts');
  assert.equal(G.muscleOf('Press banca').p, 'chest');
  assert.equal(G.muscleOf('Fondos').p, 'triceps');
  assert.equal(G.muscleOf('Plancha').p, 'abs');
  assert.equal(G.muscleOf('zzz unknown').p, null);
});
t('mapping: user override is the only direct target', () => {
  assert.deepEqual(G.gvMus('Zottman thing', { 'Zottman thing': 'biceps' }), { p: 'biceps', s: [] });
  assert.equal(G.gvMus('Bench press', { 'Bench press': 'triceps' }).p, 'triceps');
  assert.deepEqual(G.gvMus('Bench press', { 'Bench press': 'triceps' }).s, []);
  assert.equal(G.gvMus('Bench press', { 'Bench press': 'nonsense' }).p, 'chest');
  assert.equal(G.gvMus('Bench press', null).p, 'chest');
});
t('effective sets: RIR 4 counts, RIR 5 junk, blank counts', () => {
  assert.equal(G.gvSets([[100, 5, 4], [100, 5, 5], [100, 5, 0], [100, 5, null], [100, 5], [100, 5, ''], [100, 5, 9]]), 5);
  assert.equal(G.gvSets(undefined), 0);
  assert.equal(G.gvSets([]), 0);
});
t('credit: compound 1 + 0.5 secondary, isolation primary only, myo fixed 3 / 1.5', () => {
  const c = G.gvCredit('Bench press', 'H', false, 4, {});
  assert.deepEqual(c.map(x => [x.m, x.w, x.dir]), [['chest', 4, 1], ['triceps', 2, 0], ['front delts', 2, 0]]);
  assert.deepEqual(G.gvCredit('Pec deck', 'I', false, 4, {}).map(x => [x.m, x.w]), [['chest', 4]]);
  assert.deepEqual(G.gvCredit('Flat press or machine fly', 'I', false, 3, {}).map(x => x.m), ['chest']);
  const m = G.gvCredit('Bench press', 'I', true, 12, {});
  assert.deepEqual(m.map(x => [x.m, x.w]), [['chest', 3], ['triceps', 1.5], ['front delts', 1.5]]);
  assert.deepEqual(G.gvCredit('Bench press', 'I', true, 2, {}), m);
  assert.deepEqual(G.gvCredit('unknown thing', 'H', false, 3, {}), []);
});
t('ISO week bucketing: Monday start, Sunday belongs to previous Monday', () => {
  assert.equal(G.gvMon('2026-11-16'), '2026-11-16');
  assert.equal(G.gvMon('2026-11-22'), '2026-11-16');
  assert.equal(G.gvMon('2026-11-23'), '2026-11-23');
  assert.equal(G.gvMon('2026-03-01'), '2026-02-23');
  assert.equal(G.gvMon('2026-01-01'), '2025-12-29');
  assert.equal(G.gvMon('2024-03-03'), '2024-02-26');
  assert.equal(G.gvMon(''), '');
  assert.equal(G.gvDay('2026-12-31', 1), '2027-01-01');
});

const ctx = { ov: {}, mx: {}, kindOf };
const wk = (d, ex, extra = {}) => Object.assign({ d, t: 'Push', ex }, extra);
t('log: weekly aggregate with week filter, warm-ups ignored, RIR5 dropped', () => {
  const wl = {
    a: wk('2026-11-16', { 'Bench press': [[80, 5, 2], [80, 5, 2], [80, 5, 5]], 'Cable pushdown': [[30, 12, 0], [30, 12, 0]] }, { warm: { 'Bench press': [[40, 5], [50, 5]] } }),
    b: wk('2026-11-22', { 'Bench press': [[80, 5, 1], [80, 5, 1]] }),
    c: wk('2026-11-23', { 'Bench press': [[80, 5, 1]] }),
  };
  const r = G.gvLog(wl, '2026-11-16', ctx);
  assert.equal(r.sessions.length, 2);
  near(r.byMus.chest.sets, 4);
  near(r.byMus.chest.dir, 4);
  near(r.byMus.triceps.dir, 2);
  near(r.byMus.triceps.ind, 2);
  near(r.byMus.triceps.sets, 4);
  near(r.byMus['front delts'].ind, 2);
  assert.equal(G.gvLog(wl, '2026-11-23', ctx).sessions.length, 1);
  assert.equal(G.gvLog(wl, '2026-11-09', ctx).sessions.length, 0);
});
t('log: myo credits fixed 3 / 1.5 whatever the mini-set count, needs prime or an effective mini-set', () => {
  const ms = n => Array.from({ length: n }, () => [20, 3, 0]);
  const c2 = { ov: {}, mx: { 'Lateral raise': 'myo' }, kindOf };
  const w5 = { x: wk('2026-11-17', { 'Lateral raise': ms(5) }, { prime: { 'Lateral raise': [20, 12] } }) };
  const w9 = { x: wk('2026-11-17', { 'Lateral raise': ms(9) }, { prime: { 'Lateral raise': [20, 12] } }) };
  near(G.gvLog(w5, '2026-11-16', c2).byMus['side delts'].sets, 3);
  near(G.gvLog(w9, '2026-11-16', c2).byMus['side delts'].sets, 3);
  const noMini = { x: wk('2026-11-17', { 'Lateral raise': [[20, 3, 6]] }) };
  assert.equal(G.gvLog(noMini, '2026-11-16', c2).byMus['side delts'], undefined);
  const primeOnly = { x: wk('2026-11-17', { 'Lateral raise': [[20, 3, 6]] }, { prime: { 'Lateral raise': [20, 12] } }) };
  near(G.gvLog(primeOnly, '2026-11-16', c2).byMus['side delts'].sets, 3);
  const c3 = { ov: {}, mx: { 'Seated cable row': 'myo' }, kindOf };
  const row = { x: wk('2026-11-17', { 'Seated cable row': ms(5) }, { prime: { 'Seated cable row': [50, 10] } }) };
  const r = G.gvLog(row, '2026-11-16', c3);
  near(r.byMus.back.dir, 3);
  near(r.byMus.biceps.ind, 1.5);
  near(r.byMus['rear delts'].ind, 1.5);
});
t('log: snapshot kind wins over the live routine; routine changes do not rewrite history', () => {
  const w = { x: wk('2026-11-17', { 'Bench press': [[80, 5, 1], [80, 5, 1]] }, { sn: { t: 'Push', items: [{ j: 0, n: 'Bench press', e: { k: 'I', s: 2 } }] } }) };
  const iso = G.gvLog(w, '2026-11-16', { ov: {}, mx: {}, kindOf: () => 'H' });
  assert.equal(iso.byMus.triceps, undefined);
  const comp = { x: wk('2026-11-17', { 'Bench press': [[80, 5, 1], [80, 5, 1]] }, { sn: { t: 'Push', items: [{ j: 0, n: 'Bench press', e: { k: 'H', s: 2 } }] } }) };
  near(G.gvLog(comp, '2026-11-16', { ov: {}, mx: {}, kindOf: () => 'I' }).byMus.triceps.ind, 1);
  const noSn = G.gvLog({ x: wk('2026-11-17', { 'Bench press': [[80, 5, 1]] }) }, '2026-11-16', { ov: {}, mx: {}, kindOf: () => 'H' });
  near(noSn.byMus.triceps.ind, .5);
});
t('log: override changes the credited muscle, same group indirect is not double counted', () => {
  const w = { x: wk('2026-11-17', { 'Bench press': [[80, 5, 1], [80, 5, 1]] }) };
  const r = G.gvLog(w, '2026-11-16', { ov: { 'Bench press': 'triceps' }, mx: {}, kindOf });
  near(r.byMus.triceps.dir, 2);
  assert.equal(r.byMus.chest, undefined);
  const row = G.gvLog({ x: wk('2026-11-17', { 'T-bar row': [[60, 8, 1], [60, 8, 1]] }) }, '2026-11-16', ctx);
  near(row.byMus.back.sets, 2);
  near(row.byMus.biceps.ind, 1);
  near(row.byMus['rear delts'].ind, 1);
});
t('plan: planned weekly matches gMuscleSets conventions', () => {
  const e = (n, k, s) => ({ n, k, s });
  const plan = [
    ['Mon', 'Upper A', [e('Bench press', 'H', 4), e('Seated cable row', 'H', 3), e('Lateral raise', 'I', 3), e('Cable pushdown', 'I', 3), e('Incline biceps curl', 'I', 3)]],
    ['Wed', 'Lower', [e('Hack squat', 'H', 4), e('Romanian deadlift', 'H', 3), e('Seated leg curl', 'I', 3), e('Standing calf raise', 'I', 4), e('Hip thrust', 'H', 3)]],
    ['Fri', 'Upper B', [e('Incline press', 'H', 3), e('Lat pulldown', 'H', 4), e('Pec deck', 'I', 3), e('Lateral raise', 'I', 3)]],
  ];
  const mx = { 'Pec deck': 'myo', 'Lateral raise': 'myo' };
  G.setPlan(plan, mx);
  const ref = G.gMuscleSets();
  const items = plan.map(p => ({ t: p[1], ex: p[2].map(x => ({ n: x.n, k: x.k, s: x.s, myo: mx[x.n] == 'myo' })) }));
  const r = G.gvPlan(items, {});
  for (const g of ['chest', 'front delts', 'side delts', 'triceps', 'biceps', 'quads', 'hamstrings', 'glutes', 'calves', 'rear delts']) near(r.byMus[g].sets, ref[g].weekly);
  /* back differs only by the rows' lats credit (same group as the direct upper back credit) */
  near(ref.lats.weekly + ref['upper back'].weekly - r.byMus.back.sets, 3 * .5);
  assert.equal(r.sessions.length, 3);
});
t('status: band, above, red, cover rule, none', () => {
  assert.equal(G.gvStatus('chest', 9.5, 9.5, 0).k, 'low');
  assert.equal(G.gvStatus('chest', 10, 10, 0).k, 'ok');
  assert.equal(G.gvStatus('chest', 14, 14, 0).k, 'ok');
  assert.equal(G.gvStatus('chest', 14.5, 14.5, 0).k, 'high');
  assert.equal(G.gvStatus('chest', 18, 18, 0).k, 'high');
  assert.equal(G.gvStatus('chest', 18.5, 18.5, 0).k, 'red');
  assert.equal(G.gvStatus('chest', 0, 0, 0).k, 'none');
  assert.equal(G.gvStatus('rear delts', 6, 0, 6).k, 'cover');
  assert.equal(G.gvStatus('front delts', 8, 0, 8).k, 'cover');
  assert.equal(G.gvStatus('rear delts', 5.5, 0, 5.5).k, 'low');
  assert.equal(G.gvStatus('rear delts', 8, 2, 6).k, 'low');
  assert.equal(G.gvStatus('side delts', 6, 0, 6).k, 'low');
  assert.equal(G.gvStatus('rear delts', 0, 0, 0).k, 'none');
});
t('flags: more than 7 sets or more than 2 exercises for a muscle in one session', () => {
  const sess = [{ t: 'A', byMus: { chest: { sets: 7, dir: 7, ind: 0, ex: [{ n: 'a', dir: 4, ind: 0 }, { n: 'b', dir: 3, ind: 0 }] } } }];
  assert.deepEqual(G.gvFlags(sess), []);
  sess[0].byMus.chest.sets = 7.5;
  assert.deepEqual(G.gvFlags(sess).map(f => f.type), ['sets']);
  sess[0].byMus.chest.ex.push({ n: 'c', dir: 1, ind: 0 });
  assert.deepEqual(G.gvFlags(sess).map(f => f.type), ['sets', 'ex']);
  const ind = [{ t: 'B', byMus: { triceps: { sets: 4, dir: 0, ind: 4, ex: [{ n: 'a', dir: 0, ind: 1 }, { n: 'b', dir: 0, ind: 1 }, { n: 'c', dir: 0, ind: 1 }] } } }];
  assert.deepEqual(G.gvFlags(ind), []);
  const pl = G.gvPlan([{ t: 'X', ex: [{ n: 'Bench press', k: 'H', s: 4 }, { n: 'Incline press', k: 'H', s: 4 }, { n: 'Pec deck', k: 'I', s: 3 }] }], {});
  assert.deepEqual(G.gvFlags(pl.sessions).map(f => f.grp + f.type), ['chestsets', 'chestex']);
});
t('ratio: biceps <= back, triceps <= chest + shoulders', () => {
  assert.deepEqual(G.gvRatio({ biceps: 10, back: 10, triceps: 5, chest: 3, 'front delts': 1, 'side delts': 1 }), { bi: false, tri: false });
  assert.equal(G.gvRatio({ biceps: 10.5, back: 10 }).bi, true);
  assert.equal(G.gvRatio({ triceps: 10, chest: 5, 'front delts': 2, 'side delts': 2, 'rear delts': 1 }).tri, false);
  assert.equal(G.gvRatio({ triceps: 10.5, chest: 5, 'front delts': 2, 'side delts': 2, 'rear delts': 1 }).tri, true);
  assert.deepEqual(G.gvRatio({}), { bi: false, tri: false });
});

const base = { sl: [], sr: [], mo: [], dec: 0, stall: 0, dl: false, dleDays: null };
const rd = o => G.gvReady(Object.assign({}, base, o));
t('readiness: no data and active deload', () => {
  assert.equal(rd({}).k, 'none');
  assert.equal(rd({ sl: [5, 5] }).k, 'none');
  assert.equal(rd({ sl: [5, 5, 5], dl: true }).k, 'dl');
  assert.equal(rd({ sl: [8, 8, 8] }).k, 'ok');
});
t('readiness: sleep thresholds 7 h = 1 pt, 6.5 h = 2 pt, needs 3 days', () => {
  assert.equal(rd({ sl: [7, 7, 7] }).pts, 0);
  assert.equal(rd({ sl: [6.9, 6.9, 6.9] }).pts, 1);
  assert.equal(rd({ sl: [6.5, 6.5, 6.5] }).pts, 1);
  assert.equal(rd({ sl: [6.4, 6.4, 6.4] }).pts, 2);
  assert.deepEqual(rd({ sl: [6, 6, 6] }).why, ['Sleep averaged 6 h']);
  assert.equal(rd({ sl: [4, 4] }).k, 'none');
});
t('readiness: stress thresholds 3 = 1 pt, 3.5 = 2 pt, needs 2 days', () => {
  assert.equal(rd({ sr: [2.9, 2.9] }).pts, 0);
  assert.equal(rd({ sr: [3, 3] }).pts, 1);
  assert.equal(rd({ sr: [3.5, 3.5] }).pts, 2);
  assert.deepEqual(rd({ sr: [4, 4] }).why, ['Stress averaged 4 out of 5']);
  assert.equal(rd({ sr: [5] }).k, 'none');
});
t('readiness: mood needs 3 days, 2 low days = 1 pt, half low = 2 pt', () => {
  assert.equal(rd({ mo: [1, 1] }).k, 'none');
  assert.equal(rd({ mo: [2, 4, 4, 4, 4] }).pts, 0);
  assert.equal(rd({ mo: [2, 2, 4, 4, 4] }).pts, 1);
  assert.equal(rd({ mo: [2, 2, 4, 4] }).pts, 2);
  assert.equal(rd({ mo: [3, 3, 3] }).pts, 0);
  assert.deepEqual(rd({ mo: [1, 2, 4, 5] }).why, ['Mood low 2 of 4 days']);
});
t('readiness: performance, combined score and deload recommendation', () => {
  assert.equal(rd({ dec: 1 }).pts, 1);
  assert.equal(rd({ dec: 2 }).pts, 2);
  assert.equal(rd({ stall: 1 }).pts, 0);
  assert.equal(rd({ stall: 2 }).pts, 1);
  assert.deepEqual(rd({ dec: 2, stall: 3 }).why, ['2 lifts dropping', '3 lifts stalling']);
  assert.equal(rd({ dec: 1 }).why[0], '1 lift dropping');
  assert.equal(rd({ sl: [6, 6, 6], sr: [3.6, 3.6] }).k, 'deload');
  assert.equal(rd({ sl: [6.8, 6.8, 6.8], sr: [3, 3] }).k, 'watch');
  assert.equal(rd({ sl: [6, 6, 6], dec: 2 }).pts, 4);
  assert.equal(rd({ mo: [1, 1, 1], stall: 2 }).k, 'deload');
});
t('readiness: a deload that ended within 7 days downgrades the recommendation to watch', () => {
  const hi = { sl: [6, 6, 6], dec: 2 };
  assert.equal(rd(hi).k, 'deload');
  assert.equal(rd(Object.assign({ dleDays: 3 }, hi)).k, 'watch');
  assert.equal(rd(Object.assign({ dleDays: 7 }, hi)).k, 'watch');
  assert.equal(rd(Object.assign({ dleDays: 8 }, hi)).k, 'deload');
  assert.equal(rd(Object.assign({ dleDays: 2 }, { sl: [8, 8, 8] })).k, 'ok');
});
t('labels: LANG decides the muscle label (dictionary Back stays navigation)', () => {
  assert.equal(G.gvLbl('back'), 'Back');
  G.setLang('es');
  assert.equal(G.gvLbl('back'), 'Espalda');
  assert.equal(G.gvLbl('side delts'), 'Hombro lateral');
  G.setLang('en');
  assert.equal(G.gvLbl('side delts'), 'Lateral delts');
});

/* ---- gymapp.html port: same real code extracted from the older Gym tab ---- */
const gsrc = fs.readFileSync(new URL('../gymapp.html', import.meta.url), 'utf8');
const X = extractor(gsrc);
const gcode = [
  "let LANG='en';const S={gym:{days:3,ch:{}}},gkind=n=>(/bench|squat|row/i.test(n)?H:I);",
  X.konst('E'), 
  ...['D3', 'D4', 'D5'].map(n => X.block(n)), X.konst('GR'), X.konst('gdn'),
  X.block('MMAP'), X.block('MRX'), X.block('MRX_ES'),
  ...CONSTS.map(X.konst), ...FNS.filter(f => f != 'gMuscleSets').map(X.fn), X.konst('gvPlanItems'), X.konst('gvCtx'),
  'return{GR,gvPlanItems,gvPlan,gvLog,gvMon,gvStatus,gvCtx,muscleOf,MUSG,S}',
].join('\n');
let GA;
t('gymapp: ported block extracts and evaluates', () => { GA = new Function(gcode)(); assert.ok(GA.muscleOf && GA.gvPlanItems); });
t('gymapp: planned weekly sets come from the built-in routine for S.gym.days', () => {
  const items = GA.gvPlanItems();
  assert.equal(items.length, GA.GR[3].length);
  const p = GA.gvPlan(items, {});
  const authored = items.reduce((n, d) => n + d.ex.reduce((m, e) => m + e.s, 0), 0);
  assert.ok(authored > 0);
  const chest = p.byMus.chest;
  assert.ok(chest && chest.dir > 0 && chest.sets >= chest.dir);
  assert.equal(items[0].ex[0].myo, false);
  GA.S.gym.days = 4;
  assert.equal(GA.gvPlanItems().length, GA.GR[4].length);
  GA.S.gym.days = 3;
});
t('gymapp: swapped exercise (S.gym.ch) is used for the mapping', () => {
  GA.S.gym.ch['3:0:0'] = 'Lateral raise';
  assert.equal(GA.gvPlanItems()[0].ex[0].n, 'Lateral raise');
  GA.S.gym.ch = {};
});
t('gymapp: logged week uses the session snapshot and ISO Monday', () => {
  const wl = { '2026-11-08#1': { d: '2026-11-08', t: 'Full', ex: { 'Bench press': [[60, 8, 2], [60, 8, 2], [60, 8, 6]] }, sn: { items: [{ n: 'Bench press', e: { k: 'H' } }] } } };
  assert.equal(GA.gvMon('2026-11-08'), '2026-11-02');
  const l = GA.gvLog(wl, '2026-11-02', GA.gvCtx());
  assert.equal(l.byMus.chest.dir, 2);
  assert.equal(l.byMus.triceps.ind, 1);
  assert.equal(GA.gvLog(wl, '2026-11-09', GA.gvCtx()).sessions.length, 0);
});
t('gymapp: ported helpers are identical to index.html', () => {
  for (const f of ['gvCredit', 'gvAdd', 'gvLog', 'gvPlan', 'gvStatus', 'gvFlags', 'gvReady', 'muscleOf']) assert.equal(X.fn(f), fn(f), f);
  for (const c of ['GV', 'gvSets', 'gvMon', 'gvMus', 'gvAgg', 'gvRatio']) assert.equal(X.konst(c), konst(c), c);
  assert.equal(X.block('MMAP'), block('MMAP'));
});

console.log('\n' + passed + ' tests passed');
