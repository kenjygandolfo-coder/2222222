/* Dev-only test for the Finance CSV import (pure logic), extracted from index.html by tools/fin-extract.mjs.
   Run: node tools/finance-import.test.mjs */
import assert from 'node:assert/strict';
import {loadFin} from './fin-extract.mjs';
const F=loadFin('2026-11-14');
const {finNorm,finCsvDecode,finCsvParse,finCsvDelim,finCsvAuto,finCsvHead,finCsvGuess,finCsvAmt,finCsvDec,finCsvDate,finCsvDateFmt,finCsvRows,finCsvHash,finCsvReview,finCsvCommit,finCsvMapNorm,finCsvFits,finClr,finRulesNew}=F;
let passed=0;const t=(n,f)=>{f();passed++;console.log('ok  '+n)};
const rt=f=>finNorm(JSON.parse(JSON.stringify(f)));
const AC=(id,name,o)=>Object.assign({id,name,type:'checking',onBudget:true,start:0,startDate:'2026-01-01'},o);
const TX=(id,acct,date,amt,o)=>Object.assign({id,acct,date,payee:'',cat:null,amt,notes:'',cleared:false},o);
const base=(tx,o)=>finNorm(Object.assign({accounts:[AC(1,'Bank'),AC(2,'Other')],tx:tx||[],ntx:100},o));
const enc=s=>new TextEncoder().encode(s);
const run=(f,csv,m,acct)=>{const rows=finCsvParse(csv,finCsvDelim(csv)),d=m.hdr?rows.slice(1):rows;return finCsvReview(f,acct||1,finCsvRows(d,m))};
const M=(o)=>Object.assign({date:0,payee:1,notes:-1,amt:2,out:-1,in:-1,inv:false,hdr:true,fmt:'auto'},o);

t('csv parser: quotes, escaped quotes, embedded delimiters and newlines, CRLF, BOM, blank tail',()=>{
 assert.deepEqual(finCsvParse('\ufeffa,"b,c","d ""e"" f"\r\n1,"x\ny",3\r\n\r\n',','),[['a','b,c','d "e" f'],['1','x\ny','3']]);
 assert.deepEqual(finCsvParse('a;b\n1;2',';'),[['a','b'],['1','2']]);
 assert.deepEqual(finCsvParse('a,b',','),[['a','b']]);assert.deepEqual(finCsvParse('',','),[]);
 assert.deepEqual(finCsvParse('a, "b" ,c\n',','),[['a','b','c']])});
t('delimiter detection among , ; tab |',()=>{
 assert.equal(finCsvDelim('Fecha;Desc;Valor\n01/02/2026;Pago;-1.250,50\n02/02/2026;Cafe;-4.500,00\n'),';');
 assert.equal(finCsvDelim('Date,Desc,Amount\n2026-02-01,Pay,"-1,250.50"\n2026-02-02,Cafe,-4.50\n'),',');
 assert.equal(finCsvDelim('Date\tDesc\tAmount\n2026-02-01\tPay\t-12\n2026-02-02\tCafe\t-4\n'),'\t');
 assert.equal(finCsvDelim('a|b|c\n1|2|3\n4|5|6\n'),'|')});
t('windows-1252 and utf-8 decoding',()=>{
 assert.equal(finCsvDecode(enc('Descripción;Débito')),'Descripción;Débito');
 assert.equal(finCsvDecode(new Uint8Array([0x44,0xe9,0x62,0x69,0x74,0x6f,0x20,0xf1])),'Débito ñ');
 assert.equal(finCsvDecode(new Uint8Array([0xef,0xbb,0xbf,0x41])),'A')});
