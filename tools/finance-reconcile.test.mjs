/* Dev-only test for Finance reconciliation (pure logic), extracted from index.html by tools/fin-extract.mjs.
   Run: node tools/finance-reconcile.test.mjs */
import assert from 'node:assert/strict';
import {loadFin} from './fin-extract.mjs';
const F=loadFin('2026-11-14');
const {finNorm,finClr,finClrSet,finBalances,finRecBank,finRecDiff,finRecFinish,finRecAdjust,finLockChg,finClrDrop,finLockXfer,finLockDel,finFilter,finRulesRun,finXferMake,finXferSet,finXferDel,finSplitSet,accountBalance,finBudgetCalc,finTotals,finSchedPost}=F;
let passed=0;const t=(n,f)=>{f();passed++;console.log('ok  '+n)};
const rt=f=>finNorm(JSON.parse(JSON.stringify(f)));
const AC=(id,name,type,o)=>Object.assign({id,name,type,onBudget:true,start:0,startDate:'2026-01-01'},o);
const TX=(id,acct,date,amt,o)=>Object.assign({id,acct,date,payee:'',cat:null,amt,notes:'',cleared:false},o);
const base=(tx)=>finNorm({accounts:[AC(1,'Bank','checking',{start:100000}),AC(2,'Card','credit',{start:-50000}),AC(3,'Fund','investment',{onBudget:false})],tx:tx||[],ntx:100});
const mk=()=>base([TX(1,1,'2026-11-01',20000,{cleared:true,reconciled:true}),TX(2,1,'2026-11-02',-3000,{cleared:true}),TX(3,1,'2026-11-05',-1000),TX(4,1,'2026-11-20',-500,{cleared:true}),TX(5,2,'2026-11-03',-7000,{cleared:true})]);

t('status helper and migration in finNorm',()=>{
 const f=rt({accounts:[AC(1,'A','checking')],tx:[TX(1,1,'2026-11-01',5),TX(2,1,'2026-11-01',5,{cleared:true}),TX(3,1,'2026-11-01',5,{reconciled:true}),TX(4,1,'2026-11-01',5,{cleared:'yes',reconciled:0}),TX(5,1,'2026-11-01',5,{cleared:false,reconciled:true})]});
 assert.deepEqual(f.tx.map(finClr),[0,1,2,1,2]);
 assert.ok(f.tx.filter(x=>finClr(x)==2).every(x=>x.cleared===true&&x.reconciled===true));
 assert.ok(f.tx.filter(x=>finClr(x)<2).every(x=>!('reconciled' in x)));
 const g=rt(f);assert.deepEqual(g,f);assert.deepEqual(rt(g),g);
 const x={cleared:false};finClrSet(x,2);assert.deepEqual(x,{cleared:true,reconciled:true});finClrSet(x,1);assert.deepEqual(x,{cleared:true});finClrSet(x,0);assert.deepEqual(x,{cleared:false})});
t('finNorm keeps split subs free of status and validates rec',()=>{
 const f=rt({accounts:[AC(1,'A','checking',{rec:{date:'2026-11-01',bal:12345}}),AC(2,'B','checking',{rec:{date:'2026-13-45',bal:1}}),AC(3,'C','checking',{rec:{date:'2026-11-01',bal:'x'}}),AC(4,'D','checking',{rec:'zz'})],
  tx:[TX(1,1,'2026-11-01',-100,{cleared:true,reconciled:true,subs:[{id:1,cat:1,amt:-60,cleared:true,reconciled:true},{id:2,cat:2,amt:-40,cleared:true}]})]});
 assert.deepEqual(f.accounts[0].rec,{date:'2026-11-01',bal:12345});
 for(const a of f.accounts.slice(1))assert.ok(!('rec' in a));
 const p=f.tx[0];assert.equal(finClr(p),2);assert.equal(p.subs.length,2);
 for(const s of p.subs)assert.deepEqual(Object.keys(s).sort(),['amt','cat','id','notes'])});
t('cleared, uncleared and working balances',()=>{
 const f=mk(),a=f.accounts[0];
 assert.deepEqual(finBalances(a,f.tx),{cleared:100000+20000-3000-500,uncleared:-1000,working:100000+20000-3000-500-1000});
 assert.equal(finBalances(a,f.tx).working,accountBalance(a,f.tx));
 const c=f.accounts[1];assert.deepEqual(finBalances(c,f.tx),{cleared:-57000,uncleared:0,working:-57000});
 const e=f.accounts[2];assert.deepEqual(finBalances(e,f.tx),{cleared:0,uncleared:0,working:0})});
