/* Dev-only test for Finance reports (pure logic from index.html via tools/fin-extract.mjs).
   Run: node tools/finance-reports.test.mjs */
import assert from 'node:assert/strict';
import {loadFin} from './fin-extract.mjs';
const F=loadFin('2026-11-14');
const {finNorm,finRepRange,finRepMonths,finRepFlow,finRepRate,finRepSeries,finRepRank,finRepPrev,finRepDelta,finRepCmp,finRepNetWorth,finRepThin,finRepCompact,accountBalance,finTotals,finSplitSet}=F;
let passed=0;const t=(n,f)=>{f();passed++;console.log('ok  '+n)};
const NOW='2026-11-14';
const A=(o)=>Object.assign({id:1,name:'Main',onBudget:true,start:0,startDate:'2026-01-01'},o);
const X=(id,date,cat,amt,o)=>Object.assign({id,acct:1,date,cat,amt},o);
const cats=[{id:1,name:'Food',group:null},{id:2,name:'Rent',group:null},{id:3,name:'Pay',group:null,income:true},{id:4,name:'Fun',group:null}];
const mk=(o)=>finNorm(Object.assign({accounts:[A()],cats,tx:[]},o));

t('range presets',()=>{
 assert.deepEqual(finRepRange('this',NOW,[]),{from:'2026-11-01',to:'2026-11-30'});
 assert.deepEqual(finRepRange('last',NOW,[]),{from:'2026-10-01',to:'2026-10-31'});
 assert.deepEqual(finRepRange('l3',NOW,[]),{from:'2026-09-01',to:'2026-11-30'});
 assert.deepEqual(finRepRange('l6',NOW,[]),{from:'2026-06-01',to:'2026-11-30'});
 assert.deepEqual(finRepRange('l12',NOW,[]),{from:'2025-12-01',to:'2026-11-30'});
 assert.deepEqual(finRepRange('year',NOW,[]),{from:'2026-01-01',to:'2026-11-30'});
 assert.deepEqual(finRepRange('last','2026-01-20',[]),{from:'2025-12-01',to:'2025-12-31'});
 assert.deepEqual(finRepRange('this','2028-02-10',[]),{from:'2028-02-01',to:'2028-02-29'});
 assert.equal(finRepRange('this','bad',[]),null)});
t('all and custom ranges',()=>{
 const tx=[X(1,'2024-05-03',1,-5),X(2,'2026-12-20',1,-5)];
 assert.deepEqual(finRepRange('all',NOW,tx),{from:'2024-05-03',to:'2026-12-20'});
 assert.deepEqual(finRepRange('all',NOW,[]),{from:'2026-11-01',to:'2026-11-30'});
 assert.deepEqual(finRepRange('custom',NOW,tx,'2026-03-10','2026-02-01'),{from:'2026-02-01',to:'2026-03-10'});
 assert.deepEqual(finRepRange('custom',NOW,tx,'2026-03-10',''),{from:'2026-03-10',to:'2026-11-30'});
 assert.deepEqual(finRepRange('custom',NOW,tx,'','2026-03-10'),{from:'2024-05-03',to:'2026-03-10'});
 assert.deepEqual(finRepRange('custom',NOW,tx,'x','y'),{from:'2026-11-01',to:'2026-11-30'});
 assert.deepEqual(finRepMonths('2026-10-15','2027-01-02'),['2026-10','2026-11','2026-12','2027-01']);
 assert.deepEqual(finRepMonths('2026-11-01','2026-10-01'),[]);assert.equal(finRepMonths('2000-01-01','2999-12-31').length,600)});
t('flow: income, expenses, refunds, uncategorized',()=>{
 const f=mk({tx:[X(1,'2026-11-01',3,500000),X(2,'2026-11-02',1,-200000),X(3,'2026-11-03',1,50000),X(4,'2026-11-04',null,-30000),X(5,'2026-11-05',null,70000),X(6,'2026-10-31',1,-999),X(7,'2026-12-01',1,-999)]});
 const r=finRepFlow(f,{from:'2026-11-01',to:'2026-11-30'});
 assert.equal(r.income,570000);assert.equal(r.expense,180000);assert.equal(r.net,390000);
 assert.deepEqual(r.inc,{3:500000,none:70000});assert.deepEqual(r.exp,{1:150000,none:30000});
 assert.deepEqual(r.months['2026-11'],{income:570000,expense:180000});assert.equal(finRepRate(r.income,r.net),68.4);assert.equal(finRepRate(0,0),null)});
