/* Dev-only test for Finance rules (pure logic), extracted from index.html by tools/fin-extract.mjs.
   Run: node tools/finance-rules.test.mjs */
import assert from 'node:assert/strict';
import {loadFin} from './fin-extract.mjs';
const F=loadFin('2026-11-14');
const {finNorm,finRuleMatch:match,finRulesApply:apply,finRulesNew,finRulesRun:run,finRulesHasPayee,finDelCat,finDelAcct,finSchedPost,finXferMake}=F;
let passed=0;const t=(n,f)=>{f();passed++;console.log('ok  '+n)};
const rt=f=>finNorm(JSON.parse(JSON.stringify(f)));
const AC=(id,name,onBudget,o)=>Object.assign({id,name,type:'checking',onBudget,start:0,startDate:'2026-01-01'},o);
const base=()=>finNorm({accounts:[AC(1,'Bank',true,{start:1000000}),AC(2,'Cash',true),AC(3,'Broker',false)],tx:[],ntx:1});
const cat=(f,n)=>f.cats.find(c=>c.name==n).id;
let rid=0;
const R=(o)=>Object.assign({id:++rid,stage:'default',conds:[],condsOp:'and',actions:[],enabled:true,order:rid},o);
const C=(field,op,value,x)=>Object.assign({field,op,value},x);
const A=(field,value,op)=>({field,op:op||'set',value});
const TX=(o)=>Object.assign({id:1,acct:1,date:'2026-11-10',payee:'',cat:null,amt:-1000000,notes:'',cleared:false},o);
const m1=(c,tx)=>match(R({conds:[c],actions:[A('notes','x')]}),TX(tx));

t('text ops, case and accent insensitive',()=>{
 assert.ok(m1(C('payee','is','EXITO'),{payee:'Éxito'}));assert.ok(!m1(C('payee','is','exito'),{payee:'Exito Envigado'}));
 assert.ok(m1(C('payee','isnot','exito'),{payee:'Rappi'}));assert.ok(!m1(C('payee','isnot','exito'),{payee:'ÉXITO'}));
 assert.ok(m1(C('payee','contains','xito'),{payee:'Almacenes Éxito'}));assert.ok(!m1(C('payee','contains','zzz'),{payee:'Éxito'}));
 assert.ok(m1(C('payee','ncontains','zzz'),{payee:'Éxito'}));assert.ok(!m1(C('payee','ncontains','XITO'),{payee:'Éxito'}));
 assert.ok(m1(C('payee','oneof',['rappi','Éxito']),{payee:'EXITO'}));assert.ok(!m1(C('payee','oneof',['rappi']),{payee:'Éxito'}));
 assert.ok(m1(C('payee','starts','alm'),{payee:'Almacenes'}));assert.ok(!m1(C('payee','starts','mac'),{payee:'Almacenes'}));
 assert.ok(m1(C('payee','ends','NES'),{payee:'Almacenes'}));assert.ok(!m1(C('payee','ends','alm'),{payee:'Almacenes'}));
 assert.ok(m1(C('notes','contains','cafe'),{notes:'Un CAFÉ con leche'}));
 assert.ok(m1(C('payee','is','a b'),{payee:'  A   B '}),'extra spaces ignored')});
t('amount ops use minor units and the sign option',()=>{
 assert.ok(m1(C('amount','is',1000000,{dir:'any'}),{amt:-1000000}));assert.ok(m1(C('amount','is',1000000,{dir:'any'}),{amt:1000000}));
 assert.ok(m1(C('amount','is',1000000,{dir:'out'}),{amt:-1000000}));assert.ok(!m1(C('amount','is',1000000,{dir:'in'}),{amt:-1000000}));
 assert.ok(m1(C('amount','gt',500000,{dir:'in'}),{amt:600000}));assert.ok(!m1(C('amount','gt',600000),{amt:-600000}));
 assert.ok(m1(C('amount','lt',700000),{amt:-600000}));assert.ok(!m1(C('amount','lt',600000),{amt:-600000}));
 assert.ok(m1(C('amount','between',[100,200]),{amt:-200}));assert.ok(m1(C('amount','between',[100,200]),{amt:100}));assert.ok(!m1(C('amount','between',[100,200]),{amt:-201}));
 assert.ok(m1(C('amount','approx',100000),{amt:-107500}),'+7.5% edge');assert.ok(m1(C('amount','approx',100000),{amt:-92500}),'-7.5% edge');
 assert.ok(!m1(C('amount','approx',100000),{amt:-107501}));assert.ok(!m1(C('amount','approx',100000),{amt:-92499}))});
