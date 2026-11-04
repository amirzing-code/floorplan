'use strict';

/* ---------- Rendering ---------- */

function label(x, y, text, cls = '', ang = 0) {
  const r = ang ? ` transform="rotate(${ang.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"` : '';
  return `<text class="lbl ${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}"${r}>${esc(text)}</text>`;
}

// Label parallel to the line (screen coords), always readable
function alongLabel(x1, y1, x2, y2, off, text, cls = '') {
  const dx = x2 - x1, dy = y2 - y1;
  if (Math.hypot(dx, dy) < 34) return '';
  let a = Math.atan2(dy, dx) * 180 / Math.PI;
  if (a > 90) a -= 180;
  if (a <= -90) a += 180;
  const r = a * Math.PI / 180;
  const x = (x1 + x2) / 2 + Math.sin(r) * off;
  const y = (y1 + y2) / 2 - Math.cos(r) * off;
  return label(x, y, text, cls, a);
}

function grid(W, H) {
  const v = state.view;
  const lines = (step, cls) => {
    if (step * v.s < 7) return '';
    let d = '';
    for (let i = Math.floor(-v.ox / v.s / step); ; i++) {
      const sx = X(i * step);
      if (sx > W) break;
      d += `M${sx.toFixed(1)} 0V${H}`;
    }
    for (let i = Math.floor(-v.oy / v.s / step); ; i++) {
      const sy = Y(i * step);
      if (sy > H) break;
      d += `M0 ${sy.toFixed(1)}H${W}`;
    }
    return `<path class="${cls}" d="${d}"/>`;
  };
  let major = isImperial(state.unit) ? 304.8 : 1000;
  while (major * v.s < 25) major *= 10;
  return lines(state.snap, 'g-minor') + lines(major, 'g-major');
}