t('header detection skips junk lines above it and auto-maps ES and EN names without accents',()=>{
 const rows=finCsvParse('Extracto de cuenta\nCliente;Juan\n\nFECHA;Descripción;Débito;Crédito;Saldo\n01/02/2026;X;1;;5\n',';'),h=finCsvHead(rows);
 assert.equal(h.idx,2);assert.deepEqual(h.map,{date:0,payee:1,notes:-1,amt:-1,out:2,in:3});
 assert.deepEqual(finCsvAuto(['Date','Description','Amount','Notes']),{date:0,payee:1,notes:3,amt:2,out:-1,in:-1});
 assert.deepEqual(finCsvAuto(['Fecha transaccion','Concepto','Valor','Observaciones']),{date:0,payee:1,notes:3,amt:2,out:-1,in:-1});
 assert.deepEqual(finCsvAuto(['Fecha','Fecha valor','Detalle','Importe','Cargo','Abono']),{date:0,payee:2,notes:-1,amt:3,out:4,in:5});
 assert.equal(finCsvHead([['a','b'],['1','2']]),null)});
t('no header: columns guessed from content',()=>{
 const g=finCsvGuess(finCsvParse('01/02/2026,Pago nomina,5000000\n02/02/2026,Exito,-45900\n',','));assert.deepEqual([g.date,g.payee,g.amt],[0,1,2])});
t('amounts: Colombian and US formats to minor units',()=>{
 const A=(s,d)=>finCsvAmt(s,d);
 assert.equal(A('1.250.000,00',','),125000000);assert.equal(A('-45.900',','),-4590000);assert.equal(A('$ 1.250.000',','),125000000);
 assert.equal(A('(45.900)',','),-4590000);assert.equal(A('1,250,000.00','.'),125000000);assert.equal(A('45.900-',','),-4590000);
 assert.equal(A('-1,25','.'.replace('.',',')),-125);assert.equal(A('12.5','.'),1250);assert.equal(A('+7','.'),700);assert.equal(A('0','.'),0);
 assert.equal(A('abc','.'),null);assert.equal(A('','.'),null);assert.equal(A('1.2.3,4,5',','),null);assert.equal(A('12/05/2026','.'),null)});
t('decimal mark detected from the whole column',()=>{
 assert.equal(finCsvDec(['-45.900','1.250.000','12.000']),',');assert.equal(finCsvDec(['1,250,000.00','45.50']),'.');
 assert.equal(finCsvDec(['1.250,50']),',');assert.equal(finCsvDec(['45,90','1.000,00']),',');assert.equal(finCsvDec(['1,250','3,000']),'.');assert.equal(finCsvDec(['5','10']),'.')});
t('date formats, 2-digit years and ambiguity decided by the whole column',()=>{
 assert.equal(finCsvDate('05/11/2026','dmy'),'2026-11-05');assert.equal(finCsvDate('05/11/2026','mdy'),'2026-05-11');
 assert.equal(finCsvDate('2026-11-05','ymd'),'2026-11-05');assert.equal(finCsvDate('2026/11/05','ymd'),'2026-11-05');assert.equal(finCsvDate('20261105','ymd'),'2026-11-05');
 assert.equal(finCsvDate('05-11-2026','dmy'),'2026-11-05');assert.equal(finCsvDate('05.11.2026','dmy'),'2026-11-05');assert.equal(finCsvDate('05/11/26','dmy'),'2026-11-05');assert.equal(finCsvDate('05/11/99','dmy'),'1999-11-05');
 assert.equal(finCsvDate('05112026','dmy'),'2026-11-05');assert.equal(finCsvDate('2026-11-05 10:30:00','ymd'),'2026-11-05');
 assert.equal(finCsvDate('31/02/2026','dmy'),'');assert.equal(finCsvDate('2026-11-05','dmy'),'');assert.equal(finCsvDate('x','dmy'),'');
 assert.equal(finCsvDateFmt(['05/11/2026','13/11/2026']),'dmy');assert.equal(finCsvDateFmt(['05/11/2026','11/13/2026']),'mdy');
 assert.equal(finCsvDateFmt(['05/11/2026','06/11/2026']),'dmy','fully ambiguous defaults to dd/mm');assert.equal(finCsvDateFmt(['2026/11/05','2026/11/13']),'ymd');assert.equal(finCsvDateFmt(['20261105']),'ymd');assert.equal(finCsvDateFmt(['13112026']),'dmy')});