t('account, category and date ops',()=>{const f=base(),c=cat(f,'Groceries'),d=cat(f,'Restaurants');
 assert.ok(m1(C('account','is',2),{acct:2}));assert.ok(!m1(C('account','is',2),{acct:1}));assert.ok(m1(C('account','isnot',2),{acct:1}));assert.ok(m1(C('account','oneof',[1,3]),{acct:3}));assert.ok(!m1(C('account','oneof',[1,3]),{acct:2}));
 assert.ok(m1(C('category','is',c),{cat:c}));assert.ok(!m1(C('category','is',c),{cat:null}));assert.ok(m1(C('category','isnot',c),{cat:null}));assert.ok(m1(C('category','oneof',[c,d]),{cat:d}));
 const sp={cat:null,subs:[{id:1,cat:c,amt:-1},{id:2,cat:d,amt:-2}]};assert.ok(m1(C('category','is',d),sp),'split matches through its lines');assert.ok(!m1(C('category','isnot',d),sp));
 assert.ok(m1(C('date','is','2026-11-10'),{}));assert.ok(m1(C('date','before','2026-11-11'),{}));assert.ok(!m1(C('date','before','2026-11-10'),{}));assert.ok(m1(C('date','after','2026-11-09'),{}))});
t('and / or',()=>{const cs=[C('payee','contains','exito'),C('amount','gt',500000)];
 const a=R({conds:cs,actions:[A('notes','x')]}),o=R({conds:cs,condsOp:'or',actions:[A('notes','x')]});
 assert.ok(match(a,TX({payee:'Exito',amt:-600000})));assert.ok(!match(a,TX({payee:'Exito',amt:-100})));assert.ok(!match(o,TX({payee:'Rappi',amt:-100})));assert.ok(match(o,TX({payee:'Rappi',amt:-600000})));assert.ok(match(o,TX({payee:'Exito',amt:-100})));
 assert.ok(!match(R({conds:[],actions:[A('notes','x')]}),TX()),'no conditions never match')});
const f0=base(),GR=cat(f0,'Groceries'),DI=cat(f0,'Restaurants'),ctx={mode:'fill',cats:f0.cats,accounts:f0.accounts};
t('multi action: category, payee rename and notes in one rule',()=>{
 const r=R({conds:[C('payee','contains','exito')],actions:[A('category',GR),A('payee','Éxito'),A('notes','weekly shop')]});
 const o=apply([r],TX({payee:'EXITO 123'}),ctx);assert.equal(o.tx.cat,GR);assert.equal(o.tx.payee,'Éxito');assert.equal(o.tx.notes,'weekly shop');assert.deepEqual(o.applied,[r.id])});
t('stage and order chaining, later rules see earlier changes',()=>{
 const post=R({stage:'post',conds:[C('payee','is','Éxito')],actions:[A('notes','after rename')]}),
  def=R({conds:[C('payee','contains','exito')],actions:[A('payee','Éxito')]}),pre=R({stage:'pre',conds:[C('payee','contains','exito')],actions:[A('category',DI)]}),
  def2=R({conds:[C('payee','is','Éxito')],actions:[A('category',GR)]});
 const o=apply([post,def2,def,pre],TX({payee:'exito 9'}),ctx);
 assert.deepEqual(o.applied,[pre.id,def.id,def2.id,post.id],'pre, default by order, post');assert.equal(o.tx.cat,GR,'later default overrides the pre category');assert.equal(o.tx.notes,'after rename');
 const x=R({order:5,conds:[C('payee','contains','a')],actions:[A('notes','first')]}),y=R({order:2,conds:[C('payee','contains','a')],actions:[A('notes','second')]});
 assert.equal(apply([x,y],TX({payee:'a'}),ctx).tx.notes,'first','lower order runs first, so the higher order has the last word');
 const off=R({enabled:false,conds:[C('payee','contains','a')],actions:[A('notes','nope')]});assert.deepEqual(apply([off],TX({payee:'a'}),ctx).applied,[])});
t('idempotent, never mutates the input',()=>{
 const rs=[R({conds:[C('payee','contains','exito')],actions:[A('category',GR),A('notes','tag','append'),A('notes','>>','prepend')]})];
 for(const mode of['fill','all']){const c=Object.assign({},ctx,{mode}),tx=TX({payee:'exito',notes:mode=='all'?'hi':''}),snap=JSON.stringify(tx),a=apply(rs,tx,c),b=apply(rs,a.tx,c);assert.equal(JSON.stringify(tx),snap);assert.deepEqual(b.tx,a.tx);assert.deepEqual(b.applied,[])}
 assert.equal(apply(rs,TX({payee:'exito',notes:'hi'}),Object.assign({},ctx,{mode:'all'})).tx.notes,'>> hi tag')});
