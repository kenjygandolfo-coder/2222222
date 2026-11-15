/* Dev-only test for Finance transfers (pure logic), extracted from index.html by tools/fin-extract.mjs.
   Run: node tools/finance-transfer.test.mjs */
import assert from 'node:assert/strict';
import {loadFin} from './fin-extract.mjs';
const F=loadFin('2026-11-14');
const {finNorm,finBudgetCalc:calc,finXferKind,finXferOther,finXferMake,finXferSet,finXferDel,finXferUnlink,finDelAcct,finCardDue,finFilter,finTxTotals,finTotals,finRunning,accountBalance,finIncomeByCat}=F;
let passed=0;const t=(n,f)=>{f();passed++;console.log('ok  '+n)};
const rt=f=>finNorm(JSON.parse(JSON.stringify(f)));
const AC=(id,name,onBudget,o)=>Object.assign({id,name,type:'checking',onBudget,start:0,startDate:'2026-01-01'},o);
/* 1 bank (on), 2 wallet (on), 3 broker (off), 4 loan tracker (off), 5 credit card (on, debt -300000) */
const base=()=>finNorm({accounts:[AC(1,'Bank',true,{start:1000000}),AC(2,'Wallet',true),AC(3,'Broker',false,{start:500000}),AC(4,'Other off',false),AC(5,'Card',true,{type:'credit',start:-300000})],tx:[{id:1,acct:1,date:'2026-11-01',cat:null,amt:200000,payee:'Boss',notes:''}],ntx:2});
const cid=(f,n)=>f.cats.find(c=>c.name==n).id;
const mk=(f,from,to,amt,o)=>finXferMake(f,Object.assign({from,to,date:'2026-11-05',amt,notes:'n'},o));
const B=(f)=>calc(f,'2026-11','2026-11-14');

t('create a transfer: two linked tx, opposite amounts, no payee',()=>{const f=base(),[o,i]=mk(f,1,3,50000);
 assert.equal(o.amt,-50000);assert.equal(i.amt,50000);assert.equal(o.xfer,i.id);assert.equal(i.xfer,o.id);assert.equal(o.payee,'');assert.equal(o.date,i.date);assert.equal(f.tx.length,3);assert.equal(f.ntx,4);
 assert.equal(finXferOther(f.tx,o),i);assert.equal(finXferOther(f.tx,f.tx[0]),null);assert.deepEqual(rt(f),f)});
t('create validates accounts, amount and date',()=>{const f=base();assert.equal(mk(f,1,1,5),null);assert.equal(mk(f,1,9,5),null);assert.equal(mk(f,1,2,0),null);assert.equal(mk(f,1,2,-5),null);assert.equal(mk(f,1,2,1.5+0.2*0,{amt:'x'}),null);assert.equal(mk(f,1,2,5,{date:'2026-02-31'}),null);assert.equal(f.tx.length,1)});
t('transfers never create payees',()=>{const f=base();mk(f,1,2,5);assert.equal(rt(f).payees.filter(p=>p.name=='').length,0);assert.equal(f.payees.length,rt(f).payees.length)});
t('edit both sides: amount, date, notes, accounts',()=>{const f=base(),[o,i]=mk(f,1,2,50000);
 assert.ok(finXferSet(f,i.id,{amt:70000,date:'2026-11-09',notes:'x',from:2,to:1}));assert.equal(o.acct,2);assert.equal(i.acct,1);assert.equal(o.amt,-70000);assert.equal(i.amt,70000);assert.equal(o.date,'2026-11-09');assert.equal(i.date,'2026-11-09');assert.equal(o.notes,'x');assert.equal(i.notes,'x');
 assert.equal(finXferSet(f,i.id,{from:1,to:1}),false);assert.equal(finXferSet(f,i.id,{amt:0}),false);assert.equal(o.acct,2);assert.deepEqual(rt(f),f)});
t('delete removes both sides; unlink makes both normal',()=>{const f=base(),[o,i]=mk(f,1,3,5);assert.ok(finXferUnlink(f,o.id));assert.equal('xfer'in o,false);assert.equal('xfer'in i,false);assert.equal(f.tx.length,3);assert.deepEqual(rt(f),f);
 const g=base(),[p]=mk(g,1,2,5);assert.ok(finXferDel(g,p.id));assert.equal(g.tx.length,1);assert.equal(finXferDel(g,999),false)});
