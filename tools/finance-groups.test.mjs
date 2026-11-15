/* Dev-only test for Finance category groups (pure logic), extracted from index.html by tools/fin-extract.mjs.
   Run: node tools/finance-groups.test.mjs */
import assert from 'node:assert/strict';
import {loadFin} from './fin-extract.mjs';
const F=loadFin('2026-11-14');
const {finNorm,finBudgetCalc:calc,finGSort,finGCats,finGTotals,finIncomeByCat,finCatGroups,finOrderMove,finAddGroup,finAddCat,finCatMove,finDelCat,finDelGroup}=F;
let passed=0;const t=(n,f)=>{f();passed++;console.log('ok  '+n)};
const A=(o)=>Object.assign({id:1,name:'Main',type:'checking',onBudget:true,start:0,startDate:'2026-01-01'},o);
const X=(id,date,cat,amt,acct=1)=>({id,acct,date,cat,amt});
const rt=f=>finNorm(JSON.parse(JSON.stringify(f)));
const gname=(f,c)=>f.groups.find(g=>g.id==c.group).name;
const byName=(f,n)=>f.cats.find(c=>c.name==n);
const flat=()=>({accounts:[A()],cats:[{id:1,name:'Groceries',group:null,income:false},{id:2,name:'Rent',group:null,income:false},{id:3,name:'Pay',group:null,income:true},{id:4,name:'Health',group:null,income:false},{id:5,name:'Odd',group:'nope',income:false}],ncat:6,tx:[],budget:{}});

t('fresh state gets default groups and categories mapped',()=>{
 const f=finNorm({});assert.deepEqual(f.groups.map(g=>g.name),['Housing & Bills','Food','Transport','Personal','Other','Income']);
 const m={Housing:'Housing & Bills',Utilities:'Housing & Bills',Groceries:'Food',Restaurants:'Food',Transport:'Transport',Health:'Personal',Clothing:'Personal',Education:'Personal',Entertainment:'Personal',Other:'Other',Income:'Income'};
 for(const c of f.cats)assert.equal(gname(f,c),m[c.name],c.name);
 assert.equal(f.groups.filter(g=>g.income).length,1);assert.equal(f.groups[5].income,true);assert.equal(f.ngrp,7)});
t('flat save migrates by name; unknown or invalid group goes to Other; income cats to the income group',()=>{
 const f=finNorm(flat());assert.equal(gname(f,byName(f,'Groceries')),'Food');assert.equal(gname(f,byName(f,'Health')),'Personal');
 assert.equal(gname(f,byName(f,'Rent')),'Other');assert.equal(gname(f,byName(f,'Odd')),'Other');assert.equal(gname(f,byName(f,'Pay')),'Income');
 assert.ok(f.groups.find(g=>g.id==byName(f,'Pay').group).income)});
t('finNorm is idempotent',()=>{const a=finNorm(flat()),b=finNorm(JSON.parse(JSON.stringify(a)));assert.deepEqual(b,a);assert.deepEqual(finNorm(JSON.parse(JSON.stringify(b))),a)});
t('an invalid group id on an already grouped save falls back to Other',()=>{
 const a=finNorm({});const g=JSON.parse(JSON.stringify(a));g.cats[0].group=999;const b=finNorm(g);assert.equal(gname(b,b.cats[0]),'Other')});
t('Other group is recreated as fallback when missing; at most one income group',()=>{
 const a=finNorm({});const g=JSON.parse(JSON.stringify(a));g.groups=g.groups.filter(x=>x.name!='Other');g.cats.find(c=>c.name=='Other').group=999;
 const b=finNorm(g);assert.equal(gname(b,byName(b,'Other')),'Other');assert.equal(b.groups.filter(x=>x.name=='Other').length,1);assert.deepEqual(finNorm(JSON.parse(JSON.stringify(b))),b);
 const h=JSON.parse(JSON.stringify(a));h.groups.forEach(x=>x.income=true);const c=finNorm(h);assert.equal(c.groups.filter(x=>x.income).length,1);assert.ok(c.groups[c.groups.length-1].income);
 const k=finNorm({cats:[{id:1,name:'A',income:false}],groups:[]});assert.equal(k.groups.length,6)});
