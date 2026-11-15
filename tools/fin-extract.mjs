/* Dev helper for the finance tests: pulls the REAL pure functions out of index.html
   (no hand-copied mirrors) and returns them. Not a test itself. */
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function fn(name) {
  const i = src.indexOf('\nfunction ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(i + 1, k + 1);
  }
  throw new Error('unbalanced: ' + name);
}
function konst(name) {
  const m = src.match(new RegExp('^const ' + name + '=.*$', 'm'));
  if (!m) throw new Error('const not found: ' + name);
  return m[0];
}
const FNS = ['finCur','parseAmount','fmtMoney','accountBalance','finTotals','finDate','finIds','finNorm','finSortTx','finRunning','finRange','finFilter','finTxTotals','finPayeeRank','finMonth','finMonthAdd','finBudgetCalc','finBudgetCopy','finBudgetSpent','finBudgetAvg3'];
/* todayStr is what today() returns inside finNorm */
export function loadFin(todayStr = '2026-11-14') {
  const code = konst('FIN_TYPES') + '\n' + konst('FIN_CATS') + '\nconst today=()=>' + JSON.stringify(todayStr) + ';\n' + FNS.map(fn).join('\n') + '\nreturn{' + FNS.join(',') + ',FIN_TYPES,FIN_CATS}';
  return new Function(code)();
}
