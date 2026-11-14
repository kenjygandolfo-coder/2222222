/* Dev-only test for the plate model (standard plates, micro plates, per-side note).
   Functions are extracted VERBATIM from index.html (kept in sync by hand).
   Run: node tools/plate-calc.test.mjs */
import assert from 'node:assert/strict';
const PLATE_LB=[[45,'#e23b3b','red'],[25,'#2f6fd0','blue'],[10,'#2f9e4f','green'],[5,'#e8c020','yellow'],[2.5,'#e8842a','orange']];
const PLATE_KG=[[25,'#e23b3b','red'],[20,'#2f6fd0','blue'],[15,'#e8c020','yellow'],[10,'#2f9e4f','green'],[5,'#d8d8d8','white'],[2.5,'#e8842a','orange'],[1.25,'#9a5fd0','purple']];
function plateBreakdown(total,bar,L=PLATE_LB){if(!(total>=bar))return{perSide:[],leftover:0,under:true,bar,L};
let rem=(total-bar)/2;const perSide=[];for(const[w,color,name]of L){const cnt=Math.floor(rem/w);if(cnt>0){rem-=cnt*w;perSide.push({w,color,name,count:cnt})}}
return{perSide,leftover:Math.round(rem*100)/100,under:false,bar,L,perSideTotal:(total-bar)/2}}
/* Pure: can the target be built from standard plates, and if not, do the owned microplates finish it?
   micro = per-side microplate stock {size:count} (already halved from the owned total). hasMicro=false ignores it.
   Returns {kind:'exact'|'micro'|'missing',micro:[{w,count}],missing} (per side, missing in plate units). */
function plateNeed(total,bar,L,micro,hasMicro){const bk=plateBreakdown(total,bar,L);if(bk.under||!(bk.leftover>0))return{kind:'exact',micro:[],missing:0};
let r=Math.round(bk.leftover*100);const used=[];if(hasMicro){for(const w of Object.keys(micro||{}).map(Number).sort((a,b)=>b-a)){const u=Math.round(w*100),have=Math.floor(micro[w]||0);if(!(u>0)||!(have>0))continue;const c=Math.min(have,Math.floor(r/u));if(c>0){r-=c*u;used.push({w,count:c})}}}
return r>0?{kind:'missing',micro:used,missing:r/100}:{kind:'micro',micro:used,missing:0}}