t('income categories cannot live in an expense group and vice versa',()=>{
 const a=finNorm({});const g=JSON.parse(JSON.stringify(a));g.cats.find(c=>c.name=='Income').group=2;g.cats.find(c=>c.name=='Housing').group=6;
 const b=finNorm(g);assert.equal(gname(b,byName(b,'Income')),'Income');assert.equal(gname(b,byName(b,'Housing')),'Other')});
t('hidden, collapsed and order survive; group and cat order are renumbered',()=>{
 const a=finNorm({});a.groups[1].collapsed=true;a.groups[2].hidden=true;byName(a,'Utilities').hidden=true;const b=finNorm(JSON.parse(JSON.stringify(a)));
 assert.equal(b.groups[1].collapsed,true);assert.equal(b.groups[2].hidden,true);assert.equal(byName(b,'Utilities').hidden,true);assert.deepEqual(b.groups.map(g=>g.order),[0,1,2,3,4,5])});
t('ordering: groups by order with income last; cats by order within group',()=>{
 const f=finNorm({});assert.deepEqual(finGSort(f).map(g=>g.name),['Housing & Bills','Food','Transport','Personal','Other','Income']);
 assert.ok(finOrderMove(f,'grp',f.groups[1].id,-1));assert.deepEqual(finGSort(f).map(g=>g.name).slice(0,2),['Food','Housing & Bills']);
 assert.equal(finOrderMove(f,'grp',finGSort(f)[0].id,-1),false);const inc=f.groups.find(g=>g.income);assert.equal(finOrderMove(f,'grp',inc.id,-1),false);
 const g=f.groups.find(x=>x.name=='Housing & Bills').id;assert.deepEqual(finGCats(f,g).map(c=>c.name),['Housing','Utilities']);
 assert.ok(finOrderMove(f,'cat',byName(f,'Utilities').id,-1));assert.deepEqual(finGCats(f,g).map(c=>c.name),['Utilities','Housing']);
 assert.equal(finOrderMove(f,'cat',byName(f,'Utilities').id,-1),false);assert.equal(finOrderMove(f,'cat',9999,1),false);
 assert.deepEqual(finNorm(JSON.parse(JSON.stringify(f))).groups.map(x=>x.name),finGSort(f).map(x=>x.name))});
t('add group and category; duplicates and empty names rejected; income group gives income cats',()=>{
 const f=finNorm({});const g=finAddGroup(f,' Fun ');assert.equal(g.name,'Fun');assert.equal(f.ngrp,8);assert.equal(finAddGroup(f,'fun'),null);assert.equal(finAddGroup(f,'  '),null);
 assert.deepEqual(finGSort(f).map(x=>x.name).slice(-2),['Fun','Income'].slice(0,1).concat('Income')); // before Income
 const c=finAddCat(f,'Games',g.id);assert.equal(c.group,g.id);assert.equal(c.income,false);assert.equal(finAddCat(f,'games',g.id),null);assert.equal(finAddCat(f,'Zed',999),null);
 const inc=f.groups.find(x=>x.income),ic=finAddCat(f,'Bonus',inc.id);assert.equal(ic.income,true);assert.deepEqual(rt(rt(f)),rt(f));assert.deepEqual(rt(f).cats,f.cats)});
t('move category between groups of the same kind only',()=>{
 const f=finNorm({});const food=f.groups.find(g=>g.name=='Food').id,inc=f.groups.find(g=>g.income).id;
 assert.ok(finCatMove(f,byName(f,'Housing').id,food));assert.equal(finGCats(f,food).slice(-1)[0].name,'Housing');assert.equal(finCatMove(f,byName(f,'Transport').id,inc),false);assert.equal(finCatMove(f,byName(f,'Income').id,food),false)});
