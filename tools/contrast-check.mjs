// tools/contrast-check.mjs
// DEV-ONLY accessibility gate. NOT part of the Forma PWA shell: it is never
// cached by sw.js and never shipped to the browser. Run with plain Node (no deps):
//
//   node tools/contrast-check.mjs
//
// It holds the hexes for each accent theme (--pri, --onpri, --data-1) plus the
// surface colours (--card, --bg) for light AND dark, implements the WCAG 2.2
// relative-luminance + contrast-ratio math, and asserts, per theme per scheme:
//   - on-button text  : --onpri vs --pri    >= 4.5:1  (WCAG 1.4.3 normal text)
//   - data fill        : --data-1 vs --card  >= 3:1    (WCAG 1.4.11 non-text)
//   - data fill        : --data-1 vs --bg    >= 3:1    (WCAG 1.4.11 non-text)
// It prints a PASS/FAIL table with ratios and exits non-zero on any failure so
// it can be used as a gate. KEEP THESE HEXES IN SYNC WITH THE CSS in index.html.

// --- WCAG 2.2 colour maths (sRGB) ---
function toLin(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function lum(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}
function ratio(a, b) {
  const la = lum(a), lb = lum(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// --- Accent palettes (must match the [data-th=...] CSS in index.html) ---
// Surfaces are shared across accents (they come from the base :root / dark blocks):
const SURF = {
  light: { card: '#FBF7EE', bg: '#ECE5D6' },
  dark:  { card: '#1E1E1A', bg: '#161613' },
};

// burgundy is the DEFAULT identity (no CSS override): these are today's values.
const THEMES = {
  burgundy: {
    light: { pri: '#5C1A22', onpri: '#F8F2E7', data1: '#5C1A22' },
    dark:  { pri: '#A8404F', onpri: '#F3EAD9', data1: '#BF4A5B' },
  },
  olive: {
    light: { pri: '#3C3F1E', onpri: '#F3EAD9', data1: '#5A5E30' },
    dark:  { pri: '#8A8F5C', onpri: '#17170F', data1: '#A7AD74' },
  },
  cream: {
    light: { pri: '#7A5A1E', onpri: '#FBF4E3', data1: '#8A6A28' },
    dark:  { pri: '#C9A05A', onpri: '#17150F', data1: '#D8B26A' },
  },
};

const R = (n) => Math.round(n * 100) / 100;
const AA_TEXT = 4.5;   // 1.4.3 normal text
const AA_NON = 3.0;    // 1.4.11 non-text / graphics

let failed = false;
const rows = [];
for (const [name, t] of Object.entries(THEMES)) {
  for (const scheme of ['light', 'dark']) {
    const p = t[scheme];
    const s = SURF[scheme];
    const onBtn = ratio(p.onpri, p.pri);
    const dCard = ratio(p.data1, s.card);
    const dBg = ratio(p.data1, s.bg);
    const ok = onBtn >= AA_TEXT && dCard >= AA_NON && dBg >= AA_NON;
    if (!ok) failed = true;
    rows.push({
      theme: name,
      scheme,
      'on-btn(>=4.5)': R(onBtn),
      'fill/card(>=3)': R(dCard),
      'fill/bg(>=3)': R(dBg),
      result: ok ? 'PASS' : 'FAIL',
    });
  }
}

console.log('Forma accent-theme contrast gate (WCAG 2.2)\n');
console.table(rows);

if (failed) {
  console.error('\nFAIL: one or more accent themes did not meet the thresholds.');
  process.exit(1);
}
console.log('\nAll accent themes PASS in light and dark.');
