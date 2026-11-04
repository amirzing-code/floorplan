'use strict';

/* ---------- Pointer ---------- */

function startPan(e) {
  drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, ox: state.view.ox, oy: state.view.oy };
  svg.classList.add('panning');
}

svg.addEventListener('pointerdown', e => {
  svg.setPointerCapture(e.pointerId);
  const p = toWorld(e);
  if (e.button === 1 || (e.button === 0 && spaceDown)) { e.preventDefault(); return startPan(e); }
  if (e.button === 2) {
    if (draft?.type === 'poly') return closePoly();
    return draft ? endDraft() : startPan(e);
  }
  if (e.button !== 0) return;

  const tool = state.tool;
  if (tool === 'select') {
    const h = e.target.closest('[data-handle]');
    if (h && getSel()) {
      drag = { mode: 'handle', h: h.dataset.handle, orig: { ...getSel() }, done: false };
      return;
    }
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const el = e.target.closest('[data-id]');
    lastDownId = el?.dataset.id ?? null;
    if (el) {
      const id = el.dataset.id;
      // Click on a group member = select the whole group
      const unit = expandGroups([id]);
      if (additive && state.sel.includes(id)) {
        // Shift+click on a selected item = remove it from the selection
        state.sel = state.sel.filter(x => !unit.includes(x));
        renderProps();
        return render();
      }
      if (additive) state.sel = [...new Set([...state.sel, ...unit])];
      else if (!state.sel.includes(id)) state.sel = unit;
      renderProps();
      const orig = Object.fromEntries(selItems().map(i => [i.id, { ...i }]));
      drag = { mode: 'move', start: p, orig, done: false, unit, additive };
    } else {
      // Drag on empty space = box selection
      if (!additive) state.sel = [];
      renderProps();
      drag = { mode: 'marquee', x0: p.x, y0: p.y, x1: p.x, y1: p.y, base: [...state.sel] };
    }
    return render();
  }

  if (tool === 'wall' || tool === 'dim') {
    if (!draft) {
      const q = snapPoint(p, e);
      draft = { type: tool, x1: q.x, y1: q.y, x2: q.x, y2: q.y };
      render();
    } else {
      finishSegment();
    }
    return;
  }

  if (tool === 'room') {
    const q = snapPoint(p, e);
    drag = { mode: 'room', x0: q.x, y0: q.y };
    draft = { type: 'room', x: q.x, y: q.y, w: 0, h: 0 };
    return render();
  }

  if (tool === 'room_poly') {
    if (draft?.type === 'poly') return addPolyPoint();
    return startPoly(snapPoint(p, e));
  }

  if (tool === 'room_auto') return autoRoom(p);

  // Underlay calibration: two raw clicks (no snapping — image features aren't on the grid)
  if (tool === 'calib') {
    if (draft?.type === 'calib') return finishCalibration();
    draft = { type: 'calib', x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    return render();
  }
  if (tool === 'ulmove' && curUnderlay()) {
    drag = { mode: 'ulmove', start: p, x0: curUnderlay().x, y0: curUnderlay().y };
    return;
  }

  if (isPlaceTool(tool)) {
    const o = newPlaced(tool);
    placeItem(o, p, e);
    guides = [];
    commit();
    state.items.push(o);
    state.sel = [o.id];
    changed();
    doneOnce();
    if (o.type === 'text') focusTextField();
  }
});

svg.addEventListener('pointermove', e => {
  const r = svg.getBoundingClientRect();
  const p = toWorld(e);
  mouse = { x: p.x, y: p.y, sx: e.clientX - r.left, sy: e.clientY - r.top };
  $('#pos').textContent = `X ${fmt(p.x)}   Y ${fmt(p.y)}`;
  if (typed) showTyped();

  if (drag?.mode === 'pan') {
    state.view.ox = drag.ox + e.clientX - drag.sx;
    state.view.oy = drag.oy + e.clientY - drag.sy;
    return render();
  }

  if (draft?.type === 'calib') {
    draft.x2 = p.x; draft.y2 = p.y;
    return render();
  }
  if (drag?.mode === 'ulmove') {
    const u = curUnderlay();
    u.x = drag.x0 + p.x - drag.start.x;
    u.y = drag.y0 + p.y - drag.start.y;
    return updateUnderlay();
  }

  if (draft && (draft.type === 'wall' || draft.type === 'dim' || draft.type === 'poly')) {
    // Polygon rooms also snap to their own placed corners (to close the shape)
    const q = snapPoint(p, e, { x: draft.x1, y: draft.y1 }, null, draft.pts || []);
    draft.x2 = q.x; draft.y2 = q.y;
    return render();
  }

  if (drag?.mode === 'room') {
    const q = snapPoint(p, e);
    draft.x = Math.min(drag.x0, q.x); draft.w = Math.abs(q.x - drag.x0);
    draft.y = Math.min(drag.y0, q.y); draft.h = Math.abs(q.y - drag.y0);
    return render();
  }

  if (drag?.mode === 'marquee') {
    drag.x1 = p.x; drag.y1 = p.y;
    const rx0 = Math.min(drag.x0, drag.x1), rx1 = Math.max(drag.x0, drag.x1);
    const ry0 = Math.min(drag.y0, drag.y1), ry1 = Math.max(drag.y0, drag.y1);
    // Select items fully inside the box
    const inside = new Set(state.items.filter(it => {
      const b = itemBox(it);
      return b.x0 >= rx0 && b.x1 <= rx1 && b.y0 >= ry0 && b.y1 <= ry1;
    }).map(i => i.id));
    // A group is only selected if all its members are inside the box
    const picked = [...inside].filter(id => {
      const g = state.items.find(i => i.id === id).g;
      return !g || state.items.every(j => j.g !== g || inside.has(j.id));
    });
    state.sel = [...new Set([...drag.base, ...picked])];
    return render();
  }

  if (drag?.mode === 'move') {
    let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (!drag.done) {
      if (Math.hypot(dx, dy) * state.view.s < 3) return;
      commit(); drag.done = true;
    }
    const items = selItems();
    guides = [];
    if (items.length === 1 && isOpening(items[0])) {
      // Single door/window: stays attached to the wall
      const o = drag.orig[items[0].id];
      placeOpening(items[0], { x: o.x + dx, y: o.y + dy }, e);
    } else {
      if (!e.altKey && items.every(i => i.type === 'furn')) {
        // Furniture only: magnet to walls / other furniture (using the whole selection box),
        // axes without a target → grid snap
        const bs = items.map(i => itemBox(shifted(drag.orig[i.id], dx, dy)));
        const m = furnMagnet({
          x0: Math.min(...bs.map(b => b.x0)), y0: Math.min(...bs.map(b => b.y0)),
          x1: Math.max(...bs.map(b => b.x1)), y1: Math.max(...bs.map(b => b.y1)),
        }, state.sel);
        dx = m.dx !== null ? dx + m.dx : snapV(dx);
        dy = m.dy !== null ? dy + m.dy : snapV(dy);
      } else if (!e.altKey) {
        dx = snapV(dx);
        dy = snapV(dy);
      }
      for (const it of items) if (drag.orig[it.id]) shiftItem(it, drag.orig[it.id], dx, dy);
    }
    return render();
  }

  const it = getSel();
  if (!it || !drag) return;

  if (drag.mode === 'handle') {
    if (!drag.done) { commit(); drag.done = true; }
    const o = drag.orig;
    if (it.type === 'room' && it.pts) {
      // Polygon corner: replace the array (never mutate pts in place)
      const idx = +drag.h.slice(1), q = snapPoint(p, e, null, it.id);
      it.pts = o.pts.map((v, i) => (i === idx ? [q.x, q.y] : v));
    } else if (it.type === 'room') {
      const q = snapPoint(p, e, null, it.id);
      const ax = drag.h.includes('w') ? o.x + o.w : o.x;
      const ay = drag.h.includes('n') ? o.y + o.h : o.y;
      it.x = Math.min(ax, q.x); it.w = Math.abs(q.x - ax);
      it.y = Math.min(ay, q.y); it.h = Math.abs(q.y - ay);
    } else {
      const other = drag.h === '1' ? { x: o.x2, y: o.y2 } : { x: o.x1, y: o.y1 };
      const q = snapPoint(p, e, other, it.id);
      if (drag.h === '1') { it.x1 = q.x; it.y1 = q.y; } else { it.x2 = q.x; it.y2 = q.y; }
    }
    render();
  }
});

svg.addEventListener('pointerup', () => {
  svg.classList.remove('panning');
  if (!drag) return;
  const d = drag;
  drag = null;
  snapHit = null;
  guides = [];
  if (d.mode === 'pan' || d.mode === 'ulmove') { persist(); return render(); }
  if (d.mode === 'room') {
    const r = draft;
    draft = null;
    if (r.w > 0 && r.h > 0) return createRoom({ x: r.x, y: r.y, w: r.w, h: r.h });
    return render();
  }
  if (d.mode === 'marquee') { renderProps(); return render(); }
  // Click (without drag) on an item in a multi-selection = select only that item (or its group)
  if (d.mode === 'move' && !d.done && !d.additive && state.sel.length > d.unit.length) {
    state.sel = d.unit;
    renderProps();
    return render();
  }
  if (d.done) {
    const it = getSel();
    if (d.mode === 'handle' && it?.type === 'room' && (it.w < 1 || it.h < 1)) Object.assign(it, d.orig);
    changed();
  }
});

// Last pointerdown target (dblclick lands on the svg because of pointer capture)
let lastDownId = null;

svg.addEventListener('dblclick', () => {
  if (draft?.type === 'wall') return endDraft();
  if (draft?.type === 'poly') return closePoly();
  // Double-click a group member = select just that item (enter the group)
  const it = state.tool === 'select' && state.items.find(i => i.id === lastDownId);
  if (it?.g) { select(it.id); render(); }
});
svg.addEventListener('contextmenu', e => e.preventDefault());

svg.addEventListener('wheel', e => {
  e.preventDefault();
  const r = svg.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });

/* ---------- Keyboard ---------- */

window.addEventListener('keydown', e => {
  if (e.target.matches('input, select, textarea')) return;
  const k = e.key;
  if ($('#sheetMenu')) { if (k === 'Escape') closeMenu(); return; }

  if (e.ctrlKey || e.metaKey) {
    const kk = k.toLowerCase();
    const map = {
      z: () => (e.shiftKey ? redo() : undo()), y: redo,
      s: saveFile, o: () => $('#file').click(), d: duplicateSel, p: openPrint,
      c: () => copySel(false), x: () => copySel(true), v: paste, a: selectAll,
      g: () => (e.shiftKey ? ungroupSel() : groupSel()),
      f: () => { setPalette(true); $('#palSearch').focus(); $('#palSearch').select(); },
    };
    if (map[kk]) { e.preventDefault(); map[kk](); }
    return;
  }

  // Type a length while drawing a wall / dimension / polygon room edge
  if (draft && (draft.type === 'wall' || draft.type === 'dim' || draft.type === 'poly')) {
    if (k.length === 1 && (typed ? /[0-9.,'"\-\/ a-z]/i.test(k) : /[0-9.]/.test(k))) {
      typed += k; showTyped(); e.preventDefault(); return;
    }
    if (k === 'Backspace' && typed) { typed = typed.slice(0, -1); showTyped(); e.preventDefault(); return; }
    if (k === 'Enter' && typed) { applyTyped(); e.preventDefault(); return; }
  }

  if (k === ' ') { spaceDown = true; e.preventDefault(); return; }

  switch (k.toLowerCase()) {
    case 'escape':
      if (typed) { typed = ''; showTyped(); }
      else if (draft) endDraft();
      else if (state.tool !== 'select') setTool('select');
      else { select(null); render(); }
      break;
    case 'enter':
      if (draft?.type === 'poly') closePoly();
      else if (draft) endDraft();
      break;
    case 'delete': case 'backspace': deleteSel(); break;
    case 'v': setTool('select'); break;
    case 'w': setTool('wall'); break;
    case 'r': setTool('room'); break;
    case 'd': setTool('door'); break;
    case 'n': setTool('window'); break;
    case 'm': setTool('dim'); break;
    case 'f': fit(); break;
    case 'q': {
      const ops = selItems().filter(i => isOpening(i) || ['furn', 'text', 'north'].includes(i.type));
      if (ops.length) {
        commit();
        for (const o of ops) o.rot = ((o.rot || 0) + 90) % 360;
        changed();
      }
      break;
    }
    case 'arrowleft': case 'arrowright': case 'arrowup': case 'arrowdown': {
      if (!state.sel.length) break;
      e.preventDefault();
      const st = state.snap * (e.shiftKey ? 10 : 1);
      const dir = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k.toLowerCase()];
      nudgeSel(dir[0] * st, dir[1] * st);
      break;
    }
  }
});
window.addEventListener('keyup', e => { if (e.key === ' ') spaceDown = false; });
