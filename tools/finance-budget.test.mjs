/* Dev-only test for Finance > Budget pure logic, extracted from index.html by tools/fin-extract.mjs.
   Run: node tools/finance-budget.test.mjs */
import assert from 'node:assert/strict';
import {loadFin} from './fin-extract.mjs';
const F=loadFin('2026-11-14');
const {finNorm,finMonth,finMonthAdd,finBudgetCalc:calc,finBudgetCopy,finBudgetSpent,finBudgetAvg3}=F;
let passed=0;const t=(n,f)=>{f();passed++;console.log('ok  '+n)};
const cats=[{id:1,name:'Food'},{id:2,name:'Pay',income:true},{id:3,name:'Fun'}];
const A=(o)=>Object.assign({id:1,name:'Main',onBudget:true,start:0,startDate:'2026-01-01'},o);
const X=(id,date,cat,amt,acct=1)=>({id,acct,date,cat,amt});
const mk=(o)=>Object.assign({accounts:[A()],cats,tx:[],budget:{}},o);

t('month helpers',()=>{assert.equal(finMonth('2026-03-09'),'2026-03');assert.equal(finMonth('x'),'');assert.equal(finMonth('2026-13-01'),'');assert.equal(finMonthAdd('2026-11',1),'2026-12');assert.equal(finMonthAdd('2026-12',1),'2027-01');assert.equal(finMonthAdd('2026-01',-1),'2025-12');assert.equal(finMonthAdd('bad',1),'')});
t('activity per category and month, income excluded from categories',()=>{
 const f=mk({tx:[X(1,'2026-03-02',1,-500),X(2,'2026-03-20',1,-250),X(3,'2026-03-05',3,-100),X(4,'2026-03-01',2,10000),X(5,'2026-04-01',1,-70)]});
 const c=calc(f,'2026-03');assert.equal(c.cats[1].activity,-750);assert.equal(c.cats[3].activity,-100);assert.equal(c.activity,-850);assert.equal(c.income,10000);assert.equal(c.cats[2],undefined);assert.equal(calc(f,'2026-04').cats[1].activity,-70)});
t('positive balance rolls over',()=>{
 const f=mk({tx:[X(1,'2026-03-02',1,-300),X(2,'2026-04-02',1,-100)],budget:{'2026-03':{1:1000},'2026-04':{1:200}}});
 assert.equal(calc(f,'2026-03').cats[1].balance,700);const a=calc(f,'2026-04').cats[1];assert.equal(a.carry,700);assert.equal(a.balance,800);assert.equal(calc(f,'2026-06').cats[1].balance,800)});
t('overspending does not carry into the category but reduces next To budget',()=>{
 const f=mk({accounts:[A({start:5000,startDate:'2026-03-01'})],tx:[X(1,'2026-03-02',1,-300)],budget:{'2026-03':{1:100},'2026-04':{1:50}}});
 const m=calc(f,'2026-03');assert.equal(m.cats[1].balance,-200);assert.equal(m.toBudget,5000-100);
 const a=calc(f,'2026-04');assert.equal(a.cats[1].carry,0);assert.equal(a.cats[1].balance,50);assert.equal(a.overspentPrev,200);assert.equal(a.toBudget,5000-150-200);
 const b=calc(f,'2026-05');assert.equal(b.overspentPrev,0);assert.equal(b.toBudget,5000-150-200);assert.equal(b.cats[1].balance,50)});
t('To budget with income and starting balances',()=>{
 const f=mk({accounts:[A({start:1000,startDate:'2026-02-10'}),A({id:2,start:500,startDate:'2026-03-01'})],tx:[X(1,'2026-03-05',2,2000),X(2,'2026-03-06',1,-50,2)],budget:{'2026-03':{1:300}}});
 assert.equal(calc(f,'2026-02').toBudget,1000);assert.equal(calc(f,'2026-02').income,1000);
 const m=calc(f,'2026-03');assert.equal(m.income,2500);assert.equal(m.toBudget,1000+2500-300);assert.equal(m.avail,m.toBudget+300+0)});
t('starting balance without startDate counts in the earliest month',()=>{
 const f=mk({accounts:[A({start:900,startDate:''})],tx:[X(1,'2026-05-02',1,-10)]});
 assert.equal(calc(f,'2026-05').income,900);assert.equal(calc(f,'2026-06').toBudget,900-10);assert.equal(calc(f,'2026-04').toBudget,0);
 const g=mk({accounts:[A({start:900,startDate:''})]});assert.equal(calc(g,'2026-11','2026-11').income,900);assert.equal(calc(g,'2026-12','2026-11').toBudget,900)});
