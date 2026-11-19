/* Dev-only test for skipped exercises and workout re-dating in the gym log. Pulls the REAL
   functions out of index.html and gymapp.html (no mirrored copies).
   Run: `node tools/gym-log-skip-date.test.mjs`; non-zero exit on failure. Not shipped in the SW shell. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

function load(file) {
  const src = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const fn = name => {
    const i = src.indexOf('\nfunction ' + name + '(');
    if (i < 0) throw new Error(file + ': function not found: ' + name);
    let d = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) {
      if (src[k] === '{') d++;
      else if (src[k] === '}' && --d === 0) return src.slice(i + 1, k + 1);
    }
    throw new Error('unbalanced: ' + name);
  };
  const konst = name => {
    const m = src.match(new RegExp('^const ' + name + '=.*$', 'm'));
    if (!m) throw new Error(file + ': const not found: ' + name);
    return m[0];
  };
  /* single `const x=...` line declaring gwDone,gwSkipped,gwSkipN */
  const helpers = src.match(/^const gwDone=.*$/m);
  if (!helpers) throw new Error(file + ': gwDone not found');
  const code = [
    'let S={gym:{wl:{}}},glk=null,glgKey=null;', helpers[0],
    ...['gSkipEntry', 'gUnskipEntry', 'gDateErr', 'gRedate', 'gvLog'].map(n => (n == 'gvLog' ? '' : fn(n))),
    /* last-session lookup exactly as the app does it (index: gLastSets, gymapp: glast) */
    konst(file == 'index.html' ? 'gLastSets' : 'glast'),
    'return{gwDone,gwSkipped,gwSkipN,gSkipEntry,gUnskipEntry,gDateErr,gRedate,S,last:' + (file == 'index.html' ? 'gLastSets' : 'glast') + ',setKey:k=>{glgKey=k;glk=k}}',
  ].join('\n');
  return { G: new Function(code)(), src, fn, konst };
}

let passed = 0;
const t = (name, f) => { f(); passed++; console.log('ok  ' + name); };

