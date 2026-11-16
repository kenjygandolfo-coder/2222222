/* Dev-only test for Finance category goals (pure logic from index.html via tools/fin-extract.mjs).
   Run: node tools/finance-goals.test.mjs */
import assert from 'node:assert/strict';
import {loadFin} from './fin-extract.mjs';
const F=loadFin('2026-11-14');
const {finNorm,finGoalNorm,finGoalSet,finGoalNeed,finGoalAll,finGoalFund,finBudgetCalc:calc,finDelCat}=F;
let passed=0;const t=(n,f)=>{f();passed++;console.log('ok  '+n)};
const NOW='2026-11';
const A=(o)=>Object.assign({id:1,name:'Main',onBudget:true,start:0,startDate:'2026-01-01'},o);
const X=(id,date,cat,amt,acct=1)=>({id,acct,date,cat,amt});
const mk=(cats,o)=>finNorm(Object.assign({accounts:[A({start:10000000})],cats,tx:[],budget:{}},o));
const cat=(id,name,goal,o)=>Object.assign({id,name,group:null,goal},o);
const need=(f,m,id)=>{const C=calc(f,m,NOW),c=f.cats.find(x=>x.id==id);return finGoalNeed(c,c.goal,m,C,f,NOW)};

t('goal normalisation drops bad data and fixes dates',()=>{
 assert.equal(finGoalNorm({type:'nope',amt:5}),null);
 assert.equal(finGoalNorm({type:'monthly',amt:0}),null);
 assert.equal(finGoalNorm({type:'monthly',amt:-5}),null);
 assert.equal(finGoalNorm({type:'monthly'}),null);
 assert.deepEqual(finGoalNorm({type:'monthly',amt:'500.4',junk:1}),{type:'monthly',amt:500});
 assert.equal(finGoalNorm({type:'by',amt:100}),null);
 assert.equal(finGoalNorm({type:'by',amt:100,date:'2026-13'}),null);
 assert.deepEqual(finGoalNorm({type:'by',amt:100,date:'2026-12-25',repeat:'weird'}),{type:'by',amt:100,date:'2026-12',repeat:'none'});
 assert.deepEqual(finGoalNorm({type:'by',amt:100,date:'2026-12',repeat:'year'}),{type:'by',amt:100,date:'2026-12',repeat:'year'});
 assert.equal(finGoalNorm({type:'pct',pct:0}),null);assert.equal(finGoalNorm({type:'pct',pct:101}),null);
 assert.deepEqual(finGoalNorm({type:'pct',pct:12.345}),{type:'pct',pct:12.35});
 assert.deepEqual(finGoalNorm({type:'sched',amt:'x'}),{type:'sched'});assert.equal(finGoalNorm(null),null)});
t('finNorm repairs goals, drops them on income categories, and is idempotent',()=>{
 const f=mk([cat(1,'Food',{type:'monthly',amt:'1000'}),cat(2,'Bad',{type:'zzz',amt:5}),cat(3,'Pay',{type:'monthly',amt:5},{income:true}),cat(4,'Trip',{type:'by',amt:5000,date:'2027-03-09'}),cat(5,'None')]);
 const g=id=>f.cats.find(c=>c.id==id);
 assert.deepEqual(g(1).goal,{type:'monthly',amt:1000});assert.ok(!('goal' in g(2)));assert.ok(!('goal' in g(3)));assert.deepEqual(g(4).goal,{type:'by',amt:5000,date:'2027-03',repeat:'none'});assert.ok(!('goal' in g(5)));
 assert.deepEqual(finNorm(JSON.parse(JSON.stringify(f))),f)});
t('finGoalSet validates and removes',()=>{
 const f=mk([cat(1,'Food'),cat(2,'Pay',null,{income:true})]);
 assert.equal(finGoalSet(f,1,{type:'cap',amt:300}),true);assert.deepEqual(f.cats.find(c=>c.id==1).goal,{type:'cap',amt:300});
 assert.equal(finGoalSet(f,1,{type:'cap',amt:0}),false);assert.equal(f.cats.find(c=>c.id==1).goal.amt,300);
 assert.equal(finGoalSet(f,2,{type:'monthly',amt:5}),false);assert.equal(finGoalSet(f,99,{type:'monthly',amt:5}),false);
 assert.equal(finGoalSet(f,1,null),true);assert.ok(!('goal' in f.cats.find(c=>c.id==1)))});
