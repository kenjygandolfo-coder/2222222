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

function plateNoteTxt(nd,u){if(nd.kind=='exact')return'';if(nd.kind=='micro')return'+'+nd.micro.map(m=>(m.count>1?m.count+'\u00d7':'')+m.w).join(' + ')+' '+u+' micro each side';return'Missing '+nd.missing+' '+u+' per side, need micro plates'}
let passed=0;const t=(n,f)=>{f();passed++;console.log('ok  '+n)};
const mic={1:2,0.5:2};
t('exact standard build (lb)',()=>{const nd=plateNeed(135,45,PLATE_LB,mic,true);assert.equal(nd.kind,'exact');assert.equal(plateNoteTxt(nd,'lb'),'')});
t('bar only is exact',()=>assert.equal(plateNeed(45,45,PLATE_LB,mic,true).kind,'exact'));
t('needs micro: +1 lb each side',()=>{const nd=plateNeed(137,45,PLATE_LB,mic,true);assert.equal(nd.kind,'micro');assert.equal(plateNoteTxt(nd,'lb'),'+1 lb micro each side')});
t('needs micro: combines sizes',()=>{const nd=plateNeed(138,45,PLATE_LB,mic,true);assert.equal(plateNoteTxt(nd,'lb'),'+1 + 0.5 lb micro each side')});
t('uses several of one size',()=>{const nd=plateNeed(139,45,PLATE_LB,mic,true);assert.equal(plateNoteTxt(nd,'lb'),'+2\u00d71 lb micro each side')});
t('missing even with micro',()=>{const nd=plateNeed(150.5,45,PLATE_LB,{1:1},true);assert.equal(nd.kind,'missing');assert.equal(nd.missing,0.25);assert.equal(plateNoteTxt(nd,'lb'),'Missing 0.25 lb per side, need micro plates')});
t('no micro plates owned',()=>{const nd=plateNeed(137,45,PLATE_LB,{},true);assert.equal(nd.kind,'missing');assert.equal(nd.missing,1);assert.equal(plateNoteTxt(nd,'lb'),'Missing 1 lb per side, need micro plates')});
t('hasMicro false ignores stock',()=>assert.equal(plateNeed(137,45,PLATE_LB,mic,false).kind,'missing'));
t('kg exact',()=>assert.equal(plateNeed(60,20,PLATE_KG,{},false).kind,'exact'));
t('kg needs micro',()=>{const nd=plateNeed(62,20,PLATE_KG,{1:1},true);assert.equal(plateNoteTxt(nd,'kg'),'+1 kg micro each side')});
t('kg 1.25 plate is standard, not micro',()=>assert.equal(plateNeed(22.5,20,PLATE_KG,{},false).kind,'exact'));
t('lb 1.25 per side is micro',()=>assert.equal(plateNeed(47.5,45,PLATE_LB,{1.25:1},true).kind,'micro'));
t('below bar does not crash',()=>assert.equal(plateNeed(30,45,PLATE_LB,mic,true).kind,'exact'));
console.log(passed+' passed');
