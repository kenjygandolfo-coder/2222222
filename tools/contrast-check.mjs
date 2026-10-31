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

// --- Accent palette (burgundy is the permanent identity; the olive/cream swatch
// accents were removed). Surfaces come from the base :root / dark blocks: ---
const SURF = {
  light: { card: '#FBF7EE', bg: '#ECE5D6' },
  // FEAT-002: the dark theme is now a deep WINE field, not warm charcoal.
  // card = --cardd hsl(353 32% 14%) = #2F181B ; bg = --bgd hsl(353 40% 10%) = #240F12.
  dark:  { card: '#2F181B', bg: '#240F12' },
};

// burgundy is the ONLY (and permanent) identity (no CSS override): these are
// today's values.
const THEMES = {
  burgundy: {
    light: { pri: '#5C1A22', onpri: '#F8F2E7', data1: '#5C1A22' },
    dark:  { pri: '#A8404F', onpri: '#F3EAD9', data1: '#BF4A5B' },
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

// --- Macro-ladder non-text check (1.4.11): --data-2 (carbs) / --data-3 (fat)
// each >= 3:1 against --card in light AND dark. Light hexes come from :root,
// dark hexes from the two identical dark blocks in index.html. ---
const MACRO = {
  light: { 'data-2': '#7A8FB5', 'data-3': '#6F7340' },
  dark:  { 'data-2': '#8F9BB5', 'data-3': '#DCD5B8' },
};
const macroRows = [];
for (const scheme of ['light', 'dark']) {
  const card = SURF[scheme].card;
  for (const [token, hex] of Object.entries(MACRO[scheme])) {
    const r = ratio(hex, card);
    const ok = r >= AA_NON;
    if (!ok) failed = true;
    macroRows.push({ token, scheme, hex, 'vs card(>=3)': R(r), result: ok ? 'PASS' : 'FAIL' });
  }
}
console.log('\nMacro data tokens vs --card (WCAG 2.2 1.4.11)\n');
console.table(macroRows);

// --- FEAT-002: LIGHT .wine card locals (cream-on-wine) vs the wine surface ---
// The .card.wine selector in index.html / gymapp.html redefines local tokens on a
// #5C1A22 surface. KEEP THESE HEXES IN SYNC WITH THE .card.wine CSS block.
const WINE_LIGHT = '#5C1A22';
const wineLightRows = [];
function wineRow(label, fg, bg, min) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed = true;
  wineLightRows.push({ element: label, fg, bg, [`vs(>=${min})`]: R(r), result: ok ? 'PASS' : 'FAIL' });
}
wineRow('ink',        '#F3EAD9', WINE_LIGHT, AA_TEXT);
wineRow('mut',        '#E3D6C2', WINE_LIGHT, AA_TEXT);
wineRow('border',     '#B88A92', WINE_LIGHT, AA_NON);
wineRow('data-1',     '#F3EAD9', WINE_LIGHT, AA_NON);
wineRow('data-2',     '#A8AE78', WINE_LIGHT, AA_NON);
// olv-t is the olive accent that .big KPI numbers, .hst chip text, .crd .cur span
// and the Water gauge number/arc-start all paint themselves with. The .card.wine
// block repoints it to cream #F3EAD9 so these focal elements stay legible on wine.
wineRow('olv-t',      '#F3EAD9', WINE_LIGHT, AA_TEXT);
// .hst status chip: .card.wine also repoints --card to wine #5C1A22, so the chip
// tint background is color-mix(olv-t 16%, card) = #743B3F; its cream text must clear
// 4.5:1 against that actual painted background.
wineRow('hst chip',   '#F3EAD9', '#743B3F', AA_TEXT);
// .note.info heading: the local wine --card re-tints the note background to
// color-mix(in srgb, var(--info) 12%, #5C1A22) = #5F2730 (--info is #748796). The
// .card.wine block repoints --info-fg to cream #F3EAD9 so the Weekly plan spill
// ("Could not fit this week") heading clears 4.5:1 on that wine-tinted ground.
wineRow('info-fg',    '#F3EAD9', '#5F2730', AA_TEXT);
wineRow('ok-fg',      '#72CC8D', WINE_LIGHT, AA_TEXT);
wineRow('err-fg',     '#EB8C7E', WINE_LIGHT, AA_TEXT);
wineRow('warn-fg',    '#CBA362', WINE_LIGHT, AA_TEXT);
// inverted primary button: wine text on cream fill
wineRow('btn.p text', '#5C1A22', '#F3EAD9', AA_TEXT);
// FEAT-002 review fix: the Trends stat tiles (.tile) now take the same wine surface in
// LIGHT mode. Their number (.tile b), label (.tile span), the ::before accent bar and
// the tile border all paint directly on the #5C1A22 tile surface, so validate each pair.
wineRow('tile num',   '#F3EAD9', WINE_LIGHT, AA_TEXT);  // .tile b cream number
wineRow('tile label', '#E3D6C2', WINE_LIGHT, AA_TEXT);  // .tile span cream-muted label
wineRow('tile accent','#A8AE78', WINE_LIGHT, AA_NON);   // .tile::before green accent bar
wineRow('tile border','#B88A92', WINE_LIGHT, AA_NON);   // .tile border
console.log('\nLight .wine card locals vs #5C1A22 surface (WCAG 2.2)\n');
console.table(wineLightRows);

// --- FEAT-002: DARK wine surface tokens vs the #2F181B card ---
// KEEP THESE HEXES IN SYNC WITH THE TWO DARK BLOCKS in index.html / gymapp.html.
const DARK_CARD = SURF.dark.card;   // #2F181B
const darkWineRows = [];
function darkRow(label, fg, min) {
  const r = ratio(fg, DARK_CARD);
  const ok = r >= min;
  if (!ok) failed = true;
  darkWineRows.push({ element: label, fg, card: DARK_CARD, [`vs(>=${min})`]: R(r), result: ok ? 'PASS' : 'FAIL' });
}
darkRow('ink',        '#D2CBBC', AA_TEXT);  // actual shipped dark --ink
darkRow('mut',        '#B7A4A6', AA_TEXT);  // hsl(353 12% 68%)
darkRow('line-ui',    '#91787B', AA_NON);   // hsl(353 10% 52%)
darkRow('data-1',     '#BF4A5B', AA_NON);   // 3.43:1 at 14% L; FAILS if card lightened past ~17%
// dark .btn.p is a CREAM fill with WINE text, so measure wine text vs the cream
// fill (#F3EAD9), NOT vs the card. Pushed through wineRow-style inline check.
{
  const r = ratio('#5C1A22', '#F3EAD9');
  const ok = r >= AA_TEXT;
  if (!ok) failed = true;
  darkWineRows.push({ element: 'btn.p text', fg: '#5C1A22', card: '#F3EAD9', 'vs(>=4.5)': R(r), result: ok ? 'PASS' : 'FAIL' });
}
// enforce the 17% dark-card luminosity ceiling: a lighter card pushes --data-1
// (#BF4A5B) below the 3:1 non-text gate (at ~20% L it is ~2.88:1).
const cardL = lum(DARK_CARD);
const CEIL = 0.17;
const ceilOk = cardL <= CEIL;
if (!ceilOk) failed = true;
darkWineRows.push({
  element: 'card L<=17%',
  fg: DARK_CARD,
  card: DARK_CARD,
  'vs(>=3)': R(cardL * 100),
  result: ceilOk ? 'PASS' : 'FAIL',
});
console.log('\nDark wine surface tokens vs #2F181B card (WCAG 2.2; card luminosity ceiling 17%)\n');
console.table(darkWineRows);

if (failed) {
  console.error('\nFAIL: one or more contrast checks did not meet the thresholds.');
  process.exit(1);
}
console.log('\nAll accent themes + light/dark wine surfaces PASS.');