t('flow: transfers between in-scope accounts are skipped, others count',()=>{
 const f=mk({accounts:[A(),A({id:2,name:'Savings',onBudget:true}),A({id:3,name:'Broker',onBudget:false})],
  tx:[X(1,'2026-11-02',null,-1000,{xfer:2}),X(2,'2026-11-02',null,1000,{acct:2,xfer:1}),
      X(3,'2026-11-03',4,-2000,{xfer:4}),X(4,'2026-11-03',null,2000,{acct:3,xfer:3}),X(5,'2026-11-04',1,-300)]});
 const all=finRepFlow(f,{scope:'all'}),on=finRepFlow(f,{scope:'on'});
 assert.equal(all.expense,300);assert.equal(all.income,0);
 assert.equal(on.expense,2300);assert.equal(on.exp[4],2000);assert.equal(on.income,0)});
t('flow: splits count per line, closed accounts count, scope on excludes off budget',()=>{
 const f=mk({accounts:[A(),A({id:2,onBudget:false}),A({id:3,closed:true})],tx:[X(1,'2026-11-02',null,-1000),X(2,'2026-11-02',1,-400,{acct:2}),X(3,'2026-11-03',2,-100,{acct:3})]});
 assert.ok(finSplitSet(f.tx[0],[{cat:1,amt:-600},{cat:2,amt:-400}],f));
 const all=finRepFlow(f,{}),on=finRepFlow(f,{scope:'on'});
 assert.deepEqual(all.exp,{1:1000,2:500});assert.equal(all.expense,1500);
 assert.deepEqual(on.exp,{1:600,2:500});assert.equal(on.expense,1100)});
t('flow: unknown category ids fall back to uncategorized and bad data is ignored',()=>{
 const r=finRepFlow({accounts:[A()],cats,tx:[X(1,'2026-11-02',99,-5),X(2,'nope',1,-5),null,X(3,'2026-11-02',1,'x')]},{});
 assert.deepEqual(r.exp,{none:5});assert.equal(r.expense,5);
 assert.equal(finRepFlow(null,{}).net,0)});
t('series: monthly, yearly past 24 months',()=>{
 const f=mk({tx:[X(1,'2026-09-02',3,1000),X(2,'2026-11-02',1,-400)]});
 const fl=finRepFlow(f,{from:'2026-09-01',to:'2026-11-30'}),s=finRepSeries(fl,'2026-09-01','2026-11-30');
 assert.deepEqual(s.map(x=>[x.key,x.income,x.expense,x.net]),[['2026-09',1000,0,1000],['2026-10',0,0,0],['2026-11',0,400,-400]]);
 const y=finRepSeries({months:{'2024-05':{income:5,expense:1},'2025-07':{income:3,expense:3}}},'2024-01-01','2026-11-30');
 assert.deepEqual(y.map(x=>[x.key,x.income,x.expense,x.net]),[['2024',5,1,4],['2025',3,3,0],['2026',0,0,0]]);assert.ok(y[0].year)});
t('rank: sorted, other bucket, groups, refunds',()=>{
 const f=mk({groups:[{id:1,name:'Needs'},{id:2,name:'Wants'}],cats:[{id:1,name:'Food',group:1},{id:2,name:'Rent',group:1},{id:4,name:'Fun',group:2},{id:5,name:'Gym',group:2}]});
 const m={1:300,2:500,4:100,5:50,none:20};
 let r=finRepRank(m,f,8,'cat');assert.deepEqual(r.rows.map(x=>x.name||x.id),['Rent','Food','Fun','Gym','none']);assert.equal(r.total,970);
 r=finRepRank(m,f,2,'cat');assert.deepEqual(r.rows.map(x=>x.id),[2,1,'other']);assert.equal(r.rows[2].amt,170);
 r=finRepRank(m,f,4,'cat');assert.equal(r.rows.length,5);
 r=finRepRank(m,f,8,'group');assert.deepEqual(r.rows.map(x=>[x.id,x.name,x.amt]),[['g1','Needs',800],['g2','Wants',150],['none','',20]]);
 r=finRepRank({1:300,4:-80},f,8,'cat');assert.deepEqual(r.rows.map(x=>x.id),[1]);assert.equal(r.neg,-80);assert.equal(r.total,300);
 assert.deepEqual(finRepRank({},f,8).rows,[])});
