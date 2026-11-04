'use strict';

/* ---------- Quantities (BQ) → CSV for Excel / Google Sheets ---------- */

// Openings that interrupt the skirting (all doors + cased opening); the rest are windows
const DOOR_TYPES = ['door', 'double', 'double_uneven', 'bifold1', 'bifold', 'slide2', 'slide3', 'pocket', 'roller', 'opening'];
// Cabinets measured as a running length (L-shapes: both legs minus the shared corner)
const RUN_ITEMS = { kcab: 600, kcab_l: 600, upper_cab: 350, upper_cab_l: 350, island: 0 };

// Distance from point to segment
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy;
  const t = L2 ? clamp(((px - ax) * vx + (py - ay) * vy) / L2, 0, 1) : 0;
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}

// Openings sitting on a room's boundary (the room side of their wall)
function roomOpenings(r, items) {
  const pts = roomPts(r);
  return items.filter(o => isOpening(o) && pts.some((a, i) => {
    const b = pts[(i + 1) % pts.length];
    return segDist(o.x, o.y, a[0], a[1], b[0], b[1]) <= o.t / 2 + 60;
  }));
}

// Rows [{ cat, item, qty, unit }] for one sheet's items. Lengths in mm / areas in mm² until formatted.
function computeBQ(items) {
  const d = state.def, rows = [];
  const rooms = items.filter(i => i.type === 'room');
  const walls = items.filter(i => i.type === 'wall');
  let floor = 0, skirting = 0, paint = 0;

  for (const r of rooms) {
    const name = r.name || 'Room', ops = roomOpenings(r, items);
    const doors = ops.filter(o => DOOR_TYPES.includes(o.type)), wins = ops.filter(o => !DOOR_TYPES.includes(o.type));
    const area = roomArea(r), per = roomPerimeter(r);
    const sk = Math.max(0, per - doors.reduce((a, o) => a + o.w, 0));
    const wall = Math.max(0, per * d.ceilH - doors.reduce((a, o) => a + o.w * d.doorH, 0) - wins.reduce((a, o) => a + o.w * d.winH, 0));
    rows.push({ cat: 'Floor', item: name, qty: area, unit: 'area' });
    rows.push({ cat: 'Skirting', item: name, qty: sk, unit: 'len' });
    rows.push({ cat: 'Wall finish (paint)', item: name, qty: wall, unit: 'area' });
    floor += area; skirting += sk; paint += wall;
  }
  if (rooms.length) {
    rows.push({ cat: 'Floor', item: 'Total floor area', qty: floor, unit: 'area', total: true });
    rows.push({ cat: 'Skirting', item: 'Total skirting', qty: skirting, unit: 'len', total: true });
    rows.push({ cat: 'Wall finish (paint)', item: 'Total wall finish', qty: paint, unit: 'area', total: true });
  }

  if (walls.length) {
    rows.push({ cat: 'Walls', item: 'Wall length (centreline)', qty: walls.reduce((a, w) => a + Math.hypot(w.x2 - w.x1, w.y2 - w.y1), 0), unit: 'len' });
    const byT = {};
    for (const w of walls) byT[w.t] = (byT[w.t] || 0) + Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    for (const [t, len] of Object.entries(byT)) rows.push({ cat: 'Walls', item: `Wall ${fmt(+t)} thick`, qty: len, unit: 'len' });
  }

  // Count items grouped by name + size
  const count = (cat, list, label) => {
    const g = new Map();
    for (const it of list) {
      const k = label(it);
      g.set(k, (g.get(k) || 0) + 1);
    }
    for (const [k, n] of [...g].sort()) rows.push({ cat, item: k, qty: n, unit: 'no.' });
  };
  const ops = items.filter(isOpening);
  count('Doors & openings', ops.filter(o => DOOR_TYPES.includes(o.type)), o => `${OPENINGS[o.type].name} — ${fmt(o.w)}`);
  count('Windows', ops.filter(o => !DOOR_TYPES.includes(o.type)), o => `${OPENINGS[o.type].name} — ${fmt(o.w)}`);

  const furn = items.filter(i => i.type === 'furn' && FURN[i.kind]);
  const isElec = f => FURN[f.kind].cat === 'electrical';
  count('Electrical', furn.filter(isElec), f => FURN[f.kind].name);
  count('Furniture & fixtures', furn.filter(f => !isElec(f)), f => `${FURN[f.kind].name} — ${fmt(f.w)} × ${fmt(f.d)}`);

  // Cabinet running lengths
  const runs = {};
  for (const f of furn) {
    if (!(f.kind in RUN_ITEMS)) continue;
    const len = f.kind.endsWith('_l') ? f.w + f.d - Math.min(RUN_ITEMS[f.kind], f.w, f.d) : f.w;
    const nm = FURN[f.kind].name.replace(/^L-Shaped /, '');
    runs[nm] = (runs[nm] || 0) + len;
  }
  for (const [nm, len] of Object.entries(runs)) rows.push({ cat: 'Cabinet runs', item: nm, qty: len, unit: 'len' });
  return rows;
}