function plateNoteTxt(nd,u){return nd.kind=='missing'?'Missing '+nd.missing+' '+u+' per side, need micro plates':''}
/* Pure: text under a per-set bar graphic listing the plates used per side (standard from the breakdown, micro from plateNeed). lang 'es' uses decimal commas. */
function plateUsedTxt(bk,micro,u,lang,h){if(!bk||bk.under)return'';const es=lang=='es',f=x=>{x=Math.round(+x*100)/100;return Number.isFinite(x)?String(x).replace('.',es?',':'.'):''},o=[];for(const p of bk.perSide||[])o.push(p.count+' \u00d7 '+f(p.w));for(const m of micro||[])o.push(m.count+' \u00d7 micro '+f(m.w));const q=s=>h?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):String(s),bw=bk.bar>0?q(f(bk.bar)+' '+u):'',b=bw?(es?'Barra ':'Bar ')+(h?'<b>'+bw+'</b>':bw)+' \u00b7 ':'';return o.length?b+(es?'Por lado: ':'Per side: ')+q(o.join(' + ')+' '+u):(es?'Solo la barra':'Just the bar')}
let passed=0;const t=(n,f)=>{f();passed++;console.log('ok  '+n)};
const mic={1:2,0.5:2};
t('exact standard build (lb)',()=>{const nd=plateNeed(135,45,PLATE_LB,mic,true);assert.equal(nd.kind,'exact');assert.equal(plateNoteTxt(nd,'lb'),'')});
t('bar only is exact',()=>assert.equal(plateNeed(45,45,PLATE_LB,mic,true).kind,'exact'));
t('needs micro: +1 lb each side',()=>{const nd=plateNeed(137,45,PLATE_LB,mic,true);assert.equal(nd.kind,'micro');assert.equal(plateNoteTxt(nd,'lb'),'')});
t('needs micro: combines sizes',()=>{const nd=plateNeed(138,45,PLATE_LB,mic,true);assert.equal(plateNoteTxt(nd,'lb'),'')});
t('uses several of one size',()=>{const nd=plateNeed(139,45,PLATE_LB,mic,true);assert.equal(plateNoteTxt(nd,'lb'),'')});
t('missing even with micro',()=>{const nd=plateNeed(150.5,45,PLATE_LB,{1:1},true);assert.equal(nd.kind,'missing');assert.equal(nd.missing,0.25);assert.equal(plateNoteTxt(nd,'lb'),'Missing 0.25 lb per side, need micro plates')});
t('no micro plates owned',()=>{const nd=plateNeed(137,45,PLATE_LB,{},true);assert.equal(nd.kind,'missing');assert.equal(nd.missing,1);assert.equal(plateNoteTxt(nd,'lb'),'Missing 1 lb per side, need micro plates')});
t('hasMicro false ignores stock',()=>assert.equal(plateNeed(137,45,PLATE_LB,mic,false).kind,'missing'));
t('kg exact',()=>assert.equal(plateNeed(60,20,PLATE_KG,{},false).kind,'exact'));
t('kg needs micro',()=>{const nd=plateNeed(62,20,PLATE_KG,{1:1},true);assert.equal(plateNoteTxt(nd,'kg'),'')});
t('kg 1.25 plate is standard, not micro',()=>assert.equal(plateNeed(22.5,20,PLATE_KG,{},false).kind,'exact'));
t('lb 1.25 per side is micro',()=>assert.equal(plateNeed(47.5,45,PLATE_LB,{1.25:1},true).kind,'micro'));
t('below bar does not crash',()=>assert.equal(plateNeed(30,45,PLATE_LB,mic,true).kind,'exact'));
t('gymapp kg (no micro inventory): remainder is missing',()=>{const nd=plateNeed(61,20,PLATE_KG,{},false);assert.equal(nd.kind,'missing');assert.equal(plateNoteTxt(nd,'kg'),'Missing 0.5 kg per side, need micro plates')});
const used=(tot,bar,L,mic,hm,u,lg)=>{const bk=plateBreakdown(tot,bar,L),nd=plateNeed(tot,bar,L,mic,hm);return plateUsedTxt(bk,nd.micro,u,lg)};
t('used: standard only (lb)',()=>assert.equal(used(135,45,PLATE_LB,mic,true,'lb','en'),'Bar 45 lb \u00b7 Per side: 1 \u00d7 45 lb'));
t('used: several plates',()=>assert.equal(used(235,45,PLATE_LB,mic,true,'lb','en'),'Bar 45 lb \u00b7 Per side: 2 \u00d7 45 + 1 \u00d7 5 lb'));
t('used: with micro',()=>assert.equal(used(147,45,PLATE_LB,mic,true,'lb','en'),'Bar 45 lb \u00b7 Per side: 1 \u00d7 45 + 1 \u00d7 5 + 1 \u00d7 micro 1 lb'));
t('used: just the bar',()=>assert.equal(used(45,45,PLATE_LB,mic,true,'lb','en'),'Just the bar'));
t('used: no bar weight',()=>assert.equal(used(90,0,PLATE_LB,{},false,'lb','en'),'Per side: 1 \u00d7 45 lb'));
t('used: missing remainder lists standard only, note separate',()=>{assert.equal(used(137,45,PLATE_LB,{},true,'lb','en'),'Bar 45 lb \u00b7 Per side: 1 \u00d7 45 lb');assert.equal(plateNoteTxt(plateNeed(137,45,PLATE_LB,{},true),'lb'),'Missing 1 lb per side, need micro plates')});
t('used: kg',()=>assert.equal(used(60,20,PLATE_KG,{},false,'kg','en'),'Bar 20 kg \u00b7 Per side: 1 \u00d7 20 kg'));
t('used: kg with 1.25',()=>assert.equal(used(62.5,20,PLATE_KG,{},false,'kg','en'),'Bar 20 kg \u00b7 Per side: 1 \u00d7 20 + 1 \u00d7 1.25 kg'));
t('used: ES decimal commas',()=>assert.equal(used(62.5,20,PLATE_KG,{},false,'kg','es'),'Barra 20 kg \u00b7 Por lado: 1 \u00d7 20 + 1 \u00d7 1,25 kg'));
t('used: ES just the bar and micro',()=>{assert.equal(used(45,45,PLATE_LB,mic,true,'lb','es'),'Solo la barra');assert.equal(used(137,45,PLATE_LB,mic,true,'lb','es'),'Barra 45 lb \u00b7 Por lado: 1 \u00d7 45 + 1 \u00d7 micro 1 lb')});
t('used: under bar / bad input never prints undefined or NaN',()=>{assert.equal(used(30,45,PLATE_LB,mic,true,'lb','en'),'');assert.equal(plateUsedTxt(null,[],'lb','en'),'');assert.ok(!/undefined|NaN/.test(plateUsedTxt(plateBreakdown(100,NaN,PLATE_LB),[],'lb','en')))});
t('used html: bar weight bold, text variant has no tags',()=>{const bk=plateBreakdown(62.5,20,PLATE_KG),nd=plateNeed(62.5,20,PLATE_KG,{},false);assert.equal(plateUsedTxt(bk,nd.micro,'kg','en',1),'Bar <b>20 kg</b> \u00b7 Per side: 1 \u00d7 20 + 1 \u00d7 1.25 kg');assert.equal(plateUsedTxt(bk,nd.micro,'kg','es',1),'Barra <b>20 kg</b> \u00b7 Por lado: 1 \u00d7 20 + 1 \u00d7 1,25 kg');assert.ok(!/</.test(plateUsedTxt(bk,nd.micro,'kg','en')))});
t('used html: no bar weight has no bold, unit is escaped',()=>{assert.equal(plateUsedTxt(plateBreakdown(90,0,PLATE_LB),[],'lb','en',1),'Per side: 1 \u00d7 45 lb');assert.equal(plateUsedTxt(plateBreakdown(135,45,PLATE_LB),[],'<i>','en',1),'Bar <b>45 &lt;i&gt;</b> \u00b7 Per side: 1 \u00d7 45 &lt;i&gt;')});
console.log(passed+' passed');
