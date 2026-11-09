/* Dev-only test of stdue() (steps popup decision), mirrored verbatim from index.html/gymapp.html.
   Run: node tools/steps-prompt.test.mjs */
import assert from 'node:assert/strict';
function stdue(s,t,later,blocked,steps,goal,last,now,gap){return !!(s&&s.done&&!blocked&&!(steps>=goal)&&(!later||(last!=null&&now-last>=gap)))}
const T='2026-10-30',S0={done:true},G=8000,GAP=3600000,N=1e9;
assert.equal(stdue(S0,T,false,false,0,G,null,N,GAP),true);
assert.equal(stdue(S0,T,false,false,7999,G,null,N,GAP),true);
assert.equal(stdue(S0,T,false,false,8000,G,null,N,GAP),false);
assert.equal(stdue(S0,T,false,false,12000,G,null,N,GAP),false);
assert.equal(stdue(S0,T,true,false,500,G,N-1000,N,GAP),false);
assert.equal(stdue(S0,T,true,false,500,G,N-GAP,N,GAP),true);
assert.equal(stdue(S0,T,true,false,8000,G,N-GAP,N,GAP),false);
assert.equal(stdue(S0,T,true,false,500,G,null,N,GAP),false);
assert.equal(stdue(S0,T,false,true,500,G,null,N,GAP),false);
assert.equal(stdue({},T,false,false,0,G,null,N,GAP),false);
console.log('PASS steps-prompt');