t('orphan repair: missing other, one-way, same account',()=>{
 const f=base();f.accounts[0].start=0;
 f.tx=[{id:1,acct:1,date:'2026-11-02',payee:'Shop',cat:null,amt:-100,notes:'',xfer:9},/* missing other */
  {id:2,acct:1,date:'2026-11-02',payee:'',cat:null,amt:-200,notes:'',xfer:3},{id:3,acct:2,date:'2026-11-02',payee:'',cat:null,amt:200,notes:''},/* one-way */
  {id:4,acct:1,date:'2026-11-02',payee:'',cat:null,amt:-300,notes:'',xfer:5},{id:5,acct:1,date:'2026-11-02',payee:'',cat:null,amt:300,notes:'',xfer:4},/* same account */
  {id:6,acct:1,date:'2026-11-02',payee:'',cat:null,amt:-400,notes:'',xfer:6}];/* self */
 f.ntx=7;const n=finNorm(f);for(const x of n.tx){assert.equal('xfer'in x,false);}
 assert.deepEqual(n.tx.map(x=>x.amt),[-100,-200,200,-300,300,-400]);assert.equal(n.tx[0].payee,'');assert.deepEqual(rt(n),n)});
t('mismatched amounts, dates, signs and notes are repaired from the lower id',()=>{
 const f=base();f.tx=[{id:1,acct:1,date:'2026-11-02',payee:'X',cat:null,amt:-500,notes:'a',xfer:2},{id:2,acct:2,date:'2026-11-09',payee:'Y',cat:null,amt:-900,notes:'b',xfer:1}];f.ntx=3;
 const n=finNorm(f);assert.deepEqual(n.tx.map(x=>[x.amt,x.date,x.notes,x.payee]),[[-500,'2026-11-02','a',''],[500,'2026-11-02','a','']]);assert.deepEqual(rt(n),n);
 const g=base();g.tx=[{id:1,acct:1,date:'2026-11-02',payee:'',cat:null,amt:700,notes:'',xfer:2},{id:2,acct:2,date:'2026-11-02',payee:'',cat:null,amt:700,notes:'',xfer:1}];const m=finNorm(g);assert.deepEqual(m.tx.map(x=>x.amt),[700,-700]);assert.deepEqual(rt(m),m);
 assert.equal(m.payees.filter(p=>p.name=='X'||p.name=='Y').length,0)});
t('categories forced by on/off rule in finNorm and make/set',()=>{
 const f=base(),g=cid(f,'Groceries'),inc=cid(f,'Income');
 let [o,i]=mk(f,1,2,10,{cat:g});assert.equal(o.cat,null);assert.equal(i.cat,null);
 [o,i]=mk(f,1,3,10,{cat:g});assert.equal(o.cat,g);assert.equal(i.cat,null);
 [o,i]=mk(f,3,1,10,{cat:inc});assert.equal(o.cat,null);assert.equal(i.cat,inc);
 [o,i]=mk(f,3,4,10,{cat:g});assert.equal(o.cat,null);assert.equal(i.cat,null);
 finXferSet(f,i.id,{from:1,to:2});assert.equal(o.cat,null);
 const h=rt(f);assert.deepEqual(h,f);for(const x of h.tx)if(x.xfer)x.cat=g;const n=finNorm(h);
 const k=n.tx.filter(x=>x.xfer&&x.cat!=null);assert.equal(k.length,2);assert.ok(k.some(x=>x.amt<0&&x.acct==1));assert.ok(k.some(x=>x.amt>0&&x.acct==1));assert.deepEqual(rt(n),n)});
t('finXferKind',()=>{const f=base();assert.equal(finXferKind(f,1,2).need,'');assert.equal(finXferKind(f,1,3).need,'out');assert.equal(finXferKind(f,3,1).need,'in');assert.equal(finXferKind(f,3,4).need,'')});
t('budget: on->on is ignored, not uncategorized',()=>{const f=base(),b0=B(f);mk(f,1,2,50000);const b=B(f);assert.equal(b.uncat,b0.uncat);assert.equal(b.toBudget,b0.toBudget);assert.equal(b.income,b0.income);assert.equal(b.activity,b0.activity);
 assert.equal(finTotals(f.accounts,f.tx).net,finTotals(base().accounts,base().tx).net)});
t('budget: on->on sides are skipped even if a category slipped in (not normalized)',()=>{const f=base(),g=cid(f,'Groceries'),[o,i]=mk(f,1,2,50000);o.cat=g;assert.equal(B(f).cats[g].activity,0);assert.equal(B(f).uncat,B(base()).uncat)});
t('budget: on->off is an expense (category or uncategorized)',()=>{const f=base(),g=cid(f,'Groceries'),b0=B(f);mk(f,1,3,50000,{cat:g});let b=B(f);assert.equal(b.cats[g].activity,-50000);assert.equal(b.uncat,b0.uncat);assert.equal(b.toBudget,b0.toBudget);
 mk(f,1,3,20000);b=B(f);assert.equal(b.uncat,b0.uncat-20000);assert.equal(b.toBudget,b0.toBudget-20000)});