t('rows: single amount column, debit/credit columns, invert sign, errors, skipped title rows',()=>{
 const csv='Fecha;Desc;Valor\n01/02/2026;Pago;"-1.250,50"\n13/02/2026;Cafe;(4.500,00)\nTotal;;\n32/02/2026;Mal;5\n05/02/2026;Cero;0\n06/02/2026;Raro;abc\n';
 const r=finCsvRows(finCsvParse(csv,';').slice(1),M());
 assert.deepEqual(r.map(x=>[x.date,x.payee,x.amt,x.err]),[['2026-02-01','Pago',-125050,''],['2026-02-13','Cafe',-450000,''],['','Mal',500,'Invalid date'],['2026-02-05','Cero',0,'Zero amount'],['2026-02-06','Raro',0,'Invalid amount']]);
 const dc=finCsvRows(finCsvParse('Fecha;Desc;Debito;Credito\n01/02/2026;A;45.900;\n02/02/2026;B;;1.000.000\n03/02/2026;C;-5.000;\n04/02/2026;D;;\n',';').slice(1),M({amt:-1,out:2,in:3}));
 assert.deepEqual(dc.map(x=>x.amt),[-4590000,100000000,-500000,0]);assert.equal(dc[3].err,'Invalid amount');
 assert.deepEqual(finCsvRows([['01/02/2026','A','-10,00']],M({inv:true}))[0].amt,1000);
 const n=finCsvRows([['01/02/2026','  Super   Mercado  ','1','  nota  x ']],M({notes:3}));assert.equal(n[0].payee,'Super Mercado');assert.equal(n[0].notes,'nota x')});
t('end to end: Bancolombia-like latin-1 semicolon file',()=>{
 const csv='Fecha;Descripción;Valor;Saldo\r\n01/11/2026;COMPRA ÉXITO;-45.900,00;954.100,00\r\n02/11/2026;ABONO NÓMINA;5.000.000;5.954.100\r\n';
 const bytes=new Uint8Array([...csv].map(c=>c.charCodeAt(0)&255)),txt=finCsvDecode(bytes);assert.ok(txt.includes('Descripción')&&txt.includes('ÉXITO'));
 const rows=finCsvParse(txt,finCsvDelim(txt)),h=finCsvHead(rows),r=finCsvRows(rows.slice(h.idx+1),Object.assign({inv:false,hdr:true,fmt:'auto'},h.map));
 assert.deepEqual(r.map(x=>[x.date,x.amt]),[['2026-11-01',-4590000],['2026-11-02',500000000]])});
t('review marks new and error rows; imp hash is stable and depends on the occurrence index',()=>{
 const f=base(),csv='D,P,A\n2026-11-01,Cafe,-4.50\n2026-11-01,Cafe,-4.50\n2026-11-01,Cafe,-4.50\n2026-11-02,Bad,x\n',r=run(f,csv,M());
 assert.deepEqual(r.map(x=>x.st),['new','new','new','err']);assert.equal(new Set(r.slice(0,3).map(x=>x.imp)).size,3,'same-file duplicates get distinct imp');
 assert.equal(r[0].imp,finCsvHash('2026-11-01',-450,'cafe',0));assert.equal(finCsvHash('2026-11-01',-450,'Cafe ',0),finCsvHash('2026-11-01',-450,'cafe',0));
 assert.notEqual(finCsvHash('2026-11-01',-450,'cafe',0),finCsvHash('2026-11-01',-450,'cafe',1));assert.deepEqual(run(f,csv,M()).map(x=>x.imp),r.map(x=>x.imp))});
t('commit: cleared, uncategorized, imp stored, payees and counters updated, unchecked rows skipped',()=>{
 const f=base(),r=run(f,'D,P,A\n2026-11-01,Cafe,-4.50\n2026-11-02,Rappi,-10.00\n2026-11-03,Pay,100.00\n',M());r[1].sel=false;
 const n0=f.ntx,p0=f.npay;assert.equal(finCsvCommit(f,1,r),2);assert.equal(f.tx.length,2);assert.equal(f.ntx,n0+2);assert.equal(f.npay,p0+2);
 for(const x of f.tx){assert.equal(x.cleared,true);assert.equal(x.cat,null);assert.equal(typeof x.imp,'string');assert.equal(x.acct,1);assert.equal(finClr(x),1)}
 assert.deepEqual(f.payees.map(p=>p.name).sort(),['Cafe','Pay']);assert.deepEqual(f.tx.map(x=>x.id),[n0,n0+1]);
 const g=rt(f);assert.deepEqual(g.tx.map(x=>x.imp),f.tx.map(x=>x.imp),'imp survives finNorm');assert.equal(finCsvCommit(f,99,r),0,'unknown account adds nothing')});
