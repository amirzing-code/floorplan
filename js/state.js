'use strict';

/* ---------- State ---------- */

const $ = s => document.querySelector(s);
const svg = $('#svg'), layer = $('#layer');

const state = {
  unit: 'm',
  snap: 100,
  ortho: true,
  labels: true,
  tool: 'select',
  sticky: false,
  // ceilH / doorH / winH are used by the quantities (BQ) for wall-finish areas
  def: { wallT: 150, doorW: 900, winW: 1200, ceilH: 2700, doorH: 2100, winH: 1200 },
  items: [],
  sel: [],
  view: { s: 0.08, ox: 80, oy: 80 },
  // Each sheet: { id, name, items, view }. state.items / state.view = active sheet.
  sheets: [],
  cur: null,
  // Title block fields and print settings (saved with the project)
  meta: { project: '', client: '', drawnBy: '', date: '' },
  print: { paper: 'A3', orient: 'landscape', scale: 'fit', sheets: 'current' },
};

let undoStack = [], redoStack = [];
let draft = null, drag = null, typed = '', snapHit = null, spaceDown = false;
let mouse = { x: 0, y: 0, sx: 0, sy: 0 };

const uid = () => Math.random().toString(36).slice(2, 10);
// Selection = list of ids. getSel() returns an item only when exactly one is selected.
const selItems = () => state.items.filter(i => state.sel.includes(i.id));
const getSel = () => (state.sel.length === 1 && state.items.find(i => i.id === state.sel[0])) || null;
const pruneSel = () => { state.sel = state.sel.filter(id => state.items.some(i => i.id === id)); };

// Item bounding box (mm) — for box selection
function itemBox(it) {
  if ('x1' in it) {
    return { x0: Math.min(it.x1, it.x2), y0: Math.min(it.y1, it.y2), x1: Math.max(it.x1, it.x2), y1: Math.max(it.y1, it.y2) };
  }
  if (it.type === 'room') {
    if (!it.pts) return { x0: it.x, y0: it.y, x1: it.x + it.w, y1: it.y + it.h };
    const xs = it.pts.map(p => p[0]), ys = it.pts.map(p => p[1]);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }
  const a = (it.rot || 0) * Math.PI / 180;
  if (it.type === 'text' || it.type === 'north') {
    // Text: estimated width from character count; north arrow: square of `size`
    const w = it.type === 'text' ? Math.max(1, ...String(it.text).split('\n').map(l => l.length)) * it.size * 0.55 : it.size;
    const h = it.type === 'text' ? String(it.text).split('\n').length * it.size * 1.2 : it.size;
    const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    const ex = c * w / 2 + s * h / 2, ey = s * w / 2 + c * h / 2;
    return { x0: it.x - ex, y0: it.y - ey, x1: it.x + ex, y1: it.y + ey };
  }
  if (it.type === 'furn') {
    const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    const ex = c * it.w / 2 + s * it.d / 2, ey = s * it.w / 2 + c * it.d / 2;
    return { x0: it.x - ex, y0: it.y - ey, x1: it.x + ex, y1: it.y + ey };
  }
  const dx = Math.abs(Math.cos(a)) * it.w / 2, dy = Math.abs(Math.sin(a)) * it.w / 2;
  return { x0: it.x - dx, y0: it.y - dy, x1: it.x + dx, y1: it.y + dy };
}

// Set item position = original position o + (dx, dy)
function shiftItem(it, o, dx, dy) {
  if ('x1' in o) { it.x1 = o.x1 + dx; it.y1 = o.y1 + dy; it.x2 = o.x2 + dx; it.y2 = o.y2 + dy; }
  else if (o.pts) it.pts = o.pts.map(([x, y]) => [x + dx, y + dy]);
  else { it.x = o.x + dx; it.y = o.y + dy; }
}
const shifted = (o, dx, dy) => { const c = { ...o }; shiftItem(c, o, dx, dy); return c; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Wall opening types. w = default width (mm); fx/fy = flip button labels (if applicable)
const OPENINGS = {
  door:          { name: 'Door', w: 900, fx: 'Flip hinge side', fy: 'Flip swing direction' },
  double:        { name: 'Double Door', w: 1500, fy: 'Flip swing direction' },
  double_uneven: { name: 'Unequal Double Door', w: 1200, fx: 'Swap large leaf side', fy: 'Flip swing direction' },
  bifold1:       { name: 'Bi-fold Door', w: 900, fx: 'Flip fold side', fy: 'Flip fold direction' },
  bifold:        { name: 'Double Bi-fold Door', w: 1800, fy: 'Flip fold direction' },
  slide2:        { name: '2-Panel Sliding Door', w: 1800, fx: 'Swap panel order' },
  slide3:        { name: '3-Panel Sliding Door', w: 2400, fx: 'Swap panel order' },
  pocket:        { name: 'Pocket Door', w: 800, fx: 'Flip pocket side' },
  roller:        { name: 'Roller Shutter', w: 2400, fy: 'Flip shutter side' },
  opening:       { name: 'Cased Opening', w: 900 },
  window:        { name: 'Window', w: 1200 },
  slidewin:      { name: 'Sliding Window', w: 1200, fx: 'Swap panel order' },
  louvre:        { name: 'Louvre Window (Nako)', w: 600 },
};
const isOpeningType = t => Object.hasOwn(OPENINGS, t);
const isOpening = it => isOpeningType(it.type);
