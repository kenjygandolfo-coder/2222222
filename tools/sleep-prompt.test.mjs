/* Dev-only test of sdue() (daily sleep popup decision), mirrored verbatim from index.html/gymapp.html.
   Sleep for the night just ended is stored under the wake-up date (today), as the Night sleep card does.
   Run: node tools/sleep-prompt.test.mjs */
import assert from 'node:assert/strict';
function sdue(s,t,later,blocked){return !!(s&&s.done&&!later&&!blocked&&!(s.slp&&s.slp[t])&&s.sdis!==t)}
const T='2026-10-30',S0={done:true,slp:{'2026-10-29':8}};
assert.equal(sdue(S0,T,false,false),true);
assert.equal(sdue({...S0,slp:{[T]:7.5}},T,false,false),false);
assert.equal(sdue(S0,T,true,false),false);
assert.equal(sdue(S0,T,false,true),false);
assert.equal(sdue({...S0,sdis:T},T,false,false),false);
assert.equal(sdue({...S0,sdis:'2026-10-29'},T,false,false),true);
assert.equal(sdue({done:true},T,false,false),true);
assert.equal(sdue({slp:{}},T,false,false),false);
console.log('PASS sleep-prompt');
