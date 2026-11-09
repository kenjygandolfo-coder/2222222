/* Dev-only test for the auto meal plan rule. mpDue() is MIRRORED from index.html. */
import assert from 'node:assert/strict';
const MPD=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function mpDue(days,applied,d,t,closed){if(!days||!days.length||d<t||(applied||{})[d]||closed)return false;return days.includes(MPD[(new Date(d+'T00:00').getDay()+6)%7])}
// 2026-01-05 is a Monday
assert.equal(mpDue(['Mon'],{},'2026-01-05','2026-01-05',false),true);
assert.equal(mpDue(['Mon'],{},'2026-01-06','2026-01-05',false),false,'not a chosen weekday');
assert.equal(mpDue(['Mon'],{},'2026-01-12','2026-01-05',false),true,'future chosen day');
assert.equal(mpDue(['Mon'],{},'2025-12-29','2026-01-05',false),false,'never past');
assert.equal(mpDue(['Mon'],{'2026-01-05':1},'2026-01-05','2026-01-05',false),false,'once per date');
assert.equal(mpDue(['Mon'],{},'2026-01-05','2026-01-05',true),false,'closed day');
assert.equal(mpDue([],{},'2026-01-05','2026-01-05',false),false);
assert.equal(mpDue(['Sun'],{},'2026-01-11','2026-01-05',false),true);
console.log('PASS meal-plan-auto');