t('balances as of a statement date',()=>{const f=mk();assert.equal(finBalances(f.accounts[0],f.tx,'2026-11-10').cleared,100000+20000-3000);assert.equal(finBalances(f.accounts[0],f.tx,'2026-10-31').cleared,100000)});
t('balances with transfers: each side has its own status',()=>{
 const f=mk();const [o,i]=finXferMake(f,{from:1,to:3,date:'2026-11-06',amt:4000});
 finClrSet(o,1);
 assert.equal(finClr(o),1);assert.equal(finClr(i),0);
 assert.equal(finBalances(f.accounts[0],f.tx).cleared,100000+20000-3000-500-4000);
 assert.equal(finBalances(f.accounts[2],f.tx).cleared,0);assert.equal(finBalances(f.accounts[2],f.tx).uncleared,4000);
 finXferSet(f,o.id,{amt:5000,notes:'n'});assert.equal(finClr(o),1);assert.equal(finClr(i),0);
 const g=rt(f);assert.equal(finClr(g.tx.find(x=>x.id==o.id)),1);assert.equal(finClr(g.tx.find(x=>x.id==i.id)),0)});
t('balances with split parents (status lives on the parent)',()=>{
 const f=mk(),p=f.tx.find(x=>x.id==2);assert.ok(finSplitSet(p,[{id:0,cat:1,amt:-2000,notes:''},{id:0,cat:2,amt:-1000,notes:''}],f));
 assert.equal(finClr(p),1);assert.ok(p.subs.every(s=>!('cleared' in s)&&!('reconciled' in s)));
 assert.equal(finBalances(f.accounts[0],f.tx).cleared,100000+20000-3000-500);
 finClrSet(p,0);assert.equal(finBalances(f.accounts[0],f.tx).uncleared,-4000)});
t('net worth and budget ignore status',()=>{
 const f=mk(),before=[finTotals(f.accounts,f.tx).net,JSON.stringify(finBudgetCalc(f,'2026-11','2026-11-14'))];
 for(const x of f.tx)finClrSet(x,0);
 assert.equal(finTotals(f.accounts,f.tx).net,before[0]);assert.equal(JSON.stringify(finBudgetCalc(f,'2026-11','2026-11-14')),before[1])});
t('difference: checking and credit card typed positive',()=>{
 const f=mk(),a=f.accounts[0],c=f.accounts[1];
 assert.equal(finRecDiff(a,f.tx,finRecBank(a,116500)),0,'cleared balance 116500, bank 116500');
 assert.equal(finRecDiff(a,f.tx,finRecBank(a,120000)),3500);assert.equal(finRecDiff(a,f.tx,finRecBank(a,100000)),-16500);
 assert.equal(finRecBank(c,57000),-57000,'a card statement of 57000 owed is stored as -57000');
 assert.equal(finRecDiff(c,f.tx,finRecBank(c,57000)),0);
 assert.equal(finRecDiff(c,f.tx,finRecBank(c,60000)),-3000,'owing more than cleared means a negative difference');
 assert.equal(finRecBank(c,-1000),1000,'minus sign = the bank owes you');assert.equal(Object.is(finRecBank(c,0),0),true);
 assert.equal(finRecBank(a,-5),-5);
 assert.equal(finRecDiff(a,f.tx,finRecBank(a,116500+500)),500,'no date: later cleared tx count');
 assert.equal(finRecDiff(a,f.tx,finRecBank(a,117000),'2026-11-10'),0,'as of the statement date')});