t('group subtotals include hidden categories; pickers hide them unless kept',()=>{
 const f=finNorm({accounts:[A({start:100000,startDate:'2026-03-01'})]});const gr=byName(f,'Groceries'),re=byName(f,'Restaurants');
 f.tx=[X(1,'2026-03-02',gr.id,-300),X(2,'2026-03-03',re.id,-200)];f.budget={'2026-03':{[gr.id]:1000,[re.id]:500}};re.hidden=true;
 const C=calc(f,'2026-03'),T=finGTotals(f,C,gr.group);assert.deepEqual(T,{budgeted:1500,spent:500,balance:1000});
 assert.equal(T.balance,C.cats[gr.id].balance+C.cats[re.id].balance);
 const names=k=>finCatGroups(f,k).find(x=>x.g.name=='Food').cats.map(c=>c.name);assert.deepEqual(names(),['Groceries']);assert.deepEqual(names(re.id),['Groceries','Restaurants']);assert.deepEqual(names(new Set([re.id])),['Groceries','Restaurants']);
 f.groups.find(g=>g.name=='Food').hidden=true;assert.equal(finCatGroups(f).some(x=>x.g.name=='Food'),false);assert.ok(finCatGroups(f,gr.id).some(x=>x.g.name=='Food'));
 assert.deepEqual(finGTotals(f,C,gr.group),T);assert.deepEqual(finGTotals(f,C,9999),{budgeted:0,spent:0,balance:0});assert.deepEqual(finGTotals({},{},1),{budgeted:0,spent:0,balance:0});
 assert.equal(finCatGroups(f).slice(-1)[0].g.income,true)});
t('subtotals sum to the month totals of finBudgetCalc',()=>{
 const f=finNorm({accounts:[A({start:100000,startDate:'2026-03-01'})]});f.tx=[X(1,'2026-03-02',1,-300),X(2,'2026-03-03',7,-200),X(3,'2026-03-05',11,5000)];f.budget={'2026-03':{1:1000,7:50}};
 const C=calc(f,'2026-03');let b=0,s=0,l=0;for(const g of f.groups.filter(x=>!x.income)){const T=finGTotals(f,C,g.id);b+=T.budgeted;s+=T.spent;l+=T.balance}
 assert.equal(b,C.budgeted);assert.equal(s,-C.activity);assert.equal(l,C.balance)});
t('income per category for the month, on-budget accounts only; remainder is starting balances',()=>{
 const f=finNorm({accounts:[A({start:1000,startDate:'2026-03-01'}),A({id:2,onBudget:false})]});const pay=byName(f,'Income');f.tx=[X(1,'2026-03-02',pay.id,5000),X(2,'2026-03-09',pay.id,-100),X(3,'2026-04-01',pay.id,70),X(4,'2026-03-02',pay.id,999,2)];
 const I=finIncomeByCat(f,'2026-03');assert.equal(I.cats[pay.id],4900);assert.equal(I.total,4900);assert.equal(calc(f,'2026-03').income-I.total,1000);assert.equal(finIncomeByCat(f,'2026-04').total,70);assert.deepEqual(finIncomeByCat({}, '2026-03'),{cats:{},total:0})});
const delFix=()=>{const f=finNorm({accounts:[A({start:100000,startDate:'2026-03-01'})]});const gr=byName(f,'Groceries'),re=byName(f,'Restaurants');
 f.tx=[X(1,'2026-03-02',gr.id,-300),X(2,'2026-03-03',re.id,-200),X(3,'2026-04-02',gr.id,-100)];f.budget={'2026-03':{[gr.id]:1000,[re.id]:500},'2026-04':{[gr.id]:400}};return{f,gr,re}};
t('delete category, uncategorize: tx kept, budget dropped, To budget consistent',()=>{
 const {f,gr,re}=delFix();const before=calc(f,'2026-03');assert.equal(before.toBudget,100000-1500);
 assert.ok(finDelCat(f,gr.id,null));assert.equal(f.cats.some(c=>c.id==gr.id),false);assert.deepEqual(f.tx.map(x=>x.cat),[null,re.id,null]);assert.equal(f.budget['2026-04'],undefined);assert.deepEqual(f.budget['2026-03'],{[re.id]:500});
 const C=calc(f,'2026-03');assert.equal(C.cats[gr.id],undefined);assert.equal(C.uncat,-300);assert.equal(C.toBudget,100000-500-300);
 const g=finNorm(JSON.parse(JSON.stringify(f)));assert.deepEqual(g.budget,f.budget);assert.deepEqual(g.tx.map(x=>x.cat),f.tx.map(x=>x.cat));assert.deepEqual(calc(g,'2026-04'),calc(f,'2026-04'))});