t('off-budget accounts and their tx are ignored',()=>{
 const f=mk({accounts:[A(),A({id:2,onBudget:false,start:99999,startDate:'2026-03-01'})],tx:[X(1,'2026-03-02',1,-100,2),X(2,'2026-03-02',2,5000,2),X(3,'2026-03-02',null,-9,2)]});
 const c=calc(f,'2026-03');assert.equal(c.activity,0);assert.equal(c.income,0);assert.equal(c.uncat,0);assert.equal(c.toBudget,0)});
t('closed on-budget accounts still count',()=>{const f=mk({accounts:[A({closed:true})],tx:[X(1,'2026-03-02',1,-100)]});assert.equal(calc(f,'2026-03').activity,-100)});
t('uncategorized tx adjust available funds directly (both signs)',()=>{
 const f=mk({accounts:[A({start:1000,startDate:'2026-03-01'})],tx:[X(1,'2026-03-02',null,-300),X(2,'2026-03-03',null,100)],budget:{'2026-03':{1:200}}});
 const c=calc(f,'2026-03');assert.equal(c.uncat,-200);assert.equal(c.toBudget,1000-200-200);assert.equal(calc(f,'2026-04').toBudget,600)});
t('unknown category ids count as uncategorized',()=>{const f=mk({tx:[X(1,'2026-03-02',99,-40)]});assert.equal(calc(f,'2026-03').uncat,-40)});
t('copy last month',()=>{const f=mk({budget:{'2026-03':{1:10,3:20}}});const c=finBudgetCopy(f,'2026-04');assert.deepEqual(c,{1:10,3:20});c[1]=99;assert.equal(f.budget['2026-03'][1],10);assert.deepEqual(finBudgetCopy(f,'2026-06'),{});assert.deepEqual(finBudgetCopy({},'2026-06'),{})});
t('last month spent and 3-month average',()=>{
 const f=mk({tx:[X(1,'2026-01-05',1,-300),X(2,'2026-02-05',1,-600),X(3,'2026-03-05',1,200),X(4,'2026-03-06',1,-50)]});
 assert.equal(finBudgetSpent(f,'2026-02',1),600);assert.equal(finBudgetSpent(f,'2026-03',1),0);
 assert.equal(finBudgetAvg3(f,'2026-04',1),300);assert.equal(finBudgetAvg3(f,'2026-04',77),0);assert.equal(finBudgetAvg3(f,'2026-05',1),200)});
t('month with no data and empty fin returns zeros, no NaN',()=>{
 for(const f of [mk(),{},null,undefined,{accounts:[],cats:[]}])for(const m of ['2026-11','1999-01','2100-12']){const c=calc(f,m);for(const k of ['income','uncat','budgeted','activity','balance','overspentPrev','avail','toBudget'])assert.ok(Number.isFinite(c[k])&&c[k]===0,k)}
 assert.equal(JSON.stringify(calc(mk(),'bad')).includes('null'),false)});
t('walk is capped (far-past tx do not hang)',()=>{const f=mk({tx:[X(1,'1900-01-01',1,-5)]});assert.ok(Number.isFinite(calc(f,'2026-11').toBudget))});
t('finNorm: missing budget defaults to {} and is idempotent',()=>{assert.deepEqual(finNorm({accounts:[]}).budget,{});const a=finNorm({accounts:[],budget:{'2026-03':{1:100.4}}});assert.deepEqual(finNorm(JSON.parse(JSON.stringify(a))),a)});
t('finNorm: cleans dirty budget',()=>{
 const f=finNorm({accounts:[],cats:[{id:1,name:'Food'},{id:2,name:'Pay',income:true}],budget:{'2026-03':{1:'250.4',2:100,9:5,3:0,x:4},'2026-13':{1:5},'bad':{1:5},'2026-04':{1:0},'2026-05':'oops','2026-06':{1:NaN}}});
 assert.deepEqual(f.budget,{'2026-03':{1:250}});
 for(const b of [null,[],'x',5])assert.deepEqual(finNorm({budget:b}).budget,{});
 const d=finNorm({});assert.ok(Object.keys(d.budget).length===0)});
console.log(passed+' passed');