t('monthly: needs the amount, progress follows budgeted, funded when reached',()=>{
 const f=mk([cat(1,'Food',{type:'monthly',amt:1000})],{budget:{'2026-03':{1:400},'2026-04':{1:1000},'2026-05':{1:1500}}});
 let r=need(f,'2026-02',1);assert.equal(r.needed,1000);assert.equal(r.funded,false);assert.equal(r.progress,0);assert.equal(r.status,'under');assert.match(r.label,/^Needs .* more this month$/);
 r=need(f,'2026-03',1);assert.equal(r.needed,600);assert.equal(r.underfunded,600);assert.equal(r.progress,0.4);
 r=need(f,'2026-04',1);assert.equal(r.needed,0);assert.equal(r.funded,true);assert.equal(r.progress,1);assert.equal(r.label,'Funded');assert.equal(r.status,'ok');
 r=need(f,'2026-05',1);assert.equal(r.needed,0);assert.equal(r.progress,1)});
t('overspent category is flagged and keeps its goal need',()=>{
 const f=mk([cat(1,'Food',{type:'monthly',amt:1000})],{budget:{'2026-03':{1:1000}},tx:[X(1,'2026-03-05',1,-1600)]});
 const r=need(f,'2026-03',1);assert.equal(r.status,'over');assert.equal(r.needed,0);assert.match(r.label,/^Overspent by /);
 const g=need(f,'2026-04',1);assert.equal(g.needed,1000);assert.equal(g.status,'under')});
t('by date: spreads the remaining amount over the months left, with carryover',()=>{
 const f=mk([cat(1,'Trip',{type:'by',amt:1200,date:'2026-12'})],{budget:{'2026-09':{1:300}}});
 let r=need(f,'2026-09',1);assert.equal(r.target,300);assert.equal(r.needed,0);assert.equal(r.funded,true);
 r=need(f,'2026-08',1);assert.equal(r.target,240);assert.equal(r.needed,240);assert.equal(r.progress,0);
 r=need(f,'2026-10',1);assert.equal(r.target,300);assert.equal(r.needed,300);assert.equal(r.progress,0.25);
 r=need(f,'2026-12',1);assert.equal(r.target,900);assert.equal(r.needed,900);
 const g=mk([cat(1,'Trip',{type:'by',amt:1000,date:'2026-12'})]);
 assert.equal(need(g,'2026-10',1).target,334);assert.equal(need(g,'2026-12',1).target,1000)});
t('by date: already met needs nothing; after the date it is completed or overdue',()=>{
 const f=mk([cat(1,'Trip',{type:'by',amt:1000,date:'2026-06'})],{budget:{'2026-04':{1:1000}}});
 let r=need(f,'2026-05',1);assert.equal(r.needed,0);assert.equal(r.label,'Goal met');assert.equal(r.progress,1);
 r=need(f,'2026-09',1);assert.equal(r.needed,0);assert.equal(r.state,'');assert.equal(r.label,'Goal met');
 const g=mk([cat(1,'Trip',{type:'by',amt:1000,date:'2026-06'})],{budget:{'2026-04':{1:600}}});
 r=need(g,'2026-09',1);assert.equal(r.state,'overdue');assert.equal(r.needed,400);assert.equal(r.status,'under');assert.equal(r.progress,0.6);
 const h=mk([cat(1,'Trip',{type:'by',amt:1000,date:'2026-06'})],{budget:{'2026-04':{1:1000}},tx:[X(1,'2026-06-20',1,-1000)]});
 r=need(h,'2026-09',1);assert.equal(r.needed,0,'spent after reaching it still counts as completed');assert.equal(r.state,'')});
t('by date, yearly repeat rolls the target forward',()=>{
 const f=mk([cat(1,'Insurance',{type:'by',amt:1200,date:'2026-03',repeat:'year'})],{budget:{'2026-02':{1:1200}},tx:[X(1,'2026-03-10',1,-1200)]});
 let r=need(f,'2026-04',1);assert.equal(r.state,'');assert.equal(r.target,100);assert.equal(r.needed,100);
 r=need(f,'2027-02',1);assert.equal(r.target,600);assert.equal(need(f,'2027-03',1).target,1200);
 r=need(f,'2027-04',1);assert.equal(r.target,100);
 const g=mk([cat(1,'Insurance',{type:'by',amt:1200,date:'2026-03'})]);
 assert.equal(need(g,'2026-04',1).state,'overdue')});
