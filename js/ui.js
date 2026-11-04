'use strict';

/* ---------- Toolbar ---------- */

// Theme follows the OS setting until the user picks one with the toggle (remembered)
const isDarkTheme = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};
$('#theme').addEventListener('click', () => {
  const t = isDarkTheme() ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('floorplan.theme', t); } catch { /* storage unavailable */ }
});

function syncOptions() {
  $('#unit').value = state.unit;
  $('#snap').value = fmtVal(state.snap);
  $('#ortho').checked = state.ortho;
  $('#labels').checked = state.labels;
}

/* ---------- Tool palette: click, double-click, drag & drop ---------- */

let palDrag = null, suppressClick = false;

function overCanvas(e) {
  const r = svg.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}

function dropTool(d, e) {
  const p = toWorld(e);
  if (isPlaceTool(d.tool)) {
    const o = d.item || newPlaced(d.tool);
    placeItem(o, p, e);
    guides = [];
    commit();
    state.items.push(o);
    state.sel = [o.id];
    if (!state.sticky) setTool('select');
    changed();
    if (o.type === 'text') focusTextField();
    return;
  }
  // Wall / Dimension / Polygon room: the drop point becomes the first point.
  // Auto room: fill the space under the drop point. Rectangle room: just activate the tool.
  setTool(d.tool);
  if (d.tool === 'room_auto') return autoRoom(p);
  if (d.tool === 'room_poly') return startPoly(snapPoint(p, e));
  if (d.tool !== 'room') {
    const q = snapPoint(p, e);
    draft = { type: d.tool, x1: q.x, y1: q.y, x2: q.x, y2: q.y };
    render();
  }
}

/* Build the palette: collapsible categories + search */
const PALETTE = [
  ...PALETTE_BASE,
  ...FURN_CATS.map(c => ({
    id: c.id, name: c.name, kw: c.kw,
    tools: Object.keys(FURN).filter(k => FURN[k].cat === c.id).map(k => 'furn:' + k),
  })),
];
const PAL_KEY = 'floorplan.palSections';
let palSecOpen = { basic: true, openings: true };
try { Object.assign(palSecOpen, JSON.parse(localStorage.getItem(PAL_KEY)) || {}); } catch { /* ignore */ }

$('#tools').innerHTML = PALETTE.map(sec =>
  `<div class="pal-sec${palSecOpen[sec.id] ? ' open' : ''}" data-sec="${sec.id}">` +
  `<button class="pal-sec-head"><span class="chev">▸</span><span class="sec-name">${esc(sec.name)}</span><span class="cnt">${sec.tools.length}</span></button>` +
  `<div class="pal-grid">` + sec.tools.map(t => {
    const m = toolInfo(t);
    const kw = `${m.label} ${m.kw} ${sec.name} ${sec.kw}`.toLowerCase();
    return `<button class="tool" data-tool="${t}" data-kw="${esc(kw)}" title="${esc(m.title)}">${m.icon}<span>${esc(m.label)}</span></button>`;
  }).join('') + `</div></div>`).join('');

$('#tools').addEventListener('click', e => {
  const head = e.target.closest('.pal-sec-head');
  if (!head || $('#palSearch').value.trim()) return;
  const sec = head.parentElement;
  sec.classList.toggle('open');
  palSecOpen[sec.dataset.sec] = sec.classList.contains('open');
  try { localStorage.setItem(PAL_KEY, JSON.stringify(palSecOpen)); } catch { /* ignore */ }
});

