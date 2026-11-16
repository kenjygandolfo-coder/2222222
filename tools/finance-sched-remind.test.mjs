/* Dev-only test for scheduled-payment reminder mode (pure logic), extracted from index.html by tools/fin-extract.mjs.
   Run: node tools/finance-sched-remind.test.mjs */
import assert from 'node:assert/strict';
import {loadFin} from './fin-extract.mjs';
const F=loadFin('2026-11-14');
const {finNorm,finSchedRemind:remind,finSchedPost:post,finSchedSkip:skip,finSchedAuto:auto,finSchedFuture:fut,finSchedMode:mode,finSchedHandled:handled,srdue}=F;
let passed=0;const t=(n,f)=>{f();passed++;console.log('ok  '+n)};
const AC=(id,name,o)=>Object.assign({id,name,type:'checking',onBudget:true,start:0,startDate:'2026-01-01'},o);
const base=()=>finNorm({accounts:[AC(1,'Bank'),AC(2,'Cash'),AC(3,'Old',{closed:true})],tx:[],ntx:1});
const S=o=>Object.assign({id:0,name:'Power',acct:1,payee:'Utility',cat:null,amt:-80000,amtOp:'approx',notes:'',start:'2026-01-05',rule:{freq:'month',n:1,dom:5},end:{type:'never'},mode:'remind',auto:false,remindDays:0,skipWeekend:'none',skipped:[],paused:false,last:'2026-10-05'},o);
const add=(f,o)=>{const s=S(o);s.id=f.nsch||1;f.nsch=s.id+1;f.sched.push(s);return s};

t('finNorm migrates auto/approx/manual and is idempotent',()=>{const f=finNorm({accounts:[AC(1,'B')],tx:[],sched:[
 {id:1,acct:1,amt:-5,start:'2026-01-05',rule:{freq:'month',n:1},auto:true},
 {id:2,acct:1,amt:-5,amtOp:'approx',start:'2026-01-05',rule:{freq:'month',n:1}},
 {id:3,acct:1,amt:-5,start:'2026-01-05',rule:{freq:'month',n:1}},
 {id:4,acct:1,amt:-5,start:'2026-01-05',rule:{freq:'month',n:1},mode:'remind',remindDays:99},
 {id:5,acct:1,amt:-5,start:'2026-01-05',rule:{freq:'month',n:1},mode:'bogus',auto:true,remindDays:'x'}]});
 assert.deepEqual(f.sched.map(s=>s.mode),['auto','remind','manual','remind','auto']);
 assert.deepEqual(f.sched.map(s=>s.auto),[true,false,false,false,true]);
 assert.deepEqual(f.sched.map(s=>s.remindDays),[0,0,0,7,0]);
 assert.deepEqual(finNorm(JSON.parse(JSON.stringify(f))).sched,f.sched)});
t('finSchedAuto skips remind and manual',()=>{const f=base();add(f,{mode:'remind'});add(f,{mode:'manual',amtOp:'is'});const a=add(f,{mode:'auto',auto:true,amtOp:'is'});
 assert.equal(auto(f,'2026-11-14'),1);assert.equal(f.tx.length,1);assert.equal(f.tx[0].sched,a.id)});
t('remind due: not before the window, on the date, days before',()=>{const f=base();const s=add(f);
 assert.equal(remind(f,'2026-11-04').length,0);assert.deepEqual(remind(f,'2026-11-05').map(x=>x.date),['2026-11-05']);
 s.remindDays=3;assert.equal(remind(f,'2026-11-01').length,0);assert.deepEqual(remind(f,'2026-11-02').map(x=>x.date),['2026-11-05']);
 s.remindDays=7;assert.equal(remind(f,'2026-10-29').length,1)});
t('remind order oldest first then id, per-schedule cap, paused and non-remind excluded',()=>{const f=base();
 const a=add(f,{last:'2026-08-31',start:'2026-01-05'}),b=add(f,{last:'2026-09-30',rule:{freq:'month',n:1,dom:3},start:'2026-01-03'});add(f,{paused:true});add(f,{mode:'manual'});
 const r=remind(f,'2026-11-14');assert.deepEqual(r.map(x=>x.date+'#'+x.s.id),['2026-09-05#'+a.id,'2026-10-03#'+b.id,'2026-10-05#'+a.id,'2026-11-03#'+b.id,'2026-11-05#'+a.id]);
 const g=base();add(g,{last:'2025-01-01',start:'2025-01-05'});assert.equal(remind(g,'2026-11-14').length,12);assert.equal(remind(g,'2026-11-14',3).length,3);assert.equal(remind(g,'2026-11-14',3)[0].date,'2025-01-05')});
