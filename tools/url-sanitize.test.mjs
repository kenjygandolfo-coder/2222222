/* Dev-only unit test for the pure bookmark URL sanitizer (Phase 5).
   NOT shipped in the service-worker SHELL (tools/ is dev-only).
   Run: `node tools/url-sanitize.test.mjs` - exits 0 with a PASS summary,
   non-zero on the first failed assertion.

   The safeUrl()/urlHost() bodies below are MIRRORED VERBATIM from index.html.
   If you change the convention in one place, change it in the other.
   Convention:
     - safeUrl(input) trims; accepts ONLY http: and https:; rejects
       javascript:, data:, vbscript:, file:, mailto: and every other scheme;
       a bare host with no scheme (e.g. "example.com") gets "https://" prepended;
       returns the normalized URL string, or '' when invalid.
     - urlHost(u) returns the host for display, or '' on failure. */

// ---- MIRROR of index.html safeUrl() / urlHost() ----
function safeUrl(input){
  let s=String(input==null?'':input).trim();
  if(!s)return'';
  if(!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)){
    /* no scheme: only accept something that looks like a bare host, then https:// it */
    if(/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?(:\d+)?(\/|$|\?|#)/.test(s)&&/\./.test(s.split(/[\/?#]/)[0]))s='https://'+s;
    else return'';
  }
  if(!/^https?:\/\//i.test(s))return'';
  try{const u=new URL(s);if(u.protocol!=='http:'&&u.protocol!=='https:')return'';return u.href}
  catch(e){return''}
}
function urlHost(u){try{return new URL(u).host}catch(e){return''}}
// ---- end mirror ----

let failed = 0, passed = 0;
function assert(label, cond) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.error(`  FAIL  ${label}`); }
}

console.log('safeUrl / urlHost edge cases:');

// http/https pass through
{
  assert('https URL accepted', safeUrl('https://example.com') === 'https://example.com/');
  assert('http URL accepted', safeUrl('http://example.com/path?q=1') === 'http://example.com/path?q=1');
  assert('https with port + path kept', safeUrl('https://example.com:8443/a/b') === 'https://example.com:8443/a/b');
  assert('leading/trailing whitespace trimmed', safeUrl('   https://example.com   ') === 'https://example.com/');
  assert('uppercase scheme accepted', safeUrl('HTTPS://Example.com').startsWith('https://'));
}

// bare host gets https:// prepended
{
  assert('bare host -> https', safeUrl('example.com') === 'https://example.com/');
  assert('bare host with path -> https', safeUrl('example.com/page') === 'https://example.com/page');
  assert('bare host with subdomain', safeUrl('www.example.co.uk') === 'https://www.example.co.uk/');
}

// dangerous schemes are rejected
{
  assert('javascript: rejected', safeUrl('javascript:alert(1)') === '');
  assert('javascript: with spaces rejected', safeUrl('  javascript:alert(1)  ') === '');
  assert('JavaScript mixed-case rejected', safeUrl('JaVaScRiPt:alert(1)') === '');
  assert('data: rejected', safeUrl('data:text/html,<script>alert(1)</script>') === '');
  assert('vbscript: rejected', safeUrl('vbscript:msgbox(1)') === '');
  assert('file: rejected', safeUrl('file:///etc/passwd') === '');
  assert('mailto: rejected', safeUrl('mailto:a@b.com') === '');
  assert('ftp: rejected', safeUrl('ftp://example.com') === '');
}

// empty / whitespace / junk -> invalid
{
  assert('empty string invalid', safeUrl('') === '');
  assert('whitespace only invalid', safeUrl('   ') === '');
  assert('null invalid', safeUrl(null) === '');
  assert('undefined invalid', safeUrl(undefined) === '');
  assert('plain word (no dot) invalid', safeUrl('notaurl') === '');
  assert('single word no scheme no dot invalid', safeUrl('localhost') === '');
}

// urlHost derivation
{
  assert('urlHost of https URL', urlHost('https://example.com/path') === 'example.com');
  assert('urlHost with port', urlHost('https://example.com:8443/') === 'example.com:8443');
  assert('urlHost of invalid returns empty', urlHost('notaurl') === '');
}

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed) { console.error('FAIL: safeUrl/urlHost assertions did not all hold.'); process.exit(1); }
console.log('PASS: all safeUrl/urlHost edge cases hold.');
