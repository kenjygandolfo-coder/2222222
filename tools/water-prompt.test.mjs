/* Dev-only test of wadue() (water popup decision), mirrored verbatim from index.html/gymapp.html.
   Run: node tools/water-prompt.test.mjs */
import assert from 'node:assert/strict';
function wadue(s,t,later,blocked,ml,goal,last,now,gap){return !!(s&&s.done&&!blocked&&!(ml>=goal)&&(!later||(last!=null&&now-last>=gap)))}
const T='2026-10-30',S0={done:true},G=3000,GAP=3600000,N=1e9;
assert.equal(wadue(S0,T,false,false,0,G,null,N,GAP),true);
assert.equal(wadue(S0,T,false,false,2750,G,null,N,GAP),true);
assert.equal(wadue(S0,T,false,false,3000,G,null,N,GAP),false);
assert.equal(wadue(S0,T,false,false,4000,G,null,N,GAP),false);
assert.equal(wadue(S0,T,true,false,500,G,N-1000,N,GAP),false);
assert.equal(wadue(S0,T,true,false,500,G,N-GAP,N,GAP),true);
assert.equal(wadue(S0,T,true,false,3000,G,N-GAP,N,GAP),false);
assert.equal(wadue(S0,T,true,false,500,G,null,N,GAP),false);
assert.equal(wadue(S0,T,false,true,500,G,null,N,GAP),false);
assert.equal(wadue({},T,false,false,0,G,null,N,GAP),false);
console.log('PASS water-prompt');
