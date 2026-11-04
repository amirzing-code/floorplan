'use strict';

/* ---------- Actions ---------- */

const HINTS = {
  select: 'Click to select, Shift+click to add, drag empty space to box-select, Ctrl+A select all. Right-drag / Space+drag to pan.',
  wall: 'Click to start, click again to continue. Type a length + Enter for exact size. Esc / double-click to finish.',
  room: 'Drag to draw a rectangular room.',
  room_poly: 'Click to add corners. Click the first corner, press Enter or double-click to close. Type a length + Enter for an exact edge.',
  room_auto: 'Click inside an area enclosed by walls to create a room that fits it.',
  dim: 'Click two points to measure.',
  calib: 'Calibrate underlay: click two points on the image whose real distance you know.',
  ulmove: 'Drag to move the underlay image. Esc when done.',
  text: 'Click to place a text label, then type it in Properties. Q to rotate.',
  north: 'Click to place a north arrow. Q to rotate 90°, or set any angle in Properties.',
};
for (const [k, o] of Object.entries(OPENINGS)) HINTS[k] = `Click on a wall to place ${o.name}. Q to rotate.`;
for (const [k, f] of Object.entries(FURN)) HINTS['furn:' + k] = `Click on the canvas to place ${f.name}. Q to rotate.`;

function setHint(text, warn) {
  const h = $('#hint');
  let def = HINTS[state.tool];
  if (state.tool !== 'select') def += state.sticky ? ' · Tool locked — Esc to exit.' : ' · Double-click a tool to lock it.';
  h.textContent = text ?? def;
  h.classList.toggle('warn', !!warn);
}

// sticky = tool stays active (double-click); otherwise return to Select after one item is done
function setTool(t, sticky = false) {
  state.tool = t;
  state.sticky = sticky && t !== 'select';
  draft = null; typed = ''; showTyped();
  document.querySelectorAll('#tools .tool').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === t);
    b.classList.toggle('sticky', b.dataset.tool === t && state.sticky);
  });
  svg.classList.toggle('tool-select', t === 'select');
  svg.classList.toggle('tool-ulmove', t === 'ulmove');
  if (typeof renderUnderlayPanel === 'function') renderUnderlayPanel(); // "Move" button state
  setHint();
  render();
}

function doneOnce() {
  if (!state.sticky && state.tool !== 'select') setTool('select');
}

function endDraft() {
  draft = null; typed = ''; showTyped();
  if (!state.sticky && state.tool !== 'select') setTool('select');
  else render();
}

function newOpening(type) {
  const w = type === 'door' ? state.def.doorW : type === 'window' ? state.def.winW : OPENINGS[type].w;
  const o = { id: uid(), type, x: 0, y: 0, rot: 0, fx: 1, fy: 1, w, t: state.def.wallT };
  if (type === 'double_uneven') o.split = 0.75;
  return o;
}

function newFurn(kind) {
  const f = FURN[kind];
  return { id: uid(), type: 'furn', kind, x: 0, y: 0, w: f.w, d: f.d, rot: 0, fx: 1 };
}

// Annotations: text height / arrow size are real-world mm, so they print to scale
function newAnno(tool) {
  if (tool === 'text') return { id: uid(), type: 'text', x: 0, y: 0, text: 'Text', size: 250, bold: false, rot: 0 };
  return { id: uid(), type: 'north', x: 0, y: 0, size: 900, rot: 0 };
}

// New item for placement tools (doors/windows/furniture/annotations)
const newPlaced = tool => (isFurnTool(tool) ? newFurn(tool.slice(5)) : isAnnoTool(tool) ? newAnno(tool) : newOpening(tool));

function placeItem(it, p, e) {
  if (it.type === 'text' || it.type === 'north') {
    it.x = e.altKey ? p.x : snapV(p.x);
    it.y = e.altKey ? p.y : snapV(p.y);
    return;
  }
  if (it.type !== 'furn') return placeOpening(it, p, e);
  it.x = p.x;
  it.y = p.y;
  if (e.altKey) { guides = []; return; }
  // Magnet first (at the actual mouse position); axes without a target → grid snap
  const m = furnMagnet(itemBox(it), [it.id]);
  it.x = m.dx !== null ? p.x + m.dx : snapV(p.x);
  it.y = m.dy !== null ? p.y + m.dy : snapV(p.y);
}

function select(id) {
  state.sel = id ? [id] : [];
  renderProps();
}

/* ---------- Groups (Ctrl+G) ---------- */

// Expand the id list to include all members of related groups
function expandGroups(ids) {
  const gs = new Set(state.items.filter(i => i.g && ids.includes(i.id)).map(i => i.g));
  if (!gs.size) return ids;
  return [...new Set([...ids, ...state.items.filter(i => gs.has(i.g)).map(i => i.id)])];
}

