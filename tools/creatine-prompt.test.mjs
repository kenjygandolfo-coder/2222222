/* Dev-only test of cdue() (daily creatine popup decision), mirrored verbatim from index.html/gymapp.html.
   Run: node tools/creatine-prompt.test.mjs */
import assert from 'node:assert/strict';
function cdue(s,t,later,blocked){return !!(s&&s.done&&!later&&!blocked&&!(s.cre&&s.cre[t])&&s.cdis!==t)}
const T='2026-10-30',S0={done:true,cre:{'2026-10-29':1}};
assert.equal(cdue(S0,T,false,false),true);
assert.equal(cdue({...S0,cre:{[T]:1}},T,false,false),false);
assert.equal(cdue(S0,T,true,false),false);
assert.equal(cdue(S0,T,false,true),false);
assert.equal(cdue({...S0,cdis:T},T,false,false),false);
assert.equal(cdue({...S0,cdis:'2026-10-29'},T,false,false),true);
assert.equal(cdue({done:true},T,false,false),true);
assert.equal(cdue({cre:{}},T,false,false),false);
console.log('PASS creatine-prompt');
