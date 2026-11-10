/* Dev-only test for the auto meal plan rule. mpDue() is MIRRORED from index.html. */
import assert from 'node:assert/strict';
const MPD=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function mpDue(days,applied,d,t,closed,hasEntries){if(!days||!days.length||d<t||(applied||{})[d]||closed||hasEntries)return false;return days.includes(MPD[(new Date(d+'T00:00').getDay()+6)%7])}
// 2026-01-05 is a Monday
assert.equal(mpDue(['Mon'],{},'2026-01-05','2026-01-05',false),true);
assert.equal(mpDue(['Mon'],{},'2026-01-06','2026-01-05',false),false,'not a chosen weekday');
assert.equal(mpDue(['Mon'],{},'2026-01-12','2026-01-05',false),true,'future chosen day');
assert.equal(mpDue(['Mon'],{},'2025-12-29','2026-01-05',false),false,'never past');
assert.equal(mpDue(['Mon'],{'2026-01-05':1},'2026-01-05','2026-01-05',false),false,'once per date');
assert.equal(mpDue(['Mon'],{},'2026-01-05','2026-01-05',true),false,'closed day');
assert.equal(mpDue([],{},'2026-01-05','2026-01-05',false),false);
assert.equal(mpDue(['Sun'],{},'2026-01-11','2026-01-05',false),true);
assert.equal(mpDue(['Mon'],{},'2026-01-12','2026-01-05',false,true),false,'future day with entries never');
assert.equal(mpDue(['Mon'],{},'2026-01-05','2026-01-05',false,true),false,'today with entries never');
assert.equal(mpDue(['Mon'],{},'2026-01-12','2026-01-05',false,false),true,'empty future weekday');

// ---- mpSyncAction (MIRRORED from index.html) ----
const MEALS=['Breakfast'],MP_HORIZON=14;
function mpSig(list){return JSON.stringify((list||[]).map(e=>({i:e.i,q:e.q,m:e.m||MEALS[0]})))}
function mpSyncAction(d,t,days,closed,log,rec,plan,prev){const off=Math.round((new Date(d+'T00:00')-new Date(t+'T00:00'))/864e5);if(!(off>=0&&off<MP_HORIZON)||closed)return'skip';const sel=!!(days||[]).includes(MPD[(new Date(d+'T00:00').getDay()+6)%7]),L=log||[],has=!!(plan&&plan.length);
if(!rec)return sel&&has&&!L.length?'fill':'skip';
const sg=rec&&rec.sig?rec.sig:(prev&&prev.length?mpSig(prev):null);if(!sg||!L.length||mpSig(L)!==sg)return'skip';
if(!sel||!has)return'clear';return mpSig(plan)===sg?'skip':'replace'}
const T0='2026-01-05',F1='2026-01-12',old=[{i:1,q:100,m:'Breakfast'}],nw=[{i:1,q:150,m:'Breakfast'}],rec={sig:mpSig(old)};
const A=(d,days,cl,log,r,pl,pv)=>mpSyncAction(d,T0,days,cl,log,r,pl,pv);
assert.equal(A('2025-12-29',['Mon'],false,[],undefined,nw),'skip','past day');
assert.equal(A(F1,['Mon'],false,[],undefined,nw),'fill','empty future');
assert.equal(A(F1,['Mon'],false,[{i:9,q:1,m:'Lunch'}],undefined,nw),'skip','manual future day');
assert.equal(A(F1,['Mon'],false,old,rec,nw),'replace','untouched after plan change');
assert.equal(A(T0,['Mon'],false,old,rec,nw),'replace','today follows the same rule');
assert.equal(A(F1,[],false,old,rec,nw),'clear','deselected weekday');
assert.equal(A(F1,['Mon'],false,old,rec,[]),'clear','empty plan');
assert.equal(A(F1,['Mon'],false,[{i:1,q:120,m:'Breakfast'}],rec,nw),'skip','user edited');
assert.equal(A(F1,['Mon'],false,[...old,{i:2,q:1,m:'Lunch'}],rec,nw),'skip','user added');
assert.equal(A(F1,['Mon'],false,[],rec,nw),'skip','emptied applied day');
assert.equal(A(F1,['Mon'],false,old,1,nw),'skip','legacy 1');
assert.equal(A(F1,['Mon'],false,old,1,nw,old),'replace','legacy 1 equal to previous plan');
assert.equal(A(F1,['Mon'],false,[{i:5,q:1}],1,nw,old),'skip','legacy 1 modified');
assert.equal(A(F1,['Mon'],true,old,rec,nw),'skip','closed');
assert.equal(A(F1,['Mon'],false,old,rec,old),'skip','already in sync');
assert.equal(A('2026-01-18',['Sun'],false,[],undefined,nw),'fill','last day inside horizon (offset 13)');
assert.equal(A('2026-01-19',['Mon'],false,[],undefined,nw),'skip','offset 14 is outside horizon');
console.log('PASS meal-plan-auto');
