import fs from 'fs';
import assert from 'assert';
const src = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const m = src.match(/const buildMsg=.*\n/);
const buildMsg = new Function(m[0] + 'return buildMsg')();
const ts = '2025-03-04T10:30:00Z';
const en = buildMsg(ts, 'forma-v70', 'en');
assert(en.startsWith('Last updated: ') && en.endsWith('(forma-v70)') && !en.includes('undefined'), en);
const es = buildMsg(ts, 'forma-v70', 'es');
assert(es.startsWith('Última actualización: ') && !es.includes('undefined'), es);
assert(buildMsg(ts, 'v', 'en', 'Wed, 05 Mar 2025 10:00:00 GMT') !== buildMsg(ts, 'v', 'en'), 'lastMod wins');
assert(buildMsg('garbage', 'v', 'en').includes('garbage'));
// BUILD_VER must match sw.js CACHE in both pages
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8').match(/CACHE = '([^']+)'/)[1];
for (const f of ['index.html', 'gymapp.html']) {
  const t = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  assert(t.includes("BUILD_VER='" + sw + "'"), f + ' BUILD_VER != sw CACHE');
}
console.log('build-info ok');