t('balance: budget enough for the balance to reach the amount',()=>{
 const f=mk([cat(1,'Buffer',{type:'balance',amt:1000})],{budget:{'2026-03':{1:700},'2026-04':{1:100}},tx:[X(1,'2026-04-02',1,-50)]});
 let r=need(f,'2026-03',1);assert.equal(r.needed,300);assert.equal(r.progress,0.7);
 r=need(f,'2026-04',1);assert.equal(r.target,350);assert.equal(r.needed,250);
 r=need(f,'2026-05',1);assert.equal(r.needed,250);assert.equal(r.progress,0.75);
 const g=mk([cat(1,'Buffer',{type:'balance',amt:1000})],{budget:{'2026-03':{1:1500}}});
 r=need(g,'2026-03',1);assert.equal(r.needed,0);assert.equal(r.progress,1)});
t('cap: covers this month spending up to the cap',()=>{
 const f=mk([cat(1,'Fun',{type:'cap',amt:500})],{budget:{'2026-03':{1:100}},tx:[X(1,'2026-03-02',1,-150),X(2,'2026-04-02',1,-900),X(3,'2026-05-02',1,-100)]});
 let r=need(f,'2026-03',1);assert.equal(r.target,150);assert.equal(r.needed,50);assert.equal(r.progress,0.3);
 r=need(f,'2026-04',1);assert.equal(r.target,500);assert.equal(r.needed,500);assert.equal(r.status,'over');
 r=need(f,'2026-02',1);assert.equal(r.needed,0);assert.equal(r.funded,true);
 const g=mk([cat(1,'Fun',{type:'cap',amt:500})],{budget:{'2026-03':{1:400}},tx:[X(1,'2026-04-02',1,-150)]});
 r=need(g,'2026-04',1);assert.equal(r.target,0,'carry 400 already covers the 150 spent');assert.equal(r.needed,0)});
t('from schedules: sums this month outflows of active schedules in the category',()=>{
 const sc=(id,o)=>Object.assign({id,name:'s'+id,acct:1,payee:'',cat:1,amt:-200,amtOp:'is',notes:'',start:'2026-01-05',rule:{freq:'month',n:1,dom:5},end:{type:'never'},auto:false,skipWeekend:'none',last:'',skipped:[],paused:false},o);
 const f=mk([cat(1,'Bills',{type:'sched'}),cat(2,'Other')],{sched:[sc(1,{}),sc(2,{amt:-50,rule:{freq:'week',n:1,wd:[1]},start:'2026-03-02'}),sc(3,{paused:true}),sc(4,{cat:2}),sc(5,{amt:900})],nsch:6});
 const r=need(f,'2026-03',1);assert.equal(r.target,200+50*5);assert.equal(r.needed,450);
 const g=mk([cat(1,'Bills',{type:'sched'})],{sched:[sc(1,{skipped:['2026-03-05']})],nsch:2});assert.equal(need(g,'2026-03',1).target,0);assert.equal(need(g,'2026-03',1).funded,true);assert.equal(need(g,'2026-04',1).target,200)});
t('percent of income',()=>{
 const f=mk([cat(1,'Save',{type:'pct',pct:10}),cat(2,'Pay',null,{income:true})],{accounts:[A({start:0})],tx:[X(1,'2026-03-01',2,100000)],budget:{'2026-03':{1:4000}}});
 const r=need(f,'2026-03',1);assert.equal(r.target,10000);assert.equal(r.needed,6000);assert.equal(r.progress,0.4);assert.equal(need(f,'2026-04',1).target,0)});