t('re-import is idempotent, also with same-file duplicates and a longer overlapping file',()=>{
 const f=base(),csv='D,P,A\n2026-11-01,Cafe,-4.50\n2026-11-01,Cafe,-4.50\n2026-11-02,Rappi,-10.00\n';
 assert.equal(finCsvCommit(f,1,run(f,csv,M())),3);const r2=run(f,csv,M());assert.deepEqual(r2.map(x=>x.st),['dup','dup','dup']);assert.equal(finCsvCommit(f,1,r2),0);assert.equal(f.tx.length,3);
 const r3=run(f,csv+'2026-11-05,Nuevo,-1.00\n',M());assert.deepEqual(r3.map(x=>x.st),['dup','dup','dup','new']);
 const g=rt(JSON.parse(JSON.stringify(f)));assert.deepEqual(run(g,csv,M()).map(x=>x.st),['dup','dup','dup'],'after a save and reload');
 f.tx[0].payee='Renamed';f.tx[0].cat=1;assert.deepEqual(run(f,csv,M()).map(x=>x.st),['dup','dup','dup'],'edited imported tx still recognised')});
t('duplicates: same account, same amount, within 7 days, same payee preferred, each existing tx used once',()=>{
 const f=base([TX(1,1,'2026-11-03',-450,{payee:'Rappi'}),TX(2,1,'2026-11-05',-450,{payee:'Cafe'}),TX(3,2,'2026-11-01',-450,{payee:'Cafe'}),TX(4,1,'2026-11-20',-450,{payee:'Cafe'})]);
 const r=run(f,'D,P,A\n2026-11-01,Cafe,-4.50\n2026-11-01,Cafe,-4.50\n2026-11-09,Cafe,-4.50\n',M());
 assert.deepEqual(r.map(x=>[x.st,x.match]),[['dup',2],['dup',1],['new',0]],'same payee first, then any payee in the window; day 8 is outside; other account ignored');
 const e=run(f,'D,P,A\n2026-11-12,Cafe,-4.50\n',M());assert.equal(e[0].st,'dup','7 days apart still matches');assert.equal(e[0].match,2);
 assert.equal(run(f,'D,P,A\n2026-11-01,Cafe,-4.51\n',M())[0].st,'new');assert.equal(run(f,'D,P,A\n2026-11-01,Cafe,-4.50\n',M(),2)[0].match,3,'matches in the target account only')});
t('reconciled transactions are matched as duplicates but never modified',()=>{
 const f=base([TX(1,1,'2026-11-03',-450,{payee:'Cafe',cleared:true,reconciled:true,notes:'keep',cat:2})]),before=JSON.stringify(f.tx);
 const r=run(f,'D,P,A\n2026-11-03,Cafe,-4.50\n',M());assert.equal(r[0].st,'dup');assert.equal(finCsvCommit(f,1,r),0);assert.equal(JSON.stringify(f.tx),before)});
t('rules run on import: category and payee rename, explicit nothing else changed',()=>{
 const f=base();const gr=f.cats.find(c=>c.name=='Groceries').id;f.rules=[{id:1,stage:'default',conds:[{field:'payee',op:'contains',value:'exito'}],condsOp:'and',actions:[{field:'category',op:'set',value:gr},{field:'payee',op:'set',value:'Éxito'}],enabled:true,order:1}];f.nrule=2;
 const r=run(f,'D,P,A\n2026-11-01,COMPRA EXITO 123,-45.00\n2026-11-02,Otro,-5.00\n',M());
 assert.deepEqual(r.map(x=>x.cat),[gr,null]);assert.equal(r[0].dp,'Éxito');assert.equal(r[0].payee,'COMPRA EXITO 123');
 finCsvCommit(f,1,r);assert.deepEqual(f.tx.map(x=>[x.payee,x.cat,x.cleared]),[['Éxito',gr,true],['Otro',null,true]]);assert.ok(f.payees.some(p=>p.name=='Éxito'));
 assert.deepEqual(run(f,'D,P,A\n2026-11-01,COMPRA EXITO 123,-45.00\n',M()).map(x=>x.st),['dup'],'renamed by a rule, still the same bank row')});
