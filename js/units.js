'use strict';

/* ---------- Units (all coordinates stored in mm) ---------- */

const UNITS = {
  mm:   { f: 1,     dp: 0, name: 'mm' },
  cm:   { f: 10,    dp: 1, name: 'cm' },
  m:    { f: 1000,  dp: 3, name: 'm' },
  in:   { f: 25.4,  dp: 2, name: 'in' },
  ft:   { f: 304.8, dp: 3, name: 'ft' },
  ftin: { f: 304.8, dp: 0, name: 'ft-in' },
};
const SUFFIX = {
  mm: 1, cm: 10, m: 1000,
  in: 25.4, inch: 25.4, inches: 25.4, '"': 25.4,
  ft: 304.8, feet: 304.8, "'": 304.8,
};
const isImperial = u => u === 'in' || u === 'ft' || u === 'ftin';
const STORE_KEY = 'floorplan.v1';

const num = (v, dp) => String(+v.toFixed(dp));

function fmt(mm, unit = state.unit) {
  if (unit === 'ftin') {
    const sign = mm < 0 ? '-' : '';
    const eighths = Math.round(Math.abs(mm) / 25.4 * 8);
    const ft = Math.floor(eighths / 96);
    const rem = eighths - ft * 96;
    const inch = Math.floor(rem / 8);
    let fr = rem % 8, d = 8, frac = '';
    if (fr) {
      while (fr % 2 === 0) { fr /= 2; d /= 2; }
      frac = ` ${fr}/${d}`;
    }
    return `${sign}${ft}' ${inch}${frac}"`;
  }
  const u = UNITS[unit];
  return `${num(mm / u.f, u.dp)} ${u.name}`;
}

// Value for input boxes (no unit label except ft-in)
function fmtVal(mm) {
  if (state.unit === 'ftin') return fmt(mm);
  const u = UNITS[state.unit];
  return num(mm / u.f, u.dp);
}

function fmtArea(mm2) {
  if (isImperial(state.unit)) return `${num(mm2 / (304.8 * 304.8), 2)} ft²`;
  return `${num(mm2 / 1e6, 2)} m²`;
}

// Accepts "3.5", "350cm", "12'6\"", "12' 6 1/2\"", "8ft", "40in" ...
function parseLength(str, unit = state.unit) {
  const s = String(str ?? '').trim().toLowerCase().replace(/,/g, '.');
  if (!s) return NaN;
  let m = s.match(/^(-?\d*\.?\d+)\s*(?:'|ft|feet)\s*(?:(\d*\.?\d+)?(?:\s*(\d+)\/(\d+))?\s*(?:"|inches|inch|in)?)?$/);
  if (m) {
    let inch = m[2] ? parseFloat(m[2]) : 0;
    if (m[3]) inch += parseFloat(m[3]) / parseFloat(m[4]);
    const ft = parseFloat(m[1]);
    const sign = s.startsWith('-') ? -1 : 1;
    return sign * (Math.abs(ft) * 12 + inch) * 25.4;
  }
  m = s.match(/^(-?\d*\.?\d+)\s*(mm|cm|m|inches|inch|in|"|feet|ft|')?$/);
  if (!m) return NaN;
  return parseFloat(m[1]) * (m[2] ? SUFFIX[m[2]] : UNITS[unit].f);
}
