/* Dev-only test for the pure Finance > Accounts money/account logic.
   Functions are extracted from index.html itself by tools/fin-extract.mjs (no copies).
   Run: node tools/finance-accounts.test.mjs */
import assert from 'node:assert/strict';
import {loadFin} from './fin-extract.mjs';
const {FIN_TYPES,finCur,parseAmount,fmtMoney,accountBalance,finTotals,finNorm}=loadFin();
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
t('balance = start + that account tx only',()=>{const tx=[{acct:1,amt:-2500},{acct:1,amt:10000},{acct:2,amt:999}];assert.equal(accountBalance({id:1,start:1000},tx),8500);assert.equal(accountBalance({id:3,start:7},tx),7);assert.equal(accountBalance({id:1,start:1000},[]),1000);assert.equal(accountBalance({id:1,start:1000},[null,{acct:1,amt:'x'}]),1000)});
t('totals include tx, closed excluded',()=>{const l=[{id:1,onBudget:true,start:100},{id:2,onBudget:false,start:50},{id:3,onBudget:true,start:9,closed:true}];const T=finTotals(l,[{acct:1,amt:-30},{acct:2,amt:5},{acct:3,amt:1000}]);assert.deepEqual(T,{on:70,off:55,nOn:1,nOff:1,net:125})});
console.log(passed+' passed');