t('closed account stays while an open account exists, none when all closed',()=>{const f=base();add(f,{acct:3});assert.equal(remind(f,'2026-11-14').length,1);
 f.accounts.forEach(a=>a.closed=true);assert.equal(remind(f,'2026-11-14').length,0)});
t('override posting uses amount and account, keeps guard, advances last, applies rules',()=>{const f=base();const s=add(f,{cat:null});f.rules=[];
 const tx=post(f,s,'2026-11-05',{amt:-91234,acct:2});assert.equal(tx.amt,-91234);assert.equal(tx.acct,2);assert.equal(tx.sched,s.id);assert.equal(tx.schedDate,'2026-11-05');assert.equal(tx.cleared,false);assert.equal(s.last,'2026-11-05');
 assert.equal(s.amt,-80000);assert.equal(s.acct,1,'schedule untouched by one-off override');
 assert.equal(post(f,s,'2026-11-05',{amt:-1,acct:2}),null);assert.equal(f.tx.length,1);
 assert.equal(remind(f,'2026-11-14').length,0)});
t('override rules apply to the posted tx (fill mode)',()=>{const f=base();const gc=f.cats[0].id;f.rules=[{id:1,stage:'default',conds:[{field:'payee',op:'is',value:'Utility'}],condsOp:'and',actions:[{field:'category',op:'set',value:gc}],enabled:true,order:1}];f.nrule=2;
 const s=add(f);const tx=post(f,s,'2026-11-05',{amt:-50000,acct:1});assert.equal(tx.cat,gc);assert.equal(tx.amt,-50000)});
t('invalid overrides post nothing and do not advance last',()=>{const f=base();const s=add(f);
 for(const ov of[{amt:0},{amt:NaN},{acct:3},{acct:99}])assert.equal(post(f,s,'2026-11-05',ov),null);assert.equal(s.last,'2026-10-05');assert.equal(f.tx.length,0)});
t('Not yet leaves it due; skip and post advance',()=>{const f=base();const s=add(f);assert.equal(remind(f,'2026-11-14').length,1);assert.equal(remind(f,'2026-11-14').length,1);assert.equal(s.last,'2026-10-05');
 skip(f,s,'2026-11-05');assert.ok(handled(s,'2026-11-05'));assert.equal(remind(f,'2026-11-14').length,0);assert.equal(f.tx.length,0);assert.equal(remind(f,'2026-12-05').length,1)});
t('going forward updates schedule amount and account only when valid',()=>{const f=base();const s=add(f);
 assert.equal(fut(f,s,{amt:-91000,acct:2}),true);assert.equal(s.amt,-91000);assert.equal(s.acct,2);
 assert.equal(fut(f,s,{amt:null,acct:3}),false);assert.equal(s.acct,2);assert.equal(fut(f,s,{amt:0,acct:null}),false);assert.equal(s.amt,-91000)});
t('income keeps its sign through confirmation amount',()=>{const f=base();const s=add(f,{amt:300000});const tx=post(f,s,'2026-11-05',{amt:Math.abs(310000),acct:2});assert.equal(tx.amt,310000)});
t('mode helper falls back to auto flag',()=>{assert.equal(mode({auto:true}),'auto');assert.equal(mode({}),'manual');assert.equal(mode({mode:'remind',auto:true}),'remind')});
t('srdue decision',()=>{const D={done:true};assert.equal(srdue(D,false,2,false,null,1e9,36e5),true);assert.equal(srdue(D,false,0,false,null,1e9,36e5),false);
 assert.equal(srdue(D,true,2,false,null,1e9,36e5),false);assert.equal(srdue({},false,2,false,null,1e9,36e5),false);
 assert.equal(srdue(D,false,2,true,1e9-1000,1e9,36e5),false);assert.equal(srdue(D,false,2,true,1e9-36e5,1e9,36e5),true);assert.equal(srdue(D,false,2,true,null,1e9,36e5),false)});
console.log('PASS finance-sched-remind ('+passed+')');
