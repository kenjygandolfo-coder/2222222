/* Dev-only test of wdue() (daily weigh-in popup decision), mirrored verbatim from index.html/gymapp.html.
   Run: node tools/weigh-prompt.test.mjs */
import assert from 'node:assert/strict';
function wdue(s,t,later,blocked){return !!(s&&s.done&&!later&&!blocked&&!(s.wt&&s.wt[t])&&s.wdis!==t)}
const T='2026-10-30',S0={done:true,wt:{'2026-10-29':74.5}};
assert.equal(wdue(S0,T,false,false),true);
assert.equal(wdue({...S0,wt:{[T]:74}},T,false,false),false);
assert.equal(wdue(S0,T,true,false),false);
assert.equal(wdue(S0,T,false,true),false);
assert.equal(wdue({...S0,wdis:T},T,false,false),false);
assert.equal(wdue({...S0,wdis:'2026-10-29'},T,false,false),true);
assert.equal(wdue({wt:{}},T,false,false),false);
console.log('PASS weigh-prompt');