// Screen-space SVG path for a closed polygon given in mm
const polyPath = pts => 'M' + pts.map(([x, y]) => `${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join('L') + 'Z';

function roomSvg(r, sel) {
  const s = state.view.s;
  const out = r.pts
    ? `<path class="room${sel ? ' sel' : ''}" data-id="${r.id}" d="${polyPath(r.pts)}"/>`
    : `<rect class="room${sel ? ' sel' : ''}" data-id="${r.id}" x="${X(r.x).toFixed(1)}" y="${Y(r.y).toFixed(1)}" width="${(r.w * s).toFixed(1)}" height="${(r.h * s).toFixed(1)}"/>`;
  let lbl = '';
  const b = itemBox(r);
  if (state.labels && (b.x1 - b.x0) * s > 60 && (b.y1 - b.y0) * s > 40) {
    const c = r.pts ? labelPoint(r.pts) : { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    const cx = X(c.x), cy = Y(c.y);
    lbl += label(cx, cy - 10, r.name || 'Room', 'rname');
    lbl += label(cx, cy + 7, fmtArea(roomArea(r)));
    if (!r.pts && r.h * s > 70) lbl += label(cx, cy + 23, `${fmt(r.w)} × ${fmt(r.h)}`, 'small');
  }
  return { out, lbl };
}

function wallSvg(w, sel, walls) {
  const s = state.view.s;
  const o = wallOutline(w, walls);
  // Solid wall body (mitred at corners) + a wider invisible line so thin walls stay easy to click
  const out = `<g data-id="${w.id}">` +
    (o ? `<path class="wall${sel ? ' sel' : ''}" d="${polyPath(o.map(p => [p.x, p.y]))}"/>` : '') +
    `<line class="wall-hit" x1="${X(w.x1).toFixed(1)}" y1="${Y(w.y1).toFixed(1)}" x2="${X(w.x2).toFixed(1)}" y2="${Y(w.y2).toFixed(1)}" stroke-width="${Math.max(10, w.t * s).toFixed(1)}"/></g>`;
  const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
  const lbl = state.labels ? alongLabel(X(w.x1), Y(w.y1), X(w.x2), Y(w.y2), w.t * s / 2 + 9, fmt(len)) : '';
  return { out, lbl };
}

function openingSvg(o, sel) {
  const s = state.view.s;
  const w = o.w * s, t = Math.max(o.t * s, 3), hw = w / 2, ht = t / 2;
  const tr = `translate(${X(o.x).toFixed(1)} ${Y(o.y).toFixed(1)}) rotate(${o.rot || 0}) scale(${o.fx || 1} ${o.fy || 1})`;
  const f = v => +v.toFixed(2);
  const hit = h => `<rect class="hit" x="${f(-hw)}" y="${f(-ht - h)}" width="${f(w)}" height="${f(h + t)}"/>`;
  const hitFlat = () => { const hh = Math.max(ht, 6); return `<rect class="hit" x="${f(-hw)}" y="${f(-hh)}" width="${f(w)}" height="${f(hh * 2)}"/>`; };
  const cover = `<rect class="op-cover" x="${f(-hw)}" y="${f(-ht - 1)}" width="${f(w)}" height="${f(t + 2)}"/>`;
  const jambs = `<line x1="${f(-hw)}" y1="${f(-ht)}" x2="${f(-hw)}" y2="${f(ht)}"/><line x1="${f(hw)}" y1="${f(-ht)}" x2="${f(hw)}" y2="${f(ht)}"/>`;
  // Door leaf hinged at hx; opens toward -y, swings toward dir (+1 right / -1 left)
  const leaf = (hx, len, dir) =>
    `<line x1="${f(hx)}" y1="${f(-ht)}" x2="${f(hx)}" y2="${f(-ht - len)}"/>` +
    `<path d="M${f(hx)} ${f(-ht - len)}A${f(len)} ${f(len)} 0 0 ${dir > 0 ? 1 : 0} ${f(hx + dir * len)} ${f(-ht)}"/>`;
  // Sliding panel: from x0 to x1, centred on line cy
  const panel = (x0, x1, cy, pt) => `<rect class="panel" x="${f(x0)}" y="${f(cy - pt / 2)}" width="${f(x1 - x0)}" height="${f(pt)}"/>`;

  let inner;
  switch (o.type) {
    case 'door':
      inner = hit(w) + cover + jambs + leaf(-hw, w, 1);
      break;
    case 'double':
      inner = hit(hw) + cover + jambs + leaf(-hw, hw, 1) + leaf(hw, hw, -1);
      break;
    case 'double_uneven': {
      const a = w * (o.split ?? 0.75), b = w - a;
      inner = hit(Math.max(a, b)) + cover + jambs + leaf(-hw, a, 1) + leaf(hw, b, -1);
      break;
    }
    case 'bifold1': {
      // 2 leaves folding to one side (hinged on the left), drawn half-open at 60°
      const L = w / 2, dd = L * Math.sin(Math.PI / 3);
      inner = hit(dd) + cover + jambs +
        `<path d="M${f(-hw)} ${f(-ht)}L${f(-hw + L / 2)} ${f(-ht - dd)}L${f(-hw + L)} ${f(-ht)}"/>`;
      break;
    }
    case 'bifold': {
      // 4 leaves (2 per side) drawn half-open at 60°
      const L = w / 4, dd = L * Math.sin(Math.PI / 3);
      inner = hit(dd) + cover + jambs +
        `<path d="M${f(-hw)} ${f(-ht)}L${f(-hw + L / 2)} ${f(-ht - dd)}L${f(-hw + L)} ${f(-ht)}` +
        `M${f(hw)} ${f(-ht)}L${f(hw - L / 2)} ${f(-ht - dd)}L${f(hw - L)} ${f(-ht)}"/>`;
      break;
    }
    case 'slide2': {
      const pw = w / 2 + w * 0.04, pt = Math.max(t / 4, 2);
      inner = hitFlat() + cover + jambs + panel(-hw, -hw + pw, -t / 6, pt) + panel(hw - pw, hw, t / 6, pt);
      break;
    }
    case 'slide3': {
      const pw = w / 3 + w * 0.04, pt = Math.max(t / 5, 2);
      inner = hitFlat() + cover + jambs +
        panel(-hw, -hw + pw, -t / 4, pt) + panel(-pw / 2, pw / 2, 0, pt) + panel(hw - pw, hw, t / 4, pt);
      break;
    }
    case 'pocket': {
      // Leaf half slid into a cavity inside the wall (cavity shown dashed on the −x side)
      const pt = Math.max(t / 4, 2), ph = Math.max(t * 0.6, 3);
      inner = hitFlat() + cover + jambs +
        `<rect class="pocket" x="${f(-hw - w)}" y="${f(-ph / 2)}" width="${f(w)}" height="${f(ph)}"/>` +
        panel(-hw - w * 0.5, hw - w * 0.5, 0, pt);
      break;
    }
    case 'roller': {
      // Shutter line along one face, with guide rails at both jambs
      const g = Math.max(t * 0.3, 2), y = -ht * 0.55;
      inner = hitFlat() + cover + jambs +
        `<line class="dash" x1="${f(-hw)}" y1="${f(y)}" x2="${f(hw)}" y2="${f(y)}"/>` +
        `<rect class="frame" x="${f(-hw)}" y="${f(y - g / 2)}" width="${f(g)}" height="${f(g)}"/>` +
        `<rect class="frame" x="${f(hw - g)}" y="${f(y - g / 2)}" width="${f(g)}" height="${f(g)}"/>`;
      break;
    }
    case 'slidewin': {
      // Frame with two overlapping sliding panes on separate tracks
      const ov = w * 0.04;
      inner = hitFlat() +
        `<rect class="frame" x="${f(-hw)}" y="${f(-ht)}" width="${f(w)}" height="${f(t)}"/>` +
        `<line x1="${f(-hw)}" y1="${f(-t / 6)}" x2="${f(ov)}" y2="${f(-t / 6)}"/>` +
        `<line x1="${f(-ov)}" y1="${f(t / 6)}" x2="${f(hw)}" y2="${f(t / 6)}"/>`;
      break;
    }
    case 'louvre': {
      // Nako window: frame with angled glass blades (~one per 100 mm)
      const n = clamp(Math.round(o.w / 100), 3, 40), step = w / n;
      let blades = '';
      for (let i = 0; i < n; i++) {
        const x = -hw + step * (i + 0.5);
        blades += `<line x1="${f(x - step * 0.35)}" y1="${f(ht * 0.7)}" x2="${f(x + step * 0.35)}" y2="${f(-ht * 0.7)}"/>`;
      }
      inner = hitFlat() + `<rect class="frame" x="${f(-hw)}" y="${f(-ht)}" width="${f(w)}" height="${f(t)}"/>` + blades;
      break;
    }
    case 'opening':
      inner = hitFlat() + cover + jambs +
        `<line class="dash" x1="${f(-hw)}" y1="${f(-ht)}" x2="${f(hw)}" y2="${f(-ht)}"/>` +
        `<line class="dash" x1="${f(-hw)}" y1="${f(ht)}" x2="${f(hw)}" y2="${f(ht)}"/>`;
      break;
    default: // window
      inner = hitFlat() +
        `<rect class="frame" x="${f(-hw)}" y="${f(-ht)}" width="${f(w)}" height="${f(t)}"/>` +
        `<line x1="${f(-hw)}" y1="0" x2="${f(hw)}" y2="0"/>`;
  }
  const out = `<g class="op ${o.type}${sel ? ' sel' : ''}" data-id="${o.id}" transform="${tr}">${inner}</g>`;
  let lbl = '';
  if (state.labels && sel) {
    const a = (o.rot || 0) * Math.PI / 180, dx = Math.cos(a) * o.w / 2, dy = Math.sin(a) * o.w / 2;
    lbl = alongLabel(X(o.x - dx), Y(o.y - dy), X(o.x + dx), Y(o.y + dy), -(ht + 10), fmt(o.w));
  }
  return { out, lbl };
}