t('fund goal and fund all: add mode, idempotent, lists counts',()=>{
 const f=mk([cat(1,'Food',{type:'monthly',amt:1000}),cat(2,'Trip',{type:'by',amt:1200,date:'2026-12'}),cat(3,'Rent'),cat(4,'Hid',{type:'monthly',amt:70},{hidden:true})],{budget:{'2026-10':{1:400}}});
 const A0=finGoalAll(f,'2026-10',NOW);assert.equal(A0.count,2);assert.equal(A0.under,600+400);
 const r=finGoalFund(f,'2026-10',NOW,{});assert.equal(r.n,2);assert.equal(r.total,1000);assert.deepEqual(r.ids.sort(),[1,2]);
 assert.equal(f.budget['2026-10'][1],1000);assert.equal(f.budget['2026-10'][2],400);assert.equal(f.budget['2026-10'][4],undefined);assert.equal(f.budget['2026-10'][3],undefined);
 const r2=finGoalFund(f,'2026-10',NOW,{});assert.equal(r2.n,0);assert.equal(r2.total,0);assert.equal(finGoalAll(f,'2026-10',NOW).under,0);
 const s1=JSON.stringify(f.budget);finGoalFund(f,'2026-10',NOW,{});assert.equal(JSON.stringify(f.budget),s1)});
t('fund one category only, even if hidden',()=>{
 const f=mk([cat(1,'Food',{type:'monthly',amt:1000}),cat(4,'Hid',{type:'monthly',amt:70},{hidden:true})]);
 let r=finGoalFund(f,'2026-10',NOW,{id:4});assert.equal(r.n,1);assert.equal(f.budget['2026-10'][4],70);assert.equal(f.budget['2026-10'][1],undefined);
 r=finGoalFund(f,'2026-10',NOW,{id:4});assert.equal(r.n,0)});
t('fund overbudgets when there is not enough money (To budget goes negative)',()=>{
 const f=mk([cat(1,'Food',{type:'monthly',amt:1000}),cat(2,'Fun',{type:'monthly',amt:800})],{accounts:[A({start:1500,startDate:'2026-01-01'})]});
 assert.equal(calc(f,'2026-10',NOW).toBudget,1500);
 const r=finGoalFund(f,'2026-10',NOW,{});assert.equal(r.n,2);assert.equal(r.total,1800);assert.equal(r.toBudget,-300);assert.equal(r.over,true);
 assert.equal(finGoalFund(f,'2026-10',NOW,{}).n,0)});
t('reset mode sets budgeted to the target, also downwards, and is idempotent',()=>{
 const f=mk([cat(1,'Food',{type:'monthly',amt:1000}),cat(2,'Buf',{type:'balance',amt:500})],{budget:{'2026-10':{1:1800,2:900}}});
 const r=finGoalFund(f,'2026-10',NOW,{reset:true});assert.equal(r.n,2);assert.equal(f.budget['2026-10'][1],1000);assert.equal(f.budget['2026-10'][2],500);assert.equal(r.total,-1200);
 assert.equal(finGoalFund(f,'2026-10',NOW,{reset:true}).n,0)});
t('deleting a category drops its goal, merging keeps the target goal',()=>{
 const f=mk([cat(1,'A',{type:'monthly',amt:100}),cat(2,'B',{type:'cap',amt:50}),cat(3,'C')]);
 assert.equal(finDelCat(f,1,2),true);assert.deepEqual(f.cats.find(c=>c.id==2).goal,{type:'cap',amt:50});assert.equal(f.cats.find(c=>c.id==1),undefined);
 assert.equal(finDelCat(f,2,3),true);assert.ok(!('goal' in f.cats.find(c=>c.id==3)));
 assert.equal(finGoalAll(f,'2026-10',NOW).list.length,0)});
t('malformed input never throws or returns NaN',()=>{
 const f=mk([cat(1,'A',{type:'monthly',amt:100})]);const C=calc(f,'2026-10',NOW);
 assert.equal(finGoalNeed(f.cats[0],{type:'monthly',amt:100},'bad',C,f,NOW),null);assert.equal(finGoalNeed(f.cats[0],null,'2026-10',C,f,NOW),null);assert.equal(finGoalNeed({id:9},{type:'monthly',amt:1},'2026-10',C,f,NOW),null);
 const r=finGoalNeed(f.cats[0],{type:'monthly',amt:100},'2026-10',C,f,NOW);for(const k of['needed','target','underfunded','progress'])assert.ok(Number.isFinite(r[k]))});
console.log(passed+' passed');