t('delete category, transfer: tx move to the target, budget of the deleted one dropped',()=>{
 const {f,gr,re}=delFix();assert.ok(finDelCat(f,gr.id,re.id));assert.deepEqual(f.tx.map(x=>x.cat),[re.id,re.id,re.id]);
 const C=calc(f,'2026-03');assert.equal(C.cats[re.id].activity,-500);assert.equal(C.cats[re.id].budgeted,500);assert.equal(C.toBudget,100000-500);assert.equal(C.uncat,0)});
t('delete category: invalid, same-id or other-kind target means uncategorize; unknown id is a no-op',()=>{
 for(const to of [999,'x',undefined]){const {f,gr}=delFix();assert.ok(finDelCat(f,gr.id,to));assert.equal(f.tx[0].cat,null)}
 {const {f,gr}=delFix();assert.ok(finDelCat(f,gr.id,gr.id));assert.equal(f.tx[0].cat,null)}
 {const {f,gr}=delFix();assert.ok(finDelCat(f,gr.id,byName(f,'Income').id));assert.equal(f.tx[0].cat,null)}
 const {f}=delFix();assert.equal(finDelCat(f,999,null),false);assert.equal(f.cats.length,11)});
t('delete income category: its tx become uncategorized',()=>{
 const f=finNorm({accounts:[A()]});const inc=byName(f,'Income');f.tx=[X(1,'2026-03-02',inc.id,5000)];assert.equal(calc(f,'2026-03').income,5000);assert.ok(finDelCat(f,inc.id,null));assert.equal(f.tx[0].cat,null);assert.equal(calc(f,'2026-03').uncat,5000)});
t('delete group, move categories',()=>{
 const {f,gr}=delFix();const food=gr.group,oth=f.groups.find(g=>g.name=='Other').id;assert.ok(finDelGroup(f,food,'move',oth));
 assert.equal(f.groups.some(g=>g.id==food),false);assert.equal(gr.group,oth);assert.deepEqual(finGCats(f,oth).map(c=>c.name).slice(-2),['Groceries','Restaurants']);assert.equal(f.tx.length,3);assert.equal(f.tx[0].cat,gr.id);assert.equal(f.budget['2026-04'][gr.id],400);
 assert.deepEqual(rt(rt(f)),rt(f));assert.deepEqual(rt(f).cats,f.cats);assert.deepEqual(rt(f).groups.map(g=>g.name),finGSort(f).map(g=>g.name))});
t('delete group, delete categories: tx uncategorized, budget dropped, group gone',()=>{
 const {f,gr,re}=delFix();assert.ok(finDelGroup(f,gr.group,'del'));assert.equal(f.cats.some(c=>c.id==gr.id||c.id==re.id),false);assert.deepEqual(f.tx.map(x=>x.cat),[null,null,null]);assert.deepEqual(f.budget,{});
 assert.equal(calc(f,'2026-03').toBudget,100000-500);assert.equal(calc(f,'2026-03').uncat,-500)});
t('delete group: income group, unknown group, bad mode or bad target are refused and change nothing',()=>{
 const {f,gr}=delFix(),snap=JSON.stringify(f);const inc=f.groups.find(g=>g.income).id;
 assert.equal(finDelGroup(f,inc,'del'),false);assert.equal(finDelGroup(f,999,'del'),false);assert.equal(finDelGroup(f,gr.group,'move',gr.group),false);assert.equal(finDelGroup(f,gr.group,'move',inc),false);assert.equal(finDelGroup(f,gr.group,'x'),false);assert.equal(JSON.stringify(f),snap)});
t('deleting every expense group still loads: categories fall back to a recreated Other group',()=>{
 const f=finNorm({});for(const g of f.groups.filter(x=>!x.income))finDelGroup(f,g.id,'del');assert.equal(f.cats.length,1);const b=finNorm(JSON.parse(JSON.stringify(f)));assert.equal(b.groups.length,1);assert.ok(b.groups[0].income)});
console.log(passed+' passed');