function filterPalette() {
  const q = $('#palSearch').value.trim().toLowerCase();
  let anyAll = false;
  for (const sec of document.querySelectorAll('.pal-sec')) {
    let any = false;
    for (const b of sec.querySelectorAll('.tool')) {
      const m = !q || b.dataset.kw.includes(q);
      b.hidden = !m;
      any ||= m;
    }
    sec.hidden = !any;
    // While searching, every category with a match is expanded
    sec.classList.toggle('open', q ? true : !!palSecOpen[sec.dataset.sec]);
    anyAll ||= any;
  }
  $('#palEmpty').hidden = anyAll;
}
$('#palSearch').addEventListener('input', filterPalette);
$('#palSearch').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.target.value = ''; filterPalette(); e.target.blur(); }
  if (e.key === 'Enter') {
    // Enter = activate the first match
    const first = [...document.querySelectorAll('#tools .tool')].find(b => !b.hidden && !b.closest('.pal-sec').hidden);
    if (first) { setTool(first.dataset.tool); e.target.blur(); }
  }
});

document.querySelectorAll('#tools .tool').forEach(b => {
  const tool = b.dataset.tool;
  b.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    setTool(tool);
  });
  b.addEventListener('dblclick', () => setTool(tool, true));
  if (tool === 'select') return;

  b.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    b.setPointerCapture(e.pointerId);
    palDrag = { tool, sx: e.clientX, sy: e.clientY, ghost: null, item: null };
  });

  b.addEventListener('pointermove', e => {
    const d = palDrag;
    if (!d) return;
    if (!d.ghost) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
      d.ghost = document.createElement('div');
      d.ghost.className = 'drag-ghost';
      d.ghost.innerHTML = b.innerHTML;
      document.body.append(d.ghost);
      document.body.classList.add('pal-dragging');
    }
    d.ghost.style.left = e.clientX + 'px';
    d.ghost.style.top = e.clientY + 'px';
    // Live preview on the canvas (doors/windows stick to walls)
    if (isPlaceTool(tool)) {
      const over = overCanvas(e);
      d.ghost.hidden = over;
      if (over) {
        d.item ||= newPlaced(tool);
        placeItem(d.item, toWorld(e), e);
        draft = { type: 'place', item: d.item };
      } else if (draft?.type === 'place') {
        draft = null;
      }
      render();
    }
  });

  const end = (e, cancelled) => {
    const d = palDrag;
    palDrag = null;
    if (!d?.ghost) return; // plain click — handled by the click event
    d.ghost.remove();
    document.body.classList.remove('pal-dragging');
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    guides = [];
    if (draft?.type === 'place') draft = null;
    if (cancelled || !overCanvas(e)) return render();
    dropTool(d, e);
  };
  b.addEventListener('pointerup', e => end(e, false));
  b.addEventListener('pointercancel', e => end(e, true));
});

function setPalette(open) {
  $('#main').classList.toggle('pal-collapsed', !open);
  $('#palOpen').hidden = open;
  try { localStorage.setItem('floorplan.palette', open ? '1' : '0'); } catch { /* ignore */ }
}
$('#palClose').addEventListener('click', () => setPalette(false));
$('#palOpen').addEventListener('click', () => setPalette(true));

$('#unit').addEventListener('change', e => {
  const prev = state.unit;
  state.unit = e.target.value;
  if (isImperial(prev) !== isImperial(state.unit)) state.snap = isImperial(state.unit) ? 152.4 : 100;
  syncOptions();
  persist();
  render();
  renderProps();
  renderSummary();
  e.target.blur();
});
$('#snap').addEventListener('change', e => {
  const v = parseLength(e.target.value);
  if (v > 0) { state.snap = v; persist(); render(); }
  syncOptions();
});
$('#snap').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
$('#ortho').addEventListener('change', e => { state.ortho = e.target.checked; e.target.blur(); });
$('#labels').addEventListener('change', e => { state.labels = e.target.checked; render(); e.target.blur(); });
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
$('#fit').addEventListener('click', () => fit());
$('#new').addEventListener('click', () => {
  if (!state.items.length || confirm('Clear the current sheet? (Undo is available)')) {
    commit();
    state.items = [];
    state.sel = [];
    changed();
  }
});
$('#open').addEventListener('click', () => $('#file').click());
$('#save').addEventListener('click', saveFile);
$('#png').addEventListener('click', exportPng);
$('#svgx').addEventListener('click', exportSvg);