function furnSvg(f, sel) {
  const s = state.view.s, def = FURN[f.kind];
  if (!def) return { out: '', lbl: '' };
  const W = f.w * s, D = f.d * s;
  const tr = `translate(${X(f.x).toFixed(1)} ${Y(f.y).toFixed(1)}) rotate(${f.rot || 0}) scale(${f.fx || 1} 1)`;
  const out = `<g class="fu${sel ? ' sel' : ''}" data-id="${f.id}" transform="${tr}">` +
    R(-W / 2, -D / 2, W, D, 0, 'hit') + def.draw(W, D, s) + `</g>`;
  let lbl = '';
  if (state.labels && sel && state.sel.length === 1) {
    // Size label along the back edge
    const a = (f.rot || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    const bx = f.x + sn * f.d / 2, by = f.y - c * f.d / 2;
    lbl = alongLabel(X(bx - c * f.w / 2), Y(by - sn * f.w / 2), X(bx + c * f.w / 2), Y(by + sn * f.w / 2), 10, `${fmt(f.w)} × ${fmt(f.d)}`);
  }
  return { out, lbl };
}

// Text labels and north arrows; sizes are real-world mm so they scale with the drawing
function annoSvg(a, sel) {
  const s = state.view.s, cx = X(a.x).toFixed(1), cy = Y(a.y).toFixed(1);
  const tr = `translate(${cx} ${cy}) rotate(${a.rot || 0})`;
  if (a.type === 'text') {
    const fs = Math.max(a.size * s, 1), lines = String(a.text).split('\n');
    const y0 = -(lines.length - 1) * fs * 0.6;
    const tspans = lines.map((l, i) => `<tspan x="0" y="${(y0 + i * fs * 1.2).toFixed(1)}">${esc(l) || ' '}</tspan>`).join('');
    return { out: `<text class="anno${a.bold ? ' bold' : ''}${sel ? ' sel' : ''}" data-id="${a.id}" transform="${tr}" font-size="${fs.toFixed(2)}">${tspans}</text>`, lbl: '' };
  }
  const r = a.size * s / 2;
  const out = `<g class="north${sel ? ' sel' : ''}" data-id="${a.id}" transform="${tr}">` +
    `<circle class="hit" r="${n2(r)}"/><circle class="ring" r="${n2(r * 0.72)}"/>` +
    `<path class="needle" d="M0 ${n2(-r * 0.95)}L${n2(r * 0.3)} ${n2(r * 0.45)}L0 ${n2(r * 0.22)}L${n2(-r * 0.3)} ${n2(r * 0.45)}Z"/>` +
    `<text class="nlabel" y="${n2(-r * 1.05)}" font-size="${n2(Math.max(r * 0.5, 1))}">N</text></g>`;
  return { out, lbl: '' };
}

const itemSvg = (it, sel) => (it.type === 'furn' ? furnSvg(it, sel)
  : it.type === 'text' || it.type === 'north' ? annoSvg(it, sel) : openingSvg(it, sel));

function dimSvg(d, sel, isDraft) {
  const x1 = X(d.x1), y1 = Y(d.y1), x2 = X(d.x2), y2 = Y(d.y2);
  const L = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / L * 6, ny = (x2 - x1) / L * 6;
  const tick = (x, y) => `<line x1="${(x - nx).toFixed(1)}" y1="${(y - ny).toFixed(1)}" x2="${(x + nx).toFixed(1)}" y2="${(y + ny).toFixed(1)}"/>`;
  const id = isDraft ? '' : ` data-id="${d.id}"`;
  const out = `<g class="dim${sel ? ' sel' : ''}"${id}>` +
    `<line class="hitline" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>${tick(x1, y1)}${tick(x2, y2)}</g>`;
  const lbl = alongLabel(x1, y1, x2, y2, 10, fmt(Math.hypot(d.x2 - d.x1, d.y2 - d.y1)), 'dimlbl');
  return { out, lbl };
}

function scaleBar(H) {
  const u = state.unit === 'ftin' ? 'ft' : state.unit;
  const f = UNITS[u].f;
  const target = 120 / state.view.s / f;
  const p = Math.pow(10, Math.floor(Math.log10(target)));
  const n = target / p;
  const len = (n >= 5 ? 5 : n >= 2 ? 2 : 1) * p;
  const px = len * f * state.view.s;
  const x = 16, y = H - 18;
  return `<g class="scalebar"><line x1="${x}" y1="${y}" x2="${x + px}" y2="${y}"/>` +
    `<line x1="${x}" y1="${y - 5}" x2="${x}" y2="${y + 5}"/><line x1="${x + px}" y1="${y - 5}" x2="${x + px}" y2="${y + 5}"/></g>` +
    label(x + px / 2, y - 11, `${num(len, 6)} ${UNITS[u].name}`);
}

function render(exporting = false) {
  layer.innerHTML = buildScene(exporting, svg.clientWidth, svg.clientHeight);
  updateUnderlay();
}

// SVG markup for the current sheet in the current view (W × H = drawing area in px).
// exporting = clean drawing only (no grid, selection, drafts or handles) — used by export & print.
function buildScene(exporting, W, H, withScaleBar = true) {
  const s = state.view.s;
  const selSet = new Set(exporting ? [] : state.sel);
  const isSel = it => selSet.has(it.id);
  let out = exporting ? '' : grid(W, H), lbl = '';
  const add = r => { out += r.out; lbl += r.lbl; };

  for (const it of state.items) if (it.type === 'room') add(roomSvg(it, isSel(it)));
  for (const it of state.items) if (it.type === 'furn') add(furnSvg(it, isSel(it)));
  const walls = state.items.filter(i => i.type === 'wall');
  for (const it of walls) add(wallSvg(it, isSel(it), walls));
  for (const it of state.items) if (isOpening(it)) add(openingSvg(it, isSel(it)));
  for (const it of state.items) if (it.type === 'dim') add(dimSvg(it, isSel(it)));
  for (const it of state.items) if (it.type === 'text' || it.type === 'north') add(annoSvg(it, isSel(it)));

  if (!exporting) {
    if (draft?.type === 'wall') {
      const L = Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1);
      out += `<line class="draft-wall" x1="${X(draft.x1)}" y1="${Y(draft.y1)}" x2="${X(draft.x2)}" y2="${Y(draft.y2)}" stroke-width="${Math.max(2, state.def.wallT * s)}"/>`;
      lbl += alongLabel(X(draft.x1), Y(draft.y1), X(draft.x2), Y(draft.y2), state.def.wallT * s / 2 + 9, fmt(L));
    } else if (draft?.type === 'dim' || draft?.type === 'calib') {
      add(dimSvg(draft, true, true));
    } else if (draft?.type === 'place') {
      add(itemSvg(draft.item, true));
    } else if (draft?.type === 'room') {
      out += `<rect class="draft" x="${X(draft.x)}" y="${Y(draft.y)}" width="${draft.w * s}" height="${draft.h * s}"/>`;
      if (draft.w && draft.h) {
        lbl += label(X(draft.x + draft.w / 2), Y(draft.y + draft.h / 2), `${fmt(draft.w)} × ${fmt(draft.h)}`);
        lbl += label(X(draft.x + draft.w / 2), Y(draft.y + draft.h / 2) + 16, fmtArea(draft.w * draft.h), 'small');
      }
    } else if (draft?.type === 'poly') {
      // Polygon room in progress: placed vertices + rubber-band edge to the cursor
      const pts = [...draft.pts, [draft.x2, draft.y2]];
      out += `<path class="draft" d="${polyPath(pts)}"/>`;
      lbl += alongLabel(X(draft.x1), Y(draft.y1), X(draft.x2), Y(draft.y2), 10, fmt(Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1)));
      if (pts.length >= 3) lbl += label(X(labelPoint(pts).x), Y(labelPoint(pts).y), fmtArea(polyArea(pts)), 'small');
      lbl += draft.pts.map(([x, y], i) => `<circle class="handle${i === 0 ? ' first' : ''}" cx="${X(x).toFixed(1)}" cy="${Y(y).toFixed(1)}" r="${i === 0 ? 6 : 4}"/>`).join('');
    }

    const it = getSel();
    const h = (x, y, k) => `<circle class="handle" data-handle="${k}" cx="${X(x).toFixed(1)}" cy="${Y(y).toFixed(1)}" r="5"/>`;
    let handles = '';
    if (it && (it.type === 'wall' || it.type === 'dim')) handles = h(it.x1, it.y1, '1') + h(it.x2, it.y2, '2');
    else if (it?.type === 'room' && it.pts) handles = it.pts.map(([x, y], i) => h(x, y, 'v' + i)).join('');
    else if (it?.type === 'room') {
      handles = h(it.x, it.y, 'nw') + h(it.x + it.w, it.y, 'ne') +
        h(it.x, it.y + it.h, 'sw') + h(it.x + it.w, it.y + it.h, 'se');
    }
    lbl += handles;

    // Dashed frame around a multi-selection
    if (state.sel.length > 1) {
      const bs = selItems().map(itemBox);
      const x0 = X(Math.min(...bs.map(b => b.x0))) - 8, y0 = Y(Math.min(...bs.map(b => b.y0))) - 8;
      const x1 = X(Math.max(...bs.map(b => b.x1))) + 8, y1 = Y(Math.max(...bs.map(b => b.y1))) + 8;
      lbl += `<rect class="selbox" x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${(y1 - y0).toFixed(1)}"/>`;
    }
    if (drag?.mode === 'marquee') {
      const x0 = X(Math.min(drag.x0, drag.x1)), y0 = Y(Math.min(drag.y0, drag.y1));
      lbl += `<rect class="marquee" x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${(Math.abs(drag.x1 - drag.x0) * s).toFixed(1)}" height="${(Math.abs(drag.y1 - drag.y0) * s).toFixed(1)}"/>`;
    }
    for (const g of guides) {
      lbl += 'x' in g
        ? `<line class="guide" x1="${X(g.x).toFixed(1)}" y1="${(Y(g.a) - 20).toFixed(1)}" x2="${X(g.x).toFixed(1)}" y2="${(Y(g.b) + 20).toFixed(1)}"/>`
        : `<line class="guide" x1="${(X(g.a) - 20).toFixed(1)}" y1="${Y(g.y).toFixed(1)}" x2="${(X(g.b) + 20).toFixed(1)}" y2="${Y(g.y).toFixed(1)}"/>`;
    }
    if (snapHit && (draft || drag)) lbl += `<circle class="snapmark" cx="${X(snapHit.x)}" cy="${Y(snapHit.y)}" r="7"/>`;
  }

  return out + lbl + (withScaleBar ? scaleBar(H) : '');
}
