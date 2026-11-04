'use strict';

/* ---------- Side panel ---------- */

function field(lbl, key, value, kind = 'len') {
  if (kind === 'ro') return `<div class="field"><span class="muted">${lbl}</span><span class="ro">${esc(value)}</span></div>`;
  return `<div class="field"><span class="muted">${lbl}</span><input data-key="${key}" data-kind="${kind}" value="${esc(value)}"></div>`;
}

function renderProps() {
  const el = $('#props');
  const it = getSel();
  const uname = UNITS[state.unit].name;
  const note = `<p class="note">Values in <b>${uname}</b>. You can also type other units, e.g. <code>3.5m</code>, <code>250cm</code>, <code>8'6"</code>, <code>40in</code>.</p>`;
  const actions = `<div class="btnrow"><button data-act="dup">Duplicate</button><button data-act="del">Delete</button></div>` + sendRow();
  const sel = selItems();
  if (sel.length > 1) {
    const count = {};
    for (const i of sel) count[typeLabel(i)] = (count[typeLabel(i)] || 0) + 1;
    const area = sel.filter(i => i.type === 'room').reduce((a, r) => a + roomArea(r), 0);
    const gs = new Set(sel.map(i => i.g));
    const oneGroup = gs.size === 1 && !gs.has(undefined);
    const groupBtns = `<div class="btnrow">` +
      (oneGroup ? '' : `<button data-act="group" title="Ctrl+G">Group</button>`) +
      (sel.some(i => i.g) ? `<button data-act="ungroup" title="Ctrl+Shift+G">Ungroup</button>` : '') + `</div>`;
    el.innerHTML = `<h3>${oneGroup ? `Group · ${sel.length} items` : `${sel.length} items selected`}</h3>` +
      Object.entries(count).map(([n, c]) => field(n, '', String(c), 'ro')).join('') +
      (area ? field('Room area', '', fmtArea(area), 'ro') : '') + groupBtns + actions +
      `<p class="note">Drag any selected item to move them all. Arrow keys nudge (Shift = ×10). Shift+click adds/removes.` +
      (oneGroup ? ' Double-click an item to select it within the group.' : '') + `</p>`;
    return;
  }
  if (!it) {
    el.innerHTML = `<p class="muted">No object selected.</p><h3>Defaults</h3>` +
      field('Wall thickness', 'def.wallT', fmtVal(state.def.wallT)) +
      field('Door width', 'def.doorW', fmtVal(state.def.doorW)) +
      field('Window width', 'def.winW', fmtVal(state.def.winW)) + note;
    return;
  }
  let html = '';
  if (it.type === 'wall') {
    const L = Math.hypot(it.x2 - it.x1, it.y2 - it.y1);
    const ang = (-Math.atan2(it.y2 - it.y1, it.x2 - it.x1) * 180 / Math.PI + 360) % 360;
    html = `<h3>Wall</h3>` + field('Length', 'len', fmtVal(L)) +
      field('Angle (°)', 'ang', num(ang, 2), 'num') + field('Thickness', 't', fmtVal(it.t));
  } else if (it.type === 'text') {
    html = `<h3>Text</h3>` +
      `<div class="field field-wide"><span class="muted">Text</span><textarea data-key="text" data-kind="text" rows="2">${esc(it.text)}</textarea></div>` +
      field('Height', 'size', fmtVal(it.size)) + field('Rotation (°)', 'rot', num(it.rot || 0, 2), 'num') +
      `<div class="btnrow"><button data-act="bold" class="${it.bold ? 'on' : ''}">Bold</button></div>` +
      `<p class="note">Height is real-world size, so text prints to scale (e.g. 250 mm = 2.5 mm at 1:100).</p>`;
  } else if (it.type === 'north') {
    html = `<h3>North Arrow</h3>` + field('Size', 'size', fmtVal(it.size)) + field('Rotation (°)', 'rot', num(it.rot || 0, 2), 'num');
  } else if (it.type === 'room' && it.pts) {
    html = `<h3>Room (polygon)</h3>` + field('Name', 'name', it.name || '', 'text') +
      field('Area', '', fmtArea(polyArea(it.pts)), 'ro') +
      field('Perimeter', '', fmt(polyPerimeter(it.pts)), 'ro') +
      field('Corners', '', String(it.pts.length), 'ro') +
      `<p class="note">Drag the corner handles to reshape.</p>`;
  } else if (it.type === 'room') {
    html = `<h3>Room</h3>` + field('Name', 'name', it.name || '', 'text') +
      field('Width', 'w', fmtVal(it.w)) + field('Depth', 'h', fmtVal(it.h)) +
      field('Area', '', fmtArea(it.w * it.h), 'ro') +
      field('Perimeter', '', fmt(2 * (it.w + it.h)), 'ro');
  } else if (isOpening(it)) {
    const def = OPENINGS[it.type];
    html = `<h3>${def.name}</h3>` + field('Width', 'w', fmtVal(it.w));
    if (it.type === 'double_uneven') {
      const a = it.w * (it.split ?? 0.75);
      html += field('Large leaf', 'main', fmtVal(a)) + field('Small leaf', '', fmt(it.w - a), 'ro');
    }
    html += field('Rotation (°)', 'rot', num(it.rot || 0, 2), 'num') + field('Wall thickness', 't', fmtVal(it.t));
    if (def.fx || def.fy) {
      html += `<div class="btnrow">${def.fx ? `<button data-act="fx">${def.fx}</button>` : ''}${def.fy ? `<button data-act="fy">${def.fy}</button>` : ''}</div>`;
    }
  } else if (it.type === 'dim') {
    html = `<h3>Dimension</h3>` + field('Length', '', fmt(Math.hypot(it.x2 - it.x1, it.y2 - it.y1)), 'ro');
    if (state.unit !== 'mm') html += field('', '', fmt(Math.hypot(it.x2 - it.x1, it.y2 - it.y1), 'mm'), 'ro');
  } else if (it.type === 'furn') {
    const def = FURN[it.kind];
    html = `<h3>${esc(def?.name ?? 'Furniture')}</h3>` + field('Name', 'name', it.name ?? def?.name ?? '', 'text') +
      field('Width', 'w', fmtVal(it.w)) + field('Depth', 'd', fmtVal(it.d)) +
      field('Rotation (°)', 'rot', num(it.rot || 0, 2), 'num') +
      `<div class="btnrow"><button data-act="fx">Mirror</button></div>`;
  }
  if (it.g) {
    html += `<p class="note">This item is part of a group.</p><div class="btnrow"><button data-act="ungroup">Remove from group</button></div>`;
  }
  el.innerHTML = html + actions + (it.type !== 'dim' ? note : '');
}