t('budget: off->on is an inflow (income category, expense refund or uncategorized)',()=>{const f=base(),inc=cid(f,'Income'),g=cid(f,'Groceries'),b0=B(f);mk(f,3,1,30000,{cat:inc});let b=B(f);assert.equal(b.income,b0.income+30000);assert.equal(b.toBudget,b0.toBudget+30000);assert.equal(finIncomeByCat(f,'2026-11').cats[inc],30000);
 mk(f,3,1,1000,{cat:g});b=B(f);assert.equal(b.cats[g].activity,1000);mk(f,3,2,5000);b=B(f);assert.equal(b.uncat,b0.uncat+5000);assert.equal(b.toBudget,b0.toBudget+30000+1000+5000-1000)});
t('budget: off<->off is ignored',()=>{const f=base(),b0=B(f);mk(f,3,4,9999);const b=B(f);assert.deepEqual(b,b0)});
t('credit card payment moves the card balance toward 0',()=>{const f=base(),card=f.accounts[4],bank=f.accounts[0],b0=B(f);assert.equal(finCardDue(card,f.tx),300000);
 mk(f,1,5,120000);assert.equal(accountBalance(card,f.tx),-180000);assert.equal(finCardDue(card,f.tx),180000);assert.equal(accountBalance(bank,f.tx),1000000+200000-120000);
 assert.equal(finTotals(f.accounts,f.tx).net,finTotals(base().accounts,base().tx).net);assert.deepEqual(B(f),b0);mk(f,1,5,500000);assert.equal(finCardDue(card,f.tx),0)});
t('balances and running balance include transfers',()=>{const f=base();mk(f,1,3,40000);assert.equal(accountBalance(f.accounts[2],f.tx),540000);const r=finRunning(f.tx,f.accounts[0]);assert.equal([...r.values()].pop(),1000000+200000-40000)});
t('finFilter type in/out/xfer and search',()=>{const f=base();const[o,i]=mk(f,1,3,40000,{notes:'move'});const run=(x)=>finFilter(f.tx,Object.assign({acct:0,cat:'',type:'',q:'',range:''},x),f.cats,'COP','2026-11-14',f.accounts).map(y=>y.id).sort();
 assert.deepEqual(run({type:'in'}),[1]);assert.deepEqual(run({type:'out'}),[]);assert.deepEqual(run({type:'xfer'}),[o.id,i.id].sort());assert.deepEqual(run({q:'transfer'}),[o.id,i.id].sort());assert.deepEqual(run({q:'broker'}),[o.id]);assert.deepEqual(run({q:'bank'}),[i.id]);assert.deepEqual(run({acct:3}),[i.id])});
t('finTxTotals with and without byAcct',()=>{const f=base();mk(f,1,3,40000);assert.deepEqual(finTxTotals(f.tx),{in:200000,out:0,net:200000,xfer:40000});
 const one=f.tx.filter(x=>x.acct==1);assert.deepEqual(finTxTotals(one,1),{in:200000,out:-40000,net:160000});assert.deepEqual(finTxTotals(one,0),{in:200000,out:0,net:200000,xfer:40000});assert.deepEqual(finTxTotals([]),{in:0,out:0,net:0})});
t('account deletion converts the surviving side to a normal tx',()=>{const f=base(),[o,i]=mk(f,1,3,40000,{notes:'keep'});const g=cid(f,'Groceries');o.cat=g;finDelAcct(f,3);
 assert.equal(f.accounts.length,4);assert.equal(f.tx.length,2);const s=f.tx.find(x=>x.id==o.id);assert.equal('xfer'in s,false);assert.equal(s.amt,-40000);assert.equal(s.notes,'keep');assert.equal(s.payee,'');assert.equal(s.cat,g);assert.ok(!f.tx.some(x=>x.id==i.id));assert.deepEqual(rt(f),f);
 assert.equal(B(f).cats[g].activity,-40000)});
t('finNorm is idempotent with transfers and orphans',()=>{const f=base();mk(f,1,2,1);mk(f,1,3,2,{cat:cid(f,'Other')});mk(f,3,1,3);mk(f,5,1,4);f.tx.push({id:f.ntx++,acct:2,date:'2026-11-05',payee:'',cat:null,amt:-8,notes:'',xfer:77});const a=rt(f);assert.deepEqual(rt(a),a);assert.deepEqual(rt(rt(a)),a)});
console.log(passed+' tests passed');