t('finish marks cleared tx up to the statement date only',()=>{
 const f=mk(),bank=117000;
 assert.equal(finRecFinish(f,1,'2026-11-10',bank+1),null,'non-zero difference refuses');
 assert.deepEqual(f.tx.map(finClr),[2,1,0,1,1]);assert.ok(!f.accounts[0].rec);
 assert.equal(finRecFinish(f,1,'2026-11-10',bank),1);
 assert.deepEqual(f.tx.map(finClr),[2,2,0,1,1],'tx 3 uncleared stays, tx 4 is after the date, card tx untouched');
 assert.deepEqual(f.accounts[0].rec,{date:'2026-11-10',bal:bank});assert.ok(!f.accounts[1].rec);
 assert.equal(finRecFinish(f,1,'2026-11-10',bank),0,'running again reconciles nothing new');
 assert.equal(finRecFinish(f,9,'2026-11-10',bank),null);assert.equal(finRecFinish(f,1,'bad',bank),null);
 assert.deepEqual(rt(f).accounts[0].rec,{date:'2026-11-10',bal:bank});
 assert.equal(finRecFinish(f,1,'2026-12-31',116500),1,'statement after tx 4 picks it up');assert.equal(finClr(f.tx[3]),2)});
t('toggling a row changes the difference',()=>{
 const f=mk(),a=f.accounts[0];assert.equal(finRecDiff(a,f.tx,117000-1000,'2026-11-10'),-1000);
 finClrSet(f.tx[2],1);assert.equal(finRecDiff(a,f.tx,117000-1000,'2026-11-10'),0)});
t('adjustment amount, sign, payee and budget impact',()=>{
 const f=mk(),a=f.accounts[0],on=finBudgetCalc(f,'2026-11','2026-11-14').toBudget,n0=f.tx.length;
 const up=finRecAdjust(f,1,'2026-11-10',120000);
 assert.equal(f.tx.length,n0+1);assert.equal(up.amt,3000,'bank is higher: positive adjustment');
 assert.equal(up.cat,null);assert.equal(up.payee,'Reconciliation balance adjustment');assert.equal(finClr(up),1);assert.equal(up.date,'2026-11-10');assert.equal(up.acct,1);
 assert.ok(f.payees.some(p=>p.name=='Reconciliation balance adjustment'));
 assert.equal(finRecDiff(a,f.tx,120000,'2026-11-10'),0);
 assert.equal(finBudgetCalc(f,'2026-11','2026-11-14').toBudget,on+3000,'uncategorized inflow on an on-budget account changes To budget');
 const dn=finRecAdjust(f,1,'2026-11-10',110000);assert.equal(dn.amt,-10000,'bank is lower: negative adjustment');
 assert.equal(finRecAdjust(f,1,'2026-11-10',110000),null,'nothing to adjust');
 assert.equal(finRecFinish(f,1,'2026-11-10',110000),3,'tx 1 stays, 2 + 2 adjustments are cleared, tx 1 was already reconciled');
 const g=rt(f);assert.equal(g.tx.length,f.tx.length);assert.equal(g.payees.filter(p=>p.name=='Reconciliation balance adjustment').length,1)});
t('adjustment on a credit card and on an off-budget account',()=>{
 const f=mk(),c=f.accounts[1],bank=finRecBank(c,60000);const x=finRecAdjust(f,2,'2026-11-10',bank);
 assert.equal(x.amt,-3000);assert.equal(finRecDiff(c,f.tx,bank,'2026-11-10'),0);
 const y=finRecAdjust(f,3,'2026-11-10',777);assert.equal(y.amt,777);assert.equal(y.cat,null);
 assert.equal(finRecAdjust(f,1,'nope',1),null);assert.equal(finRecAdjust(f,1,'2026-11-10',1.5),null)});
t('lock rules for reconciled tx',()=>{
 const f=mk(),r=f.tx[0],c=f.tx[1],T=o=>Object.assign({acct:r.acct,date:r.date,amt:r.amt},o);
 assert.equal(finLockChg(r,T()),false,'payee, category and notes are free');
 assert.equal(finLockChg(r,T({amt:5})),true);assert.equal(finLockChg(r,T({date:'2026-11-02'})),true);assert.equal(finLockChg(r,T({acct:3})),true);
 assert.equal(finLockChg(c,{acct:1,date:c.date,amt:1}),false,'only reconciled tx are locked');
 assert.equal(finClrDrop(r,T()),false);assert.equal(finClr(r),2);
 assert.equal(finClrDrop(r,T({amt:5})),true);assert.equal(finClr(r),1,'drops to cleared, not uncleared');
 assert.equal(finLockDel(f,2),false);finClrSet(f.tx[1],2);assert.equal(finLockDel(f,2),true)});