t('csvMap and tx.imp are validated by finNorm, idempotently',()=>{
 const ok={date:0,payee:1,notes:-1,amt:2,out:-1,in:-1,inv:true,hdr:true,fmt:'dmy'};
 const f=rt({accounts:[AC(1,'A',{csvMap:ok}),AC(2,'B',{csvMap:{date:'x',amt:2}}),AC(3,'C',{csvMap:{date:0}}),AC(4,'D',{csvMap:'zz'}),AC(5,'E',{csvMap:{date:0,amt:500,fmt:'zzz',evil:1,payee:1.5}}),AC(6,'F',{csvMap:{date:1,out:3,in:4,amt:-1,fmt:'ymd'}}),AC(7,'G',{csvMap:{date:0,amt:2,out:3,in:4}})],tx:[TX(1,1,'2026-11-01',-5,{imp:'abc123'}),TX(2,1,'2026-11-01',-5,{imp:42}),TX(3,1,'2026-11-01',-5,{imp:'<x>'}),TX(4,1,'2026-11-01',-5,{imp:{}})],ntx:5});
 assert.deepEqual(f.accounts[0].csvMap,ok);for(const i of[1,2,3,4])assert.ok(!('csvMap' in f.accounts[i]),'account '+i);
 assert.deepEqual(f.accounts[5].csvMap,{date:1,payee:-1,notes:-1,amt:-1,out:3,in:4,inv:false,hdr:false,fmt:'ymd'});assert.deepEqual(f.accounts[6].csvMap,{date:0,payee:-1,notes:-1,amt:2,out:-1,in:-1,inv:false,hdr:false,fmt:'auto'});
 assert.deepEqual(f.tx.map(x=>x.imp),['abc123',undefined,undefined,undefined]);const g=rt(f);assert.deepEqual(g,f);assert.deepEqual(rt(g),g);assert.deepEqual(finCsvMapNorm(ok),{csvMap:ok});assert.deepEqual(finCsvMapNorm(null),{})});
t('fuzzy duplicates can be forced; rows past 300 are real, selectable items',()=>{
 const f=base([TX(1,1,'2026-11-01',-500000,{payee:'Rent'})]);
 const it=run(f,'Date,Desc,Amt\n2026-11-02,Other shop,-5000\n',M(),1);assert.equal(it[0].st,'dup');assert.ok(it[0].fz);assert.equal(it[0].sel,false);
 assert.equal(finCsvCommit(f,1,it),0);it[0].sel=true;assert.equal(finCsvCommit(f,1,it),1);assert.equal(f.tx.length,2);
 const g=base([]);let csv='Date,Desc,Amt\n';for(let i=0;i<350;i++)csv+='2026-01-01,P'+i+',-'+(i+1)+'\n';
 const r=run(g,csv,M(),1);assert.equal(r.length,350);assert.ok(r.every(x=>x.st=='new'&&x.sel));for(let i=300;i<350;i++)r[i].sel=false;assert.equal(finCsvCommit(g,1,r),300)});
t('saved map shortcut needs same header presence, columns in range and parseable rows',()=>{
 const rows=finCsvParse('Date,Description,Amount\n2026-11-01,A,-5\n2026-11-02,B,-6\n',','),hd=finCsvHead(rows),sv={date:0,payee:1,notes:-1,amt:2,out:-1,in:-1,inv:false,hdr:true,fmt:'auto'};
 assert.ok(finCsvFits(sv,hd,rows));assert.ok(!finCsvFits(null,hd,rows));assert.ok(!finCsvFits(Object.assign({},sv,{hdr:false}),hd,rows));assert.ok(!finCsvFits(sv,null,rows));
 assert.ok(!finCsvFits(Object.assign({},sv,{amt:5}),hd,rows));assert.ok(!finCsvFits(Object.assign({},sv,{date:1}),hd,rows))});
console.log(passed+' passed');