for (const file of ['index.html', 'gymapp.html']) {
  const { G, src, fn } = load(file);
  const mk = () => ({
    '2026-05-01#1000': { d: '2026-05-01', t: 'Push', ex: { Bench: [[60, 8, 2]], Press: [[30, 10, 2]] }, warm: { Bench: [[40, 5]] }, sn: { t: 'Push', u: 'kg', items: [] } },
    '2026-05-03#2000': { d: '2026-05-03', t: 'Push', ex: { Bench: [[65, 8, 2]] }, sn: { t: 'Push', u: 'kg', items: [] } },
  });

  t(file + ': skip removes the exercise data and records skip:{name:1}', () => {
    const o = mk()['2026-05-01#1000'], w = G.gSkipEntry(o, 'Bench');
    assert.equal(w.skip.Bench, 1);
    assert.equal(w.ex.Bench, undefined);
    assert.deepEqual(w.ex.Press, [[30, 10, 2]]);
    assert.equal(w.warm, undefined);
    assert.ok(o.ex.Bench, 'input entry not mutated');
    assert.ok(G.gwSkipped(w, 'Bench') && !G.gwSkipped(w, 'Press'));
    assert.equal(G.gwSkipN(w), 1);
    assert.ok(w.sn, 'snapshot kept');
  });

  t(file + ': unskip restores a clean entry', () => {
    const w = G.gUnskipEntry(G.gSkipEntry(mk()['2026-05-01#1000'], 'Bench'), 'Bench');
    assert.equal(w.skip, undefined);
    assert.equal(G.gwSkipN(w), 0);
  });

  t(file + ': fully skipped entry is not a workout, a mixed one is', () => {
    const e = { d: '2026-05-04', t: 'Push', ex: {}, sn: {} };
    assert.equal(G.gwDone(G.gSkipEntry(e, 'Bench')), false);
    assert.equal(G.gwDone(G.gSkipEntry(mk()['2026-05-01#1000'], 'Bench')), true);
    assert.equal(G.gwDone(null), false);
  });

  t(file + ': prefill falls back to the previous session that really did the lift', () => {
    const W = mk();
    W['2026-05-05#3000'] = G.gSkipEntry({ d: '2026-05-05', t: 'Push', ex: {}, sn: {} }, 'Bench');
    G.S.gym.wl = W;
    assert.deepEqual(G.last('Bench'), [[65, 8, 2]]);
    /* skipping Bench inside the newest entry that also logged Press still falls back */
    W['2026-05-06#4000'] = G.gSkipEntry({ d: '2026-05-06', t: 'Push', ex: { Press: [[32, 10, 2]] }, sn: {} }, 'Bench');
    assert.deepEqual(G.last('Bench'), [[65, 8, 2]]);
    assert.deepEqual(G.last('Press'), [[32, 10, 2]]);
  });

  t(file + ': weekly volume ignores skipped exercises and fully skipped entries', () => {
    const wl = mk(), g = G.gSkipEntry({ d: '2026-05-04', t: 'Push', ex: {}, sn: {} }, 'Bench');
    wl['2026-05-04#9'] = g;
    wl['2026-05-01#1000'] = G.gSkipEntry(wl['2026-05-01#1000'], 'Bench');
    const code = [
      "const gvMon=d=>'W',gvSets=q=>q.length,gvAdd=(by,n,c)=>{by[n]=(by[n]||0)+c},gvCredit=(n,k,m,e)=>e,gvAgg=ss=>ss.length;",
      G.gwDone.toString().replace(/^/, 'const gwDone='), ';', fn('gvLog'), 'return gvLog',
    ].join('\n');
    const gvLog = new Function(code)();
    const r = gvLog(wl, 'W', { kindOf: () => 'H', ov: {}, mx: {} });
    assert.equal(r.sessions.length, 2, 'fully skipped entry is not a session');
    assert.equal(r.sessions[0].byMus.Bench, undefined, 'skipped lift gives no sets');
    assert.equal(r.sessions[0].byMus.Press, 1);
  });

  t(file + ': date validation rejects future, bad and impossible dates', () => {
    assert.equal(G.gDateErr('2026-05-10', '2026-05-10'), '');
    assert.equal(G.gDateErr('2026-05-09', '2026-05-10'), '');
    assert.equal(G.gDateErr('2026-05-11', '2026-05-10'), 'future');
    assert.equal(G.gDateErr('', '2026-05-10'), 'bad');
    assert.equal(G.gDateErr('2026-02-30', '2026-05-10'), 'bad');
    assert.equal(G.gDateErr('5/1/2026', '2026-05-10'), 'bad');
    assert.equal(G.gDateErr(undefined, '2026-05-10'), 'bad');
  });

  t(file + ': re-date moves the entry, keeps data and snapshot, re-keys', () => {
    const W = mk(), old = W['2026-05-01#1000'];
    const r = G.gRedate(W, '2026-05-01#1000', '2026-04-28', '2026-05-10', 5);
    assert.equal(r.key, '2026-04-28#1000');
    assert.equal(W['2026-05-01#1000'], undefined);
    const n = W[r.key];
    assert.equal(n.d, '2026-04-28');
    assert.deepEqual(n.ex, old.ex);
    assert.deepEqual(n.warm, old.warm);
    assert.equal(n.sn, old.sn);
    assert.equal(Object.keys(W).length, 2);
  });

  t(file + ': re-date to a day with another session never overwrites it', () => {
    const W = mk();
    W['2026-05-03#1000'] = { d: '2026-05-03', t: 'Pull', ex: { Row: [[50, 10, 2]] }, sn: {} };
    const other = W['2026-05-03#1000'];
    const r = G.gRedate(W, '2026-05-01#1000', '2026-05-03', '2026-05-10', 5);
    assert.notEqual(r.key, '2026-05-03#1000');
    assert.ok(r.key.startsWith('2026-05-03#'));
    assert.equal(W['2026-05-03#1000'], other);
    assert.equal(W['2026-05-03#2000'].ex.Bench[0][0], 65);
    assert.equal(Object.keys(W).length, 3);
    assert.equal(W[r.key].d, '2026-05-03');
  });

  t(file + ': re-date rejects future dates and leaves data untouched; same date is a no-op', () => {
    const W = mk(), snap = JSON.stringify(W);
    assert.equal(G.gRedate(W, '2026-05-01#1000', '2026-05-11', '2026-05-10', 5).err, 'future');
    assert.equal(G.gRedate(W, '2026-05-01#1000', 'nope', '2026-05-10', 5).err, 'bad');
    assert.equal(G.gRedate(W, 'missing', '2026-05-02', '2026-05-10', 5).err, 'bad');
    assert.equal(JSON.stringify(W), snap);
    assert.equal(G.gRedate(W, '2026-05-01#1000', '2026-05-01', '2026-05-10', 5).key, '2026-05-01#1000');
    assert.equal(JSON.stringify(W), snap);
  });

  t(file + ': key without # suffix gets the timestamp suffix', () => {
    const W = { '2026-05-01': { d: '2026-05-01', t: 'x', ex: { A: [[1, 1, 1]] }, sn: {} } };
    assert.equal(G.gRedate(W, '2026-05-01', '2026-04-30', '2026-05-10', 77).key, '2026-04-30#77');
  });

  t(file + ': UI wiring present (date input, Skipped/Undo buttons, ES strings)', () => {
    for (const s of ['id="glgdt" type="date"', 'data-a="gsk"', 'data-a="gunsk"', 'class="skpill"', "'Skipped'"].map(x => x))
      if (s != "'Skipped'") assert.ok(src.includes(s), 'missing ' + s);
    for (const k of ['"Skipped":"No hice este ejercicio"', '"Workout date":"Fecha del entrenamiento"', '"Undo":"Deshacer"'])
      assert.ok(src.includes(k), 'missing ES ' + k);
    assert.ok(/max="\$\{today\(\)\}"/.test(src), 'future dates blocked in the input');
  });
}

console.log(passed + ' passed');