t('net worth by month matches the Accounts screen',()=>{
 const f=mk({accounts:[A({start:1000,startDate:'2026-02-10'}),A({id:2,name:'Card',type:'credit',start:-300,startDate:'2026-01-01',onBudget:true}),A({id:3,name:'Old',closed:true,start:777}),A({id:4,name:'Inv',onBudget:false,start:5000,startDate:'2026-01-01'})],
  tx:[X(1,'2026-02-15',3,200),X(2,'2026-03-01',1,-50,{acct:2}),X(3,'2026-04-02',1,-100)]});
 const p=finRepNetWorth(f,{from:'2026-01-01',to:'2026-04-30'});
 assert.deepEqual(p.map(x=>[x.month,x.net,x.assets,x.debts]),[['2026-01',4700,5000,-300],['2026-02',5900,6200,-300],['2026-03',5850,6200,-350],['2026-04',5750,6100,-350]]);
 assert.equal(p[3].net,finTotals(f.accounts,f.tx).net);
 const on=finRepNetWorth(f,{from:'2026-04-01',to:'2026-04-30',scope:'on'});assert.equal(on[0].net,750);
 const cl=finRepNetWorth(f,{from:'2026-03-01',to:'2026-03-15'});assert.equal(cl[0].date,'2026-03-15');
 assert.deepEqual(finRepNetWorth(f,{from:'2026-05-01',to:'2026-04-01'}),[])});
t('thin keeps first and last',()=>{
 const a=Array.from({length:100},(_,i)=>i),r=finRepThin(a,10);assert.equal(r.length,10);assert.equal(r[0],0);assert.equal(r[9],99);
 assert.equal(finRepThin([1,2],10).length,2);assert.deepEqual(finRepThin(null,5),[])});
t('compact formatter',()=>{
 const c=(n,k)=>finRepCompact(n,k||'COP');
 assert.equal(c(0),'0');assert.equal(c(NaN),'0');assert.equal(c(40),'0');assert.equal(c(95000),'950');assert.equal(c(120000),'1,2k');assert.equal(c(25000000),'250k');
 assert.equal(c(99995000),'1M');assert.equal(c(150000000),'1,5M');assert.equal(c(-150000000),'-1,5M');assert.equal(c(1000000000),'10M');assert.equal(c(20000000000),'200M');assert.equal(c(1e12),'10B');assert.equal(c(25e13),'2500B');
 assert.equal(finRepCompact(123456,'USD'),'1.2k');assert.equal(finRepCompact(-5000,'USD'),'-50');assert.equal(finRepCompact(100000,'USD'),'1k');assert.equal(finRepCompact(99999,'USD'),'1k')});
t('previous period: whole months',()=>{
 assert.deepEqual(finRepPrev({from:'2026-11-01',to:'2026-11-30'}),{from:'2026-10-01',to:'2026-10-31'});
 assert.deepEqual(finRepPrev({from:'2026-01-01',to:'2026-01-31'}),{from:'2025-12-01',to:'2025-12-31'});
 assert.deepEqual(finRepPrev({from:'2026-03-01',to:'2026-03-31'}),{from:'2026-02-01',to:'2026-02-28'});
 assert.deepEqual(finRepPrev({from:'2028-03-01',to:'2028-03-31'}),{from:'2028-02-01',to:'2028-02-29'});
 assert.deepEqual(finRepPrev({from:'2026-09-01',to:'2026-11-30'}),{from:'2026-06-01',to:'2026-08-31'});
 assert.deepEqual(finRepPrev({from:'2026-01-01',to:'2026-03-31'}),{from:'2025-10-01',to:'2025-12-31'});
 assert.deepEqual(finRepPrev({from:'2025-12-01',to:'2026-11-30'}),{from:'2024-12-01',to:'2025-11-30'});
 assert.deepEqual(finRepPrev({from:'2026-01-01',to:'2026-11-30'}),{from:'2025-02-01',to:'2025-12-31'});
 assert.deepEqual(finRepPrev(finRepRange('l6',NOW,[])),{from:'2025-12-01',to:'2026-05-31'})});
t('previous period: custom spans',()=>{
 assert.deepEqual(finRepPrev({from:'2026-03-10',to:'2026-03-16'}),{from:'2026-03-03',to:'2026-03-09'});
 assert.deepEqual(finRepPrev({from:'2026-01-05',to:'2026-01-14'}),{from:'2025-12-26',to:'2026-01-04'});
 assert.deepEqual(finRepPrev({from:'2026-03-01',to:'2026-03-10'}),{from:'2026-02-19',to:'2026-02-28'});
 assert.deepEqual(finRepPrev({from:'2028-03-02',to:'2028-03-02'}),{from:'2028-03-01',to:'2028-03-01'});
 assert.deepEqual(finRepPrev({from:'2026-02-15',to:'2026-04-14'}),{from:'2025-12-18',to:'2026-02-14'});
 assert.equal(finRepPrev(null),null);assert.equal(finRepPrev({from:'x',to:'2026-01-01'}),null);assert.equal(finRepPrev({from:'2026-02-01',to:'2026-01-01'}),null)});