t('fill mode only fills empty fields; payee rename always applies',()=>{
 const r=R({conds:[C('payee','contains','exito')],actions:[A('category',GR),A('notes','auto'),A('payee','Éxito')]});
 const a=apply([r],TX({payee:'exito',cat:DI,notes:'mine'}),ctx);assert.equal(a.tx.cat,DI);assert.equal(a.tx.notes,'mine');assert.equal(a.tx.payee,'Éxito');
 const b=apply([r],TX({payee:'exito',cat:DI,notes:'mine'}),Object.assign({},ctx,{mode:'all'}));assert.equal(b.tx.cat,GR);assert.equal(b.tx.notes,'auto');
 const pp=R({conds:[C('payee','is','Éxito')],actions:[A('category',DI)]});
 assert.equal(apply([r,pp],TX({payee:'exito'}),ctx).tx.cat,DI,'chained rules may override a value an earlier rule filled')});
t('account action only when allowed; unknown targets ignored',()=>{
 const r=R({conds:[C('payee','is','x')],actions:[A('account',2)]});assert.equal(apply([r],TX({payee:'x'}),ctx).tx.acct,1);assert.equal(apply([r],TX({payee:'x'}),Object.assign({},ctx,{acct:true})).tx.acct,2);
 assert.equal(apply([R({conds:[C('payee','is','x')],actions:[A('category',999)]})],TX({payee:'x'}),ctx).tx.cat,null)});
t('transfer safety',()=>{const f=base();const [o,i]=finXferMake(f,{from:1,to:2,date:'2026-11-10',amt:5000});
 const r=R({conds:[C('amount','gt',1)],actions:[A('category',GR),A('payee','Hacked'),A('notes','x')]});
 for(const x of[o,i]){assert.ok(!match(r,x));const a=apply([r],x,{mode:'all',cats:f.cats,accounts:f.accounts});assert.deepEqual(a.tx,x);assert.deepEqual(a.applied,[])}
 f.rules=[r];const snap=JSON.stringify(f.tx);const out=run(f,f.rules,false);assert.deepEqual(out,{matches:0,changes:0,over:0});assert.equal(JSON.stringify(f.tx),snap);
 const g=rt(Object.assign(base(),{tx:f.tx.concat([TX({id:50,payee:'z'})]),ntx:60,rules:f.rules}));const mid=g.tx.filter(x=>x.xfer);assert.equal(mid.length,2);assert.ok(mid.every(x=>x.cat==null&&x.payee==''))});
t('split safety: category never set on a split parent, lines untouched, other actions still apply',()=>{
 const sp=TX({payee:'exito',cat:null,subs:[{id:1,cat:DI,amt:-400000,notes:''},{id:2,cat:GR,amt:-600000,notes:''}]}),r=R({conds:[C('payee','contains','exito')],actions:[A('category',GR),A('notes','split note')]});
 for(const mode of['fill','all']){const a=apply([r],sp,{mode,cats:f0.cats,accounts:f0.accounts});assert.equal(a.tx.cat,null);assert.deepEqual(a.tx.subs,sp.subs);assert.equal(a.tx.notes,'split note')}
 const f=base();f.tx=[Object.assign({},sp,{id:1})];f.rules=[r];run(f,f.rules,false);assert.equal(f.tx[0].cat,null);assert.equal(f.tx[0].subs.length,2);const n=rt(f);assert.equal(n.tx[0].cat,null);assert.equal(n.tx[0].subs.length,2);assert.ok(!n.tx[0].xfer)});
t('apply to existing: preview counts, writes only category/payee/notes, balances stay',()=>{
 const f=base();f.tx=[TX({id:1,payee:'exito 1',amt:-100}),TX({id:2,payee:'Exito 2',cat:DI,amt:-200}),TX({id:3,payee:'Rappi',amt:-300}),TX({id:4,payee:'exito 4',cat:GR,amt:-400,notes:''})];f.ntx=5;f.npay=1;
 const rs=[R({conds:[C('payee','contains','exito')],actions:[A('category',GR),A('payee','Éxito')]})],bal=()=>f.accounts.map(a=>F.accountBalance(a,f.tx));const b0=bal();
 assert.deepEqual(run(f,rs,true),{matches:3,changes:3,over:1});assert.equal(f.tx[0].cat,null,'dry run changes nothing');
 assert.deepEqual(run(f,rs,false),{matches:3,changes:3,over:1});assert.deepEqual(f.tx.map(x=>x.cat),[GR,GR,null,GR]);assert.deepEqual(f.tx.map(x=>x.payee),['Éxito','Éxito','Rappi','Éxito']);assert.deepEqual(bal(),b0);
 assert.ok(f.payees.some(p=>p.name=='Éxito'));assert.deepEqual(run(f,rs,false),{matches:3,changes:0,over:0},'second run changes nothing');assert.deepEqual(f.tx.map(x=>x.amt),[-100,-200,-300,-400])});