t('lock rules for transfers: either side reconciled',()=>{
 const f=mk(),[o,i]=finXferMake(f,{from:1,to:3,date:'2026-11-06',amt:4000});
 assert.equal(finLockDel(f,o.id),false);finClrSet(i,2);
 assert.equal(finLockDel(f,o.id),true);assert.equal(finLockDel(f,i.id),true);
 assert.equal(finLockXfer(f,o.id,{notes:'x'}),false,'notes only');
 assert.equal(finLockXfer(f,o.id,{amt:4001}),true);assert.equal(finLockXfer(f,i.id,{date:'2026-11-07'}),true);assert.equal(finLockXfer(f,o.id,{from:2}),false,'only the reconciled side matters: its account is unchanged');
 assert.equal(finLockXfer(f,o.id,{to:2}),true);
 assert.equal(finClr(i),2,'the check itself changes nothing');assert.equal(i.amt,4000);
 finXferSet(f,o.id,{amt:4500});assert.equal(finClr(i),1,'edited side drops to cleared');assert.equal(finClr(o),0);
 const g=mk(),[p,q]=finXferMake(g,{from:1,to:3,date:'2026-11-06',amt:4000});finClrSet(p,2);finXferSet(g,p.id,{notes:'only notes'});assert.equal(finClr(p),2);
 finXferDel(g,q.id);assert.ok(!g.tx.some(x=>x.id==p.id))});
t('"apply to existing" rules skip reconciled tx and count them',()=>{
 const f=base([TX(1,1,'2026-11-01',-100,{payee:'Exito',cleared:true,reconciled:true}),TX(2,1,'2026-11-02',-100,{payee:'Exito',cleared:true}),TX(3,1,'2026-11-03',-100,{payee:'Exito'})]);
 const gr=f.cats.find(c=>c.name=='Groceries').id,rule={id:1,stage:'default',conds:[{field:'payee',op:'is',value:'Exito'}],condsOp:'and',actions:[{field:'category',op:'set',value:gr}],enabled:true,order:0};
 const dry=finRulesRun(f,[rule],true);assert.deepEqual(dry,{matches:3,changes:2,over:0,skipped:1});assert.equal(f.tx[0].cat,null);
 const out=finRulesRun(f,[rule],false);assert.equal(out.changes,2);assert.equal(out.skipped,1);
 assert.deepEqual(f.tx.map(x=>x.cat),[null,gr,gr]);assert.equal(finClr(f.tx[0]),2);assert.equal(finClr(f.tx[1]),1);
 assert.deepEqual(finRulesRun(f,[rule],true),{matches:3,changes:0,over:0,skipped:1},'the reconciled tx is still skipped, not rewritten')});
t('status filter',()=>{
 const f=mk(),n=st=>finFilter(f.tx,{st},f.cats,'COP','2026-11-14',f.accounts).map(x=>x.id);
 assert.deepEqual(n('unc'),[3]);assert.deepEqual(n('clr'),[2,4,5]);assert.deepEqual(n('rec'),[1]);
 assert.deepEqual(n('all'),[1,2,3,4,5]);assert.deepEqual(n(undefined),[1,2,3,4,5]);
 assert.deepEqual(finFilter(f.tx,{st:'clr',acct:1},f.cats,'COP','2026-11-14',f.accounts).map(x=>x.id),[2,4])});
t('schedule-posted tx start uncleared and new tx via finNorm keep status per tx',()=>{
 const f=base([]);f.sched=[{id:1,name:'Rent',acct:1,payee:'LL',cat:null,amt:-100,amtOp:'is',notes:'',start:'2026-11-01',rule:{freq:'month',n:1,dom:1},end:{type:'never'},auto:false,skipWeekend:'none',skipped:[]}];f.nsch=2;
 const g=rt(f),x=finSchedPost(g,g.sched[0],'2026-11-01');assert.ok(x);assert.equal(finClr(g.tx[g.tx.length-1]),0)});
t('deleting an account keeps the status of the surviving transfer side',()=>{
 const f=mk(),[o,i]=finXferMake(f,{from:1,to:3,date:'2026-11-06',amt:4000});finClrSet(i,2);F.finDelAcct(f,1);
 const k=f.tx.find(x=>x.id==i.id);assert.ok(k);assert.equal(finClr(k),2);assert.ok(!k.xfer)});
console.log(passed+' tests passed');