t('delta kinds',()=>{
 assert.deepEqual(finRepDelta(120,100),{amt:20,pct:20,kind:'up'});
 assert.deepEqual(finRepDelta(75,100),{amt:-25,pct:-25,kind:'down'});
 assert.deepEqual(finRepDelta(100,100),{amt:0,pct:0,kind:'same'});
 assert.deepEqual(finRepDelta(50,0),{amt:50,pct:null,kind:'new'});
 assert.equal(finRepDelta(1,3).pct,-66.7)});
t('per-category delta against the previous period',()=>{
 const f=mk({tx:[X(1,'2026-10-05',1,-100),X(2,'2026-10-06',2,-500),X(3,'2026-10-07',4,-40),X(4,'2026-11-05',1,-150),X(5,'2026-11-06',2,-500),X(6,'2026-11-07',3,900),X(7,'2026-11-08',null,-30)]});
 const rg={from:'2026-11-01',to:'2026-11-30'},pv=finRepPrev(rg);
 const cu=finRepFlow(f,{from:rg.from,to:rg.to}),pr=finRepFlow(f,{from:pv.from,to:pv.to});
 const rk=finRepRank(cu.exp,f,8,'cat'),rows=finRepCmp(rk,finRepRank(cu.exp,f,1e5,'cat'),finRepRank(pr.exp,f,1e5,'cat'));
 const g=id=>rows.find(r=>r.id==id);
 assert.deepEqual(g(1).d,{amt:50,pct:50,kind:'up'});assert.equal(g(1).prev,100);
 assert.equal(g(2).d.kind,'same');
 assert.equal(g('none').d.kind,'new');assert.equal(g('none').prev,0);
 assert.equal(g(4),undefined)});
t('delta of the Other row uses the hidden categories',()=>{
 const f=mk({cats:cats.concat([{id:5,name:'Gym',group:null}]),tx:[X(1,'2026-10-05',1,-10),X(2,'2026-10-06',2,-20),X(3,'2026-10-07',4,-30),X(4,'2026-11-05',1,-100),X(5,'2026-11-06',2,-200),X(6,'2026-11-07',4,-300),X(7,'2026-11-08',5,-50)]});
 const cu=finRepFlow(f,{from:'2026-11-01',to:'2026-11-30'}),pr=finRepFlow(f,{from:'2026-10-01',to:'2026-10-31'});
 const rk=finRepRank(cu.exp,f,2,'cat'),rows=finRepCmp(rk,finRepRank(cu.exp,f,1e5,'cat'),finRepRank(pr.exp,f,1e5,'cat')),o=rows.find(r=>r.id=='other');
 assert.deepEqual(rows.map(r=>r.id),[4,2,'other']);assert.equal(o.amt,150);assert.equal(o.prev,10);assert.equal(o.d.kind,'up');assert.equal(rows[0].prev,30);
 assert.deepEqual(finRepCmp({rows:[]},null,null),[])});
t('group delta',()=>{
 const f=mk({groups:[{id:1,name:'Home',order:0}],cats:[{id:1,name:'Food',group:1},{id:2,name:'Rent',group:1},{id:3,name:'Pay',group:null,income:true},{id:4,name:'Fun',group:null}],tx:[X(1,'2026-10-05',1,-100),X(2,'2026-10-06',2,-100),X(3,'2026-11-05',1,-150),X(4,'2026-11-06',2,-150)]});
 const cu=finRepFlow(f,{from:'2026-11-01',to:'2026-11-30'}),pr=finRepFlow(f,{from:'2026-10-01',to:'2026-10-31'});
 const rows=finRepCmp(finRepRank(cu.exp,f,8,'group'),finRepRank(cu.exp,f,1e5,'group'),finRepRank(pr.exp,f,1e5,'group'));
 assert.equal(rows.length,1);assert.equal(rows[0].id,'g1');assert.deepEqual(rows[0].d,{amt:100,pct:50,kind:'up'})});
console.log('\n'+passed+' passed');