t('finRulesNew fills a new tx in place and registers a renamed payee',()=>{
 const f=base();f.rules=[R({conds:[C('payee','contains','exito')],actions:[A('category',GR),A('payee','Éxito')]})];f.npay=1;
 const x=TX({payee:'exito'});assert.deepEqual(finRulesNew(f,x),[f.rules[0].id]);assert.equal(x.cat,GR);assert.equal(x.payee,'Éxito');assert.ok(f.payees.some(p=>p.name=='Éxito'));
 const y=TX({payee:'exito',cat:DI});finRulesNew(f,y);assert.equal(y.cat,DI,'explicit category wins');assert.equal(y.payee,'Éxito');
 assert.deepEqual(finRulesNew(f,TX({payee:'other'})),[])});
t('finRulesHasPayee',()=>{const rs=[R({conds:[C('payee','contains','exito')],actions:[A('notes','x')]}),R({enabled:false,conds:[C('payee','is','Rappi')],actions:[A('notes','x')]}),R({conds:[C('notes','contains','zzz')],actions:[A('notes','x')]})];
 assert.ok(finRulesHasPayee(rs,'Éxito Envigado'));assert.ok(finRulesHasPayee(rs,'rappi'));assert.ok(!finRulesHasPayee(rs,'Zara'));assert.ok(!finRulesHasPayee([],'Zara'))});
t('finNorm repairs rules and is idempotent',()=>{
 const f=base(),raw=[
  {id:7,stage:'pre',conds:[{field:'payee',op:'contains',value:'  exito '},{field:'bogus',op:'is',value:'x'},{field:'amount',op:'gt',value:'abc'},{field:'payee',op:'oneof',value:'a, b ,A'}],condsOp:'or',actions:[{field:'category',op:'set',value:GR},{field:'category',op:'set',value:999},{field:'notes',op:'append',value:'t'},{field:'payee',op:'prepend',value:'P'},{field:'zzz',value:1}],enabled:true,order:3},
  {id:7,stage:'weird',conds:[{field:'category',op:'is',value:999}],actions:[{field:'notes',op:'set',value:'n'}]},
  {conds:[],actions:[{field:'notes',op:'set',value:'n'}]},{conds:[{field:'payee',op:'is',value:'a'}],actions:[]},
  {conds:[{field:'account',op:'oneof',value:[1,77]}],actions:[{field:'account',op:'set',value:3}]},{conds:[{field:'amount',op:'between',value:[900,100]}],actions:[{field:'notes',op:'set',value:'n'}]},null,'x',
  {conds:[{field:'payee',op:'is',value:'a'}],actions:[{field:'notes',op:'set',value:'n'}],enabled:false}];
 const n=rt(Object.assign(f,{rules:raw})),r=n.rules;assert.equal(r.length,7);
 assert.deepEqual(r.map(x=>x.order),[0,1,2,3,4,5,6]);assert.equal(new Set(r.map(x=>x.id)).size,7);assert.ok(n.nrule>Math.max(...r.map(x=>x.id)));
 const a=r.find(x=>x.stage=='pre');assert.equal(a.condsOp,'or');assert.deepEqual(a.conds,[{field:'payee',op:'contains',value:'exito'},{field:'payee',op:'oneof',value:['a','b']}]);assert.deepEqual(a.actions.map(x=>x.field+':'+x.op),['category:set','notes:append','payee:set']);assert.ok(a.enabled);
 assert.equal(r.find(x=>x.conds.some(c=>c.value==999)).enabled,false,'missing category in a cond disables');assert.equal(r.find(x=>x.conds.some(c=>Array.isArray(c.value)&&c.value.includes(77))).enabled,false);
 assert.equal(r.find(x=>x.stage=='default'&&x.conds.some(c=>c.value==999)).stage,'default');assert.ok(r.filter(x=>!x.conds.length||!x.actions.length).every(x=>!x.enabled));
 assert.deepEqual(r.find(x=>x.conds.some(c=>c.op=='between')).conds[0].value,[100,900]);assert.equal(r.filter(x=>x.enabled).length,2);
 assert.deepEqual(rt(n).rules,n.rules);assert.equal(rt(n).nrule,n.nrule);
 assert.deepEqual(finNorm(undefined).rules,[]);assert.equal(finNorm({}).nrule,1)});
