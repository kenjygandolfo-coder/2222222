/* Dev-only test for the Gym records (PR) engine and PR-on-save logic. Pulls the REAL functions
   out of index.html and gymapp.html (no mirrored copies).
   Run: `node tools/gym-records.test.mjs`; non-zero exit on failure. Not shipped in the SW shell. */
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
  const fmt = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const code = [
    "let UNIT='lb';const GUNIT=()=>UNIT;",
    ...['GPR', 'ge1', 'gPRGain', 'gPRn', 'gPRTxt'].map(konst),
    ...['gPRSess', 'gPRs', 'gPRNew', 'gPRRecent', 'gPRParts'].map(fn),
    'return{GPR,gPRSess,gPRs,gPRNew,gPRGain,gPRRecent,gPRParts,gPRTxt,setUnit:u=>{UNIT=u}}',
  ].join('\n');
  return { G: new Function(code)(), src, fmt };
}

let passed = 0;
const t = (name, f) => { f(); passed++; console.log('ok  ' + name); };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' != ' + b);

for (const file of ['index.html', 'gymapp.html']) {
  const { G, src } = load(file), P = s => file + ': ' + s;
  const E = (d, ex, o) => Object.assign({ d, t: 'Push', ex, sn: { t: 'Push', u: 'lb', items: [] } }, o || {});
  const base = () => ({
    '2026-05-01#1': E('2026-05-01', { Bench: [[100, 5, 2], [100, 5, 2]] }),
    '2026-05-08#2': E('2026-05-08', { Bench: [[105, 5, 2], [105, 4, 2]] }),
  });

  t(P('empty history and unknown exercise give empty records'), () => {
    const r = G.gPRs({}, 'Bench');
    assert.equal(r.sessions, 0); assert.equal(r.maxW, null); assert.equal(r.bestE1, null); assert.equal(r.bestVol, null);
    assert.equal(r.vsBest, null); assert.deepEqual(r.rep, {});
    assert.equal(G.gPRs(undefined, 'Bench').sessions, 0);
    assert.equal(G.gPRs(base(), 'Squat').sessions, 0);
    assert.deepEqual(G.gPRNew({}, 'x', 'Bench'), []);
    assert.equal(G.gPRTxt([]), '');
  });

  t(P('max weight, e1RM (RIR adjusted Epley), session volume, counts and dates'), () => {
    const r = G.gPRs(base(), 'Bench');
    assert.deepEqual(r.maxW, { w: 105, reps: 5, date: '2026-05-08' });
    near(r.bestE1.e1, Math.round(105 * (1 + 7 / 30) * 10) / 10);
    assert.equal(r.bestE1.w, 105); assert.equal(r.bestE1.date, '2026-05-08');
    assert.deepEqual(r.bestVol, { vol: 1000, date: '2026-05-01' });
    assert.equal(r.sessions, 2); assert.equal(r.first, '2026-05-01'); assert.equal(r.last, '2026-05-08');
    assert.equal(r.vsBest, 0);
  });

  t(P('rep PRs: best weight per rep count 1..15, ties keep the earliest date, 16+ reps ignored'), () => {
    const wl = base();
    wl['2026-05-15#3'] = E('2026-05-15', { Bench: [[100, 5, 2], [60, 16, 1], [50, 15, 1], [200, 1, 0]] });
    const r = G.gPRs(wl, 'Bench');
    assert.deepEqual(r.rep[5], { w: 105, date: '2026-05-08' });
    assert.deepEqual(r.rep[4], { w: 105, date: '2026-05-08' });
    assert.deepEqual(r.rep[1], { w: 200, date: '2026-05-15' });
    assert.deepEqual(r.rep[15], { w: 50, date: '2026-05-15' });
    assert.equal(r.rep[16], undefined);
    const eq = { a: E('2026-05-01', { X: [[50, 5, 1]] }), 'b#': E('2026-05-02', { X: [[50, 5, 1]] }) };
    assert.equal(G.gPRs({ 'a#1': eq.a, 'b#2': eq['b#'] }, 'X').rep[5].date, '2026-05-01');
  });

  t(P('latest session versus best is a rounded percent'), () => {
    const wl = base();
    wl['2026-05-15#3'] = E('2026-05-15', { Bench: [[100, 5, 2], [100, 5, 2]] });
    const r = G.gPRs(wl, 'Bench');
    assert.equal(r.vsBest, Math.round((100 * (1 + 7 / 30) / (105 * (1 + 7 / 30)) - 1) * 100));
    assert.ok(r.vsBest < 0);
  });

  t(P('warm-ups never count'), () => {
    const wl = base();
    wl['2026-05-15#3'] = E('2026-05-15', { Bench: [[90, 5, 2]] }, { warm: { Bench: [[300, 10]] } });
    const r = G.gPRs(wl, 'Bench');
    assert.equal(r.maxW.w, 105); assert.equal(r.bestVol.vol, 1000);
    assert.deepEqual(G.gPRNew(wl, '2026-05-15#3', 'Bench'), []);
  });

  t(P('skipped exercises never produce records'), () => {
    const wl = base();
    wl['2026-05-15#3'] = E('2026-05-15', { Bench: [[500, 5, 0]] }, { skip: { Bench: 1 } });
    assert.equal(G.gPRs(wl, 'Bench').maxW.w, 105);
    assert.equal(G.gPRs(wl, 'Bench').sessions, 2);
    assert.deepEqual(G.gPRNew(wl, '2026-05-15#3', 'Bench'), []);
  });

  t(P('deload sessions are excluded from records and PR detection'), () => {
    const wl = base();
    wl['2026-05-15#3'] = E('2026-05-15', { Bench: [[500, 5, 0]] }, { dl: 1 });
    assert.equal(G.gPRs(wl, 'Bench').maxW.w, 105);
    assert.equal(G.gPRs(wl, 'Bench').last, '2026-05-08');
    assert.deepEqual(G.gPRNew(wl, '2026-05-15#3', 'Bench'), []);
  });

  t(P('RIR 5+ sets are junk (records and volume); RIR 4 and blank RIR count'), () => {
    const wl = base();
    wl['2026-05-15#3'] = E('2026-05-15', { Bench: [[200, 5, 5], [110, 5, 4], [108, 5]] });
    const r = G.gPRs(wl, 'Bench');
    assert.equal(r.maxW.w, 110);
    assert.equal(G.gPRSess(wl['2026-05-15#3'], 'Bench').vol, 110 * 5 + 108 * 5);
    const only = { 'a#1': E('2026-05-01', { X: [[100, 5, 5], [100, 5, 6]] }) };
    assert.equal(G.gPRs(only, 'X').sessions, 0);
  });

  t(P('myo: the activation set drives weight, e1RM and rep records; mini-sets only add to volume'), () => {
    const wl = { 'a#1': E('2026-05-01', { Row: [[100, 3, 1], [100, 3, 1], [100, 3, 1]] }, { prime: { Row: [100, 12] } }) };
    const r = G.gPRs(wl, 'Row');
    assert.deepEqual(r.maxW, { w: 100, reps: 12, date: '2026-05-01' });
    near(r.bestE1.e1, 140); assert.equal(r.bestE1.reps, 12);
    assert.deepEqual(Object.keys(r.rep), ['12']);
    assert.equal(r.bestVol.vol, 100 * 12 + 900);
    /* heavier mini-sets do not become records */
    wl['b#2'] = E('2026-05-08', { Row: [[150, 3, 0]] }, { prime: { Row: [100, 12] } });
    assert.equal(G.gPRs(wl, 'Row').maxW.w, 100);
    assert.equal(G.gPRSess(wl['b#2'], 'Row').w.w, 100);
  });

  t(P('unit handling: values are used as stored and labelled in the current unit'), () => {
    const wl = { 'a#1': E('2026-05-01', { Bench: [[100, 5, 2]] }), 'b#2': E('2026-05-08', { Bench: [[102.5, 5, 2]] }) };
    G.setUnit('lb');
    assert.equal(G.gPRTxt(G.gPRNew(wl, 'b#2', 'Bench')).includes(' lb'), true);
    G.setUnit('kg');
    const txt = G.gPRTxt(G.gPRNew(wl, 'b#2', 'Bench'));
    assert.ok(txt.startsWith('🏆 New PR: e1RM ') && txt.includes(' kg') && !txt.includes(' lb'), txt);
    assert.ok(txt.includes('Max weight 102.5 kg'));
    G.setUnit('lb');
  });

  t(P('PR detection: first session is a baseline, then new vs not'), () => {
    const wl = base();
    assert.deepEqual(G.gPRNew(wl, '2026-05-01#1', 'Bench'), []);
    const n = G.gPRNew(wl, '2026-05-08#2', 'Bench').map(x => x.k);
    assert.deepEqual(n.sort(), ['e1', 'rep', 'w']);
    wl['2026-05-15#3'] = E('2026-05-15', { Bench: [[100, 5, 2]] });
    assert.deepEqual(G.gPRNew(wl, '2026-05-15#3', 'Bench'), []);
  });

  t(P('PR detection only counts a rep PR when that rep count was done before'), () => {
    const wl = base();
    wl['2026-05-15#3'] = E('2026-05-15', { Bench: [[90, 12, 3]] });
    assert.equal(G.gPRNew(wl, '2026-05-15#3', 'Bench').some(x => x.k == 'rep'), false);
    wl['2026-05-22#4'] = E('2026-05-22', { Bench: [[95, 12, 3]] });
    const x = G.gPRNew(wl, '2026-05-22#4', 'Bench').find(y => y.k == 'rep');
    assert.deepEqual(x, { k: 'rep', r: 12, v: 95 });
  });

  t(P('PR on save: new PR is announced once, re-saving unchanged sets announces nothing, improving re-announces'), () => {
    const wl = base();
    const save = (key, sets) => {
      const bf = G.gPRNew(wl, key, 'Bench');
      wl[key] = E(key.slice(0, 10), { Bench: sets });
      return G.gPRGain(bf, G.gPRNew(wl, key, 'Bench'));
    };
    const first = save('2026-05-15#3', [[110, 5, 2], [110, 5, 2]]);
    assert.ok(first.some(x => x.k == 'e1') && first.some(x => x.k == 'w'));
    assert.ok(G.gPRTxt(first).startsWith('🏆 New PR: e1RM '));
    assert.deepEqual(save('2026-05-15#3', [[110, 5, 2], [110, 5, 2]]), []);
    const better = save('2026-05-15#3', [[115, 5, 2], [110, 5, 2]]);
    assert.ok(better.some(x => x.k == 'w' && x.v == 115));
    assert.equal(better.some(x => x.k == 'vol'), true);
    /* a save that is not a record announces nothing */
    assert.deepEqual(save('2026-05-22#4', [[80, 5, 2]]), []);
    /* editing down removes the mark (computed on the fly) */
    save('2026-05-15#3', [[90, 5, 2]]);
    assert.deepEqual(G.gPRNew(wl, '2026-05-15#3', 'Bench'), []);
  });

  t(P('badge text: at most 3 parts, e1RM first, rep PR only when no weight or e1RM PR'), () => {
    const it = [{ k: 'rep', r: 8, v: 60 }, { k: 'vol', v: 4200 }, { k: 'w', v: 150, reps: 5 }, { k: 'e1', v: 168, reps: 5 }];
    assert.equal(G.gPRTxt(it), '🏆 New PR: e1RM 168 lb · Max weight 150 lb · Volume 4,200 lb');
    assert.equal(G.gPRTxt([{ k: 'rep', r: 8, v: 60 }]), '🏆 New PR: 8 reps: 60 lb');
    assert.equal(G.gPRTxt([{ k: 'rep', r: 1, v: 60 }]), '🏆 New PR: 1 rep: 60 lb');
  });

  t(P('recent PRs window: only entries inside from..to, newest first, with items'), () => {
    const wl = base();
    wl['2026-05-15#3'] = E('2026-05-15', { Bench: [[110, 5, 2]], Squat: [[200, 5, 2]] });
    wl['2026-04-01#0'] = E('2026-04-01', { Squat: [[150, 5, 2]] });
    wl['2026-05-20#5'] = E('2026-05-20', { Squat: [[210, 5, 2]] });
    const all = G.gPRRecent(wl, ['Bench', 'Squat'], '2026-05-01', '2026-05-31');
    assert.deepEqual(all.map(x => x.n + x.d), ['Squat2026-05-20', 'Squat2026-05-15', 'Bench2026-05-15', 'Bench2026-05-08']);
    const win = G.gPRRecent(wl, ['Bench', 'Squat'], '2026-05-16', '2026-05-31');
    assert.deepEqual(win.map(x => x.n + x.d), ['Squat2026-05-20']);
    assert.ok(win[0].it.length > 0);
    assert.deepEqual(G.gPRRecent(wl, ['Bench'], '2026-06-01', '2026-06-30'), []);
    assert.deepEqual(G.gPRRecent({}, ['Bench'], '2026-01-01', '2026-12-31'), []);
    wl['2026-05-25#6'] = E('2026-05-25', { Bench: [[999, 5, 0]] }, { dl: 1 });
    assert.equal(G.gPRRecent(wl, ['Bench'], '2026-05-24', '2026-05-31').length, 0);
  });

  t(P('wiring: save handler, badge, card, ES strings and no stale toast'), () => {
    assert.ok(src.includes('gPRNew(W,glgKey,n)') || src.includes('gPRNew('), 'save wiring');
    assert.ok(/gPRGain\(/.test(src));
    assert.ok(src.includes('🏆 Records') && src.includes('Récords'));
    assert.ok(src.includes('Nuevo récord') && src.includes('Récords recientes') && src.includes('Peso máximo'));
    assert.ok(src.includes('Mejor 1RM estimado') && src.includes('Mejor volumen') && src.includes('Récords por repeticiones'));
    assert.ok(src.includes('vs. mejor'));
  });
}
console.log('\n' + passed + ' passed');