// Quantity → number in the display unit (m / m² for metric, ft / ft² for imperial)
function bqValue(row) {
  const imp = isImperial(state.unit);
  if (row.unit === 'area') return { v: +(row.qty / (imp ? 304.8 * 304.8 : 1e6)).toFixed(2), u: imp ? 'ft²' : 'm²' };
  if (row.unit === 'len') return { v: +(row.qty / (imp ? 304.8 : 1000)).toFixed(2), u: imp ? 'ft' : 'm' };
  return { v: row.qty, u: row.unit };
}

function bqSheets() {
  syncSheet();
  return $('#bqSheets').value === 'all' ? state.sheets : [curSheet()];
}

function renderBQ() {
  for (const k of ['ceilH', 'doorH', 'winH']) {
    const v = parseLength($('#bq_' + k).value);
    if (v > 0) state.def[k] = v;
  }
  const sheets = bqSheets(), multi = sheets.length > 1;
  let html = `<table><thead><tr>${multi ? '<th>Sheet</th>' : ''}<th>Category</th><th>Item</th><th class="num">Qty</th><th>Unit</th></tr></thead><tbody>`;
  let any = false;
  for (const s of sheets) {
    for (const row of computeBQ(s.items)) {
      const { v, u } = bqValue(row);
      any = true;
      html += `<tr class="${row.total ? 'tot' : ''}">${multi ? `<td>${esc(s.name)}</td>` : ''}<td>${esc(row.cat)}</td><td>${esc(row.item)}</td><td class="num">${v}</td><td>${u}</td></tr>`;
    }
  }
  $('#bqTable').innerHTML = any ? html + '</tbody></table>' : '<p class="muted">Nothing to measure yet — draw rooms, walls, doors or furniture first.</p>';
}

function bqCSV() {
  const q = v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = [['Sheet', 'Category', 'Item', 'Quantity', 'Unit'].join(',')];
  for (const s of bqSheets()) {
    for (const row of computeBQ(s.items)) {
      const { v, u } = bqValue(row);
      lines.push([s.name, row.cat, row.item, v, u].map(q).join(','));
    }
  }
  // BOM so Excel reads UTF-8 (m², ×, —) correctly
  return '﻿' + lines.join('\r\n') + '\r\n';
}

function openBQ() {
  for (const k of ['ceilH', 'doorH', 'winH']) $('#bq_' + k).value = fmtVal(state.def[k]);
  $('#bqUnitNote').textContent = UNITS[state.unit].name;
  $('#bqSheets').disabled = state.sheets.length < 2;
  renderBQ();
  $('#bqDlg').showModal();
}

$('#bq').addEventListener('click', openBQ);
$('#bqDlg').addEventListener('change', () => { renderBQ(); persist(); });
$('#bqDownload').addEventListener('click', e => {
  e.preventDefault();
  renderBQ();
  const name = $('#bqSheets').value === 'all' ? 'all-sheets' : (curSheet()?.name || 'sheet').replace(/[^\w\-]+/g, '_');
  download(new Blob([bqCSV()], { type: 'text/csv;charset=utf-8' }), `floorplan-bq-${name}.csv`);
});