t('category delete / merge remaps rules',()=>{
 const f=base(),rs=[R({conds:[C('category','is',DI)],actions:[A('category',DI)]}),R({conds:[C('category','oneof',[DI,GR])],actions:[A('category',DI),A('notes','n')]}),R({conds:[C('payee','is','x')],actions:[A('category',DI)]})];
 let g=rt(Object.assign(f,{rules:rs.map(x=>JSON.parse(JSON.stringify(x)))}));const h=JSON.parse(JSON.stringify(g));
 assert.ok(finDelCat(g,DI,GR));assert.deepEqual(g.rules[0].conds[0].value,GR);assert.deepEqual(g.rules[0].actions[0].value,GR);assert.ok(g.rules[0].enabled);assert.deepEqual(g.rules[1].conds[0].value,[GR]);assert.deepEqual(g.rules[1].actions.map(a=>a.value),[GR,'n']);assert.deepEqual(rt(g).rules,g.rules,'stays valid after reload');
 assert.ok(finDelCat(h,DI,null));assert.equal(h.rules[0].enabled,false,'cond on a deleted category disables');assert.equal(h.rules[0].actions.length,0);assert.equal(h.rules[1].enabled,false);assert.deepEqual(h.rules[1].actions.map(a=>a.field),['notes']);assert.equal(h.rules[2].enabled,false,'no actions left disables');assert.deepEqual(rt(h).rules.map(x=>x.enabled),h.rules.map(x=>x.enabled))});
t('account delete cleans rule refs',()=>{
 const f=base();f.rules=[R({conds:[C('account','is',2)],actions:[A('notes','n')]}),R({conds:[C('payee','is','x')],actions:[A('account',2),A('notes','n')]}),R({conds:[C('account','oneof',[1,2])],actions:[A('notes','n')]})];f.rules=rt(f).rules;
 const g=rt(Object.assign(base(),{rules:f.rules}));finDelAcct(g,2);assert.equal(g.rules[0].enabled,false);assert.deepEqual(g.rules[1].actions.map(a=>a.field),['notes']);assert.ok(g.rules[1].enabled);assert.equal(g.rules[2].enabled,false);assert.deepEqual(rt(g).rules.map(x=>x.enabled),[false,true,false])});
t('schedule auto-post runs rules (fill mode)',()=>{
 const f=base();f.rules=[R({conds:[C('payee','contains','landlord')],actions:[A('category',GR),A('payee','Landlord SA'),A('notes','rent')]})];
 const s={id:1,acct:1,payee:'landlord',cat:null,amt:-500000,notes:'',start:'2026-11-05',rule:{freq:'month',n:1,dom:5},end:{type:'never'}};f.sched=[s];f.nsch=2;
 const x=finSchedPost(f,s,'2026-11-05');assert.equal(x.cat,GR);assert.equal(x.payee,'Landlord SA');assert.equal(x.notes,'rent');assert.ok(f.payees.some(p=>p.name=='Landlord SA'));assert.equal(x.sched,1);
 const s2=Object.assign({},s,{id:2,cat:DI,notes:'mine'});f.sched.push(s2);const y=finSchedPost(f,s2,'2026-11-05');assert.equal(y.cat,DI,'schedule category wins');assert.equal(y.notes,'mine');
 const g=base();g.sched=[Object.assign({},s)];assert.equal(finSchedPost(g,g.sched[0],'2026-11-05').cat,null,'no rules, no change')});
t('run counts changes that replace a category or notes already set',()=>{const f=base(),GR=cat(f,'Groceries'),DI=cat(f,'Restaurants');
 f.tx=[TX({id:1,payee:'a',cat:DI}),TX({id:2,payee:'a',notes:'mine'}),TX({id:3,payee:'a'}),TX({id:4,payee:'a',cat:GR})];
 const rs=[R({conds:[C('payee','is','a')],actions:[A('category',GR),A('notes','x')]})];
 assert.deepEqual(run(f,rs,true),{matches:4,changes:4,over:2});assert.equal(f.tx[0].cat,DI,'dry run keeps data')});
console.log(passed+' tests passed');
