/* Dev-only test for the pure Finance > Accounts money/account logic.
   Functions are copied VERBATIM from index.html (kept in sync by hand).
   Run: node tools/finance-accounts.test.mjs */
import assert from 'node:assert/strict';
const FIN_TYPES=[['checking','Checking'],['savings','Savings'],['cash','Cash'],['credit','Credit card'],['investment','Investment'],['other','Other']];
function finCur(c){return c=='USD'?'USD':'COP'}
function parseAmount(s,cur){let t=String(s==null?'':s).trim().replace(/[\s$]|US|COP|USD/gi,'');if(!t)return null;let neg=false;if(t[0]=='-'){neg=true;t=t.slice(1)}if(!/^[\d.,]+$/.test(t)||!/\d/.test(t))return null;
const ls=Math.max(t.lastIndexOf('.'),t.lastIndexOf(',')),tail=ls>=0?t.slice(ls+1):'';let ip=t,dp='';if(ls>=0&&tail.length>=1&&tail.length<=2){ip=t.slice(0,ls);dp=tail}
ip=ip.replace(/[.,]/g,'');if(ip=='')ip='0';if(ip.length>13)return null;let i=+ip,c=dp?+(dp+'0').slice(0,2):0;if(finCur(cur)=='COP'){if(c>=50)i++;c=0}const n=i*100+c;if(!Number.isSafeInteger(n))return null;return neg&&n?-n:n}
function fmtMoney(n,cur){n=Math.round(+n);if(!Number.isFinite(n))n=0;const co=finCur(cur)=='COP',neg=n<0;let a=Math.abs(n);if(co)a=Math.round(a/100);const ip=co?a:Math.floor(a/100),g=String(ip).replace(/\B(?=(\d{3})+(?!\d))/g,co?'.':',');return(neg&&(co?a:n)?'-':'')+(co?'$ '+g:'US$ '+g+'.'+String(a%100).padStart(2,'0'))}
function accountBalance(a){const n=Math.round(+(a&&a.start));return Number.isFinite(n)?n:0}
function finTotals(list){let on=0,off=0,nOn=0,nOff=0;for(const a of list||[]){if(!a||a.closed)continue;const b=accountBalance(a);if(a.onBudget){on+=b;nOn++}else{off+=b;nOff++}}return{on,off,nOn,nOff,net:on+off}}
function finNorm(f){f=f&&typeof f=='object'?f:{};const ids=new Set(),out=[];let mx=0;for(const a of Array.isArray(f.accounts)?f.accounts:[]){if(!a||typeof a!='object')continue;let id=+a.id;if(!(id>0)||ids.has(id))id=0;out.push({id,name:String(a.name==null?'':a.name).slice(0,60),type:FIN_TYPES.some(t=>t[0]==a.type)?a.type:'other',onBudget:a.onBudget!==false&&a.onBudget!==0,start:accountBalance(a),startDate:/^\d{4}-\d{2}-\d{2}$/.test(a.startDate||'')?a.startDate:'',closed:!!a.closed,order:Number.isFinite(+a.order)?+a.order:out.length,notes:String(a.notes==null?'':a.notes).slice(0,500)});if(id){ids.add(id);mx=Math.max(mx,id)}}
let nid=Math.max(+f.nid||1,mx+1);for(const a of out)if(!a.id){a.id=nid++}return{cur:finCur(f.cur),accounts:out,nid}}
let passed=0;const t=(n,f)=>{f();passed++;console.log('ok  '+n)};
t('COP format',()=>{assert.equal(fmtMoney(125000000,'COP'),'$ 1.250.000');assert.equal(fmtMoney(0,'COP'),'$ 0');assert.equal(fmtMoney(99900,'COP'),'$ 999');assert.equal(fmtMoney(-125000000,'COP'),'-$ 1.250.000')});
t('USD format 2 decimals',()=>{assert.equal(fmtMoney(125050,'USD'),'US$ 1,250.50');assert.equal(fmtMoney(5,'USD'),'US$ 0.05');assert.equal(fmtMoney(-125000,'USD'),'-US$ 1,250.00');assert.equal(fmtMoney(0,'USD'),'US$ 0.00')});
t('format never prints NaN/undefined',()=>{for(const v of [NaN,undefined,null,'x',Infinity])for(const c of ['COP','USD',undefined]){const s=fmtMoney(v,c);assert.ok(!/NaN|undefined|Infinity/.test(s),s)}});
t('parse COP',()=>{assert.equal(parseAmount('1.250.000','COP'),125000000);assert.equal(parseAmount('1250000','COP'),125000000);assert.equal(parseAmount('$ 1.250.000','COP'),125000000);assert.equal(parseAmount('1,250,000','COP'),125000000);assert.equal(parseAmount('-50.000','COP'),-5000000);assert.equal(parseAmount('1.250.000,50','COP'),125000100)});
t('parse USD',()=>{assert.equal(parseAmount('1,250.50','USD'),125050);assert.equal(parseAmount('1250','USD'),125000);assert.equal(parseAmount('1.250,50','USD'),125050);assert.equal(parseAmount('12.5','USD'),1250);assert.equal(parseAmount('US$ 3.07','USD'),307);assert.equal(parseAmount('1,250','USD'),125000)});
t('parse rejects junk',()=>{for(const x of ['','  ','abc','1.2.x','--5','$',null,undefined])assert.equal(parseAmount(x,'COP'),null,String(x));assert.equal(parseAmount('9'.repeat(30),'USD'),null)});
t('parse round trip',()=>{for(const c of ['COP','USD'])for(const n of [0,100,12345600,-99900,125050*(c=='USD'?1:100)])assert.equal(parseAmount(fmtMoney(n,c).replace(/^(-?)(?:US)?\$ /,'$1'),c),n,c+n)});
t('balance is start, tolerant',()=>{assert.equal(accountBalance({start:500}),500);assert.equal(accountBalance({}),0);assert.equal(accountBalance(null),0);assert.equal(accountBalance({start:'x'}),0)});
t('totals: on/off split, closed excluded, credit is debt',()=>{const l=[{onBudget:true,start:100000},{onBudget:true,start:-30000,type:'credit'},{onBudget:false,start:500000},{onBudget:true,start:999,closed:true}];const T=finTotals(l);assert.deepEqual(T,{on:70000,off:500000,nOn:2,nOff:1,net:570000})});
t('totals empty',()=>assert.deepEqual(finTotals([]),{on:0,off:0,nOn:0,nOff:0,net:0}));
t('finNorm defaults and old saves',()=>{for(const x of [undefined,null,{},'x',[],{accounts:5}]){const f=finNorm(x);assert.equal(f.cur,'COP');assert.deepEqual(f.accounts,[]);assert.ok(f.nid>=1)}});
t('finNorm repairs accounts and ids',()=>{const f=finNorm({cur:'EUR',nid:1,accounts:[{id:3,name:'A',type:'bogus',start:'12',closed:1},null,{id:3,name:'B'},{name:'C',start:NaN,onBudget:false}]});assert.equal(f.cur,'COP');assert.equal(f.accounts.length,3);const ids=f.accounts.map(a=>a.id);assert.equal(new Set(ids).size,3);assert.ok(f.nid>Math.max(...ids));assert.equal(f.accounts[0].type,'other');assert.equal(f.accounts[0].start,12);assert.equal(f.accounts[0].closed,true);assert.equal(f.accounts[1].onBudget,true);assert.equal(f.accounts[2].onBudget,false);assert.equal(f.accounts[2].start,0)});
t('finNorm keeps USD',()=>assert.equal(finNorm({cur:'USD'}).cur,'USD'));
console.log(passed+' passed');
