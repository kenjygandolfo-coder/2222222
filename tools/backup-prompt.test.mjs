/* Dev-only test of bkdue() (backup reminder decision), mirrored verbatim from index.html/gymapp.html.
   Run: node tools/backup-prompt.test.mjs */
import assert from 'node:assert/strict';
function bkdue(last,every,first,t,snooze,later,blocked,has){if(!has||blocked||later||!(every>0))return false;if(snooze&&snooze>=t)return false;const dk=d=>{const x=new Date(d);return isNaN(x)?null:Date.UTC(x.getFullYear(),x.getMonth(),x.getDate())},tk=s=>{const m=/^(\d+)-(\d+)-(\d+)$/.exec(s||'');return m?Date.UTC(+m[1],m[2]-1,+m[3]):null},tn=tk(t);if(tn==null)return false;const l=last?dk(last):null;if(l!=null)return Math.round((tn-l)/864e5)>=every;const f=tk(first);return f!=null&&Math.round((tn-f)/864e5)>=3}
const T='2026-11-20';
const ago=n=>{const d=new Date(2026,10,20,12,0,0);d.setDate(d.getDate()-n);return d.toISOString()};
// never backed up
assert.equal(bkdue(null,7,'2026-11-20',T,null,false,false,true),false); // day 1
assert.equal(bkdue(null,7,'2026-11-19',T,null,false,false,true),false);
assert.equal(bkdue(null,7,'2026-11-18',T,null,false,false,true),false); // 2 days
assert.equal(bkdue(null,7,'2026-11-17',T,null,false,false,true),true); // 3 days grace over
assert.equal(bkdue(null,7,null,T,null,false,false,true),false); // no first date
// last backup vs frequency
assert.equal(bkdue(ago(0),7,'2026-01-01',T,null,false,false,true),false);
assert.equal(bkdue(ago(6),7,'2026-01-01',T,null,false,false,true),false);
assert.equal(bkdue(ago(7),7,'2026-01-01',T,null,false,false,true),true);
assert.equal(bkdue(ago(20),7,'2026-01-01',T,null,false,false,true),true);
assert.equal(bkdue(ago(13),14,'2026-01-01',T,null,false,false,true),false);
assert.equal(bkdue(ago(14),14,'2026-01-01',T,null,false,false,true),true);
assert.equal(bkdue(ago(29),30,'2026-01-01',T,null,false,false,true),false);
assert.equal(bkdue(ago(30),30,'2026-01-01',T,null,false,false,true),true);
// never
assert.equal(bkdue(ago(99),0,'2026-01-01',T,null,false,false,true),false);
assert.equal(bkdue(null,0,'2026-01-01',T,null,false,false,true),false);
// snooze
assert.equal(bkdue(ago(20),7,'2026-01-01',T,T,false,false,true),false);
assert.equal(bkdue(ago(20),7,'2026-01-01',T,'2026-11-19',false,false,true),true);
// later, blocked, no data
assert.equal(bkdue(ago(20),7,'2026-01-01',T,null,true,false,true),false);
assert.equal(bkdue(ago(20),7,'2026-01-01',T,null,false,true,true),false);
assert.equal(bkdue(ago(20),7,'2026-01-01',T,null,false,false,false),false);
// garbage last behaves as never backed up
assert.equal(bkdue('garbage',7,'2026-11-10',T,null,false,false,true),true);
console.log('PASS backup-prompt');