// After placing a text label, jump straight into editing it
function focusTextField() {
  const t = $('#props textarea[data-key="text"]');
  if (t) { t.focus(); t.select(); }
}

function typeLabel(i) {
  if (i.type === 'room') return 'Room';
  if (i.type === 'wall') return 'Wall';
  if (i.type === 'dim') return 'Dimension';
  if (i.type === 'furn') return FURN[i.kind]?.name ?? 'Furniture';
  if (i.type === 'text') return 'Text';
  if (i.type === 'north') return 'North Arrow';
  return OPENINGS[i.type]?.name ?? i.type;
}

function sendRow() {
  const others = state.sheets.filter(s => s.id !== state.cur);
  if (!others.length) return '';
  return `<h3>Send to sheet</h3><div class="sendrow"><select id="sendTo">` +
    others.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('') +
    `</select><button data-act="sendCopy">Copy</button><button data-act="sendMove">Move</button></div>`;
}

function applyField(key, kind, raw) {
  const it = getSel();
  let v;
  if (kind === 'len') { v = parseLength(raw); if (!(v > 0)) return renderProps(); }
  else if (kind === 'num') { v = parseFloat(String(raw).replace(',', '.')); if (!isFinite(v)) return renderProps(); }
  else v = raw;

  if (key.startsWith('def.')) {
    state.def[key.slice(4)] = v;
    persist();
    renderProps();
    return;
  }
  if (!it) return;
  commit();
  if (it.type === 'wall') {
    const L = Math.hypot(it.x2 - it.x1, it.y2 - it.y1);
    let a = Math.atan2(it.y2 - it.y1, it.x2 - it.x1);
    let len = L;
    if (key === 'len') len = v;
    if (key === 'ang') a = -v * Math.PI / 180;
    if (key === 't') { it.t = v; state.def.wallT = v; }
    it.x2 = it.x1 + Math.cos(a) * len;
    it.y2 = it.y1 + Math.sin(a) * len;
  } else if (it.type === 'room') {
    if (key === 'name') it.name = v;
    else it[key] = v;
  } else if (key === 'main') {
    it.split = clamp(v / it.w, 0.05, 0.95);
  } else {
    it[key] = v;
  }
  changed();
}

$('#props').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.key) applyField(t.dataset.key, t.dataset.kind, t.value);
});
$('#props').addEventListener('keydown', e => {
  // Enter commits (Shift+Enter = new line in the text box)
  if (e.key === 'Enter' && !e.shiftKey && e.target.dataset.key) { e.preventDefault(); e.target.blur(); }
});
$('#props').addEventListener('click', e => {
  const act = e.target.dataset?.act;
  if (!act) return;
  if (act === 'del') return deleteSel();
  if (act === 'dup') return duplicateSel();
  if (act === 'sendCopy' || act === 'sendMove') return sendSelTo($('#sendTo').value, act === 'sendMove');
  if (act === 'group') return groupSel();
  if (act === 'ungroup') return ungroupSel();
  const it = getSel();
  if (!it) return;
  commit();
  if (act === 'bold') it.bold = !it.bold;
  else it[act] = -(it[act] || 1);
  changed();
});

function renderSummary() {
  const rooms = state.items.filter(i => i.type === 'room');
  const walls = state.items.filter(i => i.type === 'wall');
  const wallLen = walls.reduce((a, w) => a + Math.hypot(w.x2 - w.x1, w.y2 - w.y1), 0);
  const total = rooms.reduce((a, r) => a + roomArea(r), 0);
  let html = '';
  if (rooms.length) {
    html += `<table><thead><tr><th>Room</th><th class="num">Size</th><th class="num">Area</th></tr></thead><tbody>`;
    for (const r of rooms) {
      const size = r.pts ? `${r.pts.length} sides` : `${fmt(r.w)} × ${fmt(r.h)}`;
      html += `<tr><td>${esc(r.name || 'Room')}</td><td class="num">${esc(size)}</td><td class="num">${fmtArea(roomArea(r))}</td></tr>`;
    }
    html += `</tbody><tfoot><tr><td>Total</td><td></td><td class="num">${fmtArea(total)}</td></tr></tfoot></table>`;
  } else {
    html += `<p class="muted">No rooms yet.</p>`;
  }
  html += `<p class="note">${walls.length} ${walls.length === 1 ? 'wall' : 'walls'} · total length ${esc(fmt(wallLen))}</p>`;
  $('#summary').innerHTML = html;
  $('#sumTitle').textContent = `Summary — ${curSheet()?.name ?? ''}`;
  renderUnderlayPanel();
}