// Remove group ids left with only one member
function cleanGroups() {
  const n = {};
  for (const i of state.items) if (i.g) n[i.g] = (n[i.g] || 0) + 1;
  for (const i of state.items) if (i.g && n[i.g] < 2) delete i.g;
}

function groupSel() {
  const items = selItems();
  if (items.length < 2) return;
  commit();
  const g = uid();
  for (const it of items) it.g = g;
  cleanGroups();
  changed();
  setHint(`${items.length} items grouped. Double-click an item to select it within the group.`);
}

function ungroupSel() {
  const items = selItems().filter(i => i.g);
  if (!items.length) return;
  commit();
  for (const it of items) delete it.g;
  cleanGroups();
  changed();
  setHint();
}

function selectAll() {
  if (state.tool !== 'select') setTool('select');
  state.sel = state.items.map(i => i.id);
  renderProps();
  render();
}

function deleteSel() {
  if (!state.sel.length) return;
  commit();
  const set = new Set(state.sel);
  state.items = state.items.filter(i => !set.has(i.id));
  state.sel = [];
  cleanGroups();
  changed();
}

function duplicateSel() {
  const items = selItems();
  if (!items.length) return;
  commit();
  const copies = cloneItems(items);
  for (const c of copies) {
    offsetItem(c, pasteOffset());
    if (c.type === 'room' && items.length === 1) c.name = (c.name || 'Room') + ' (copy)';
  }
  state.items.push(...copies);
  state.sel = copies.map(c => c.id);
  changed();
}

function nudgeSel(dx, dy) {
  const items = selItems();
  if (!items.length) return;
  commit();
  for (const it of items) shiftItem(it, { ...it }, dx, dy);
  changed();
}

/* ---------- Rooms ---------- */

// Rectangle ({x, y, w, h}) or polygon (array of [x, y]) → new selected room
function createRoom(shape) {
  commit();
  const n = state.items.filter(i => i.type === 'room').length + 1;
  const room = { id: uid(), type: 'room', ...(Array.isArray(shape) ? { pts: shape } : shape), name: `Room ${n}` };
  state.items.push(room);
  state.sel = [room.id];
  changed();
  doneOnce();
}

function startPoly(q) {
  draft = { type: 'poly', pts: [[q.x, q.y]], x1: q.x, y1: q.y, x2: q.x, y2: q.y };
  render();
}

// Add the rubber-band point as the next corner (clicking the first corner closes the room)
function addPolyPoint() {
  const d = draft, [fx, fy] = d.pts[0], [lx, ly] = d.pts.at(-1);
  if (d.pts.length >= 3 && Math.hypot(d.x2 - fx, d.y2 - fy) < 1) return closePoly();
  if (Math.hypot(d.x2 - lx, d.y2 - ly) < 1) return;
  d.pts = [...d.pts, [d.x2, d.y2]];
  d.x1 = d.x2;
  d.y1 = d.y2;
  typed = ''; showTyped();
  render();
}

function closePoly() {
  const pts = draft?.pts ? cleanPoly(draft.pts) : [];
  draft = null; typed = ''; showTyped();
  if (pts.length < 3 || polyArea(pts) < 1) {
    setHint('A room needs at least 3 corners.', true);
    return render();
  }
  createRoom(pts);
}

function autoRoom(p) {
  const pts = detectRoom(p);
  if (!pts) return setHint('No enclosed area here — the walls around this point must form a closed loop.', true);
  createRoom(pts);
  setHint(`Room created: ${fmtArea(polyArea(pts))}.`);
}

function finishSegment() {
  const d = draft;
  if (d.type === 'poly') return addPolyPoint();
  if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 1) return;
  commit();
  const seg = { id: uid(), type: d.type, x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 };
  if (d.type === 'wall') {
    seg.t = state.def.wallT;
    draft = { type: 'wall', x1: d.x2, y1: d.y2, x2: d.x2, y2: d.y2, dir: [d.x2 - d.x1, d.y2 - d.y1] };
  } else {
    draft = null;
  }
  state.items.push(seg);
  typed = ''; showTyped();
  changed();
  if (d.type === 'dim') doneOnce();
}

function showTyped() {
  const el = $('#typed');
  if (!typed) { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = `${typed}  (${UNITS[state.unit].name})`;
  el.style.left = mouse.sx + 14 + 'px';
  el.style.top = mouse.sy + 14 + 'px';
}

function applyTyped() {
  const L = parseLength(typed);
  typed = ''; showTyped();
  if (!(L > 0)) { setHint('Invalid length. Examples: 3.5, 350cm, 12\'6"', true); return; }
  let dx = draft.x2 - draft.x1, dy = draft.y2 - draft.y1;
  if (Math.hypot(dx, dy) < 1e-6) [dx, dy] = draft.dir || [1, 0];
  const d = Math.hypot(dx, dy);
  draft.x2 = draft.x1 + dx / d * L;
  draft.y2 = draft.y1 + dy / d * L;
  finishSegment();
  setHint();
}
