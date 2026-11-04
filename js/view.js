'use strict';

/* ---------- View ---------- */

const X = x => x * state.view.s + state.view.ox;
const Y = y => y * state.view.s + state.view.oy;

function toWorld(e) {
  const r = svg.getBoundingClientRect();
  return {
    x: (e.clientX - r.left - state.view.ox) / state.view.s,
    y: (e.clientY - r.top - state.view.oy) / state.view.s,
  };
}

function zoomAt(mx, my, k) {
  const v = state.view;
  const ns = clamp(v.s * k, 0.003, 5);
  k = ns / v.s;
  v.ox = mx - (mx - v.ox) * k;
  v.oy = my - (my - v.oy) * k;
  v.s = ns;
  persist();
  render();
}

function bounds() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y, pad = 0) => {
    x0 = Math.min(x0, x - pad); y0 = Math.min(y0, y - pad);
    x1 = Math.max(x1, x + pad); y1 = Math.max(y1, y + pad);
  };
  for (const it of state.items) {
    if (it.type === 'wall') { add(it.x1, it.y1, it.t / 2); add(it.x2, it.y2, it.t / 2); }
    else if (it.type === 'dim') { add(it.x1, it.y1); add(it.x2, it.y2); }
    else if (it.type === 'room' || it.type === 'furn') { const b = itemBox(it); add(b.x0, b.y0); add(b.x1, b.y1); }
    else add(it.x, it.y, it.w);
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

function fit(silent) {
  const W = svg.clientWidth, H = svg.clientHeight;
  const b = bounds();
  if (!b) { state.view = { s: 0.08, ox: 80, oy: 80 }; }
  else {
    const pad = 60;
    const bw = Math.max(b.x1 - b.x0, 1), bh = Math.max(b.y1 - b.y0, 1);
    const s = clamp(Math.min((W - pad * 2) / bw, (H - pad * 2) / bh), 0.003, 5);
    state.view = { s, ox: (W - bw * s) / 2 - b.x0 * s, oy: (H - bh * s) / 2 - b.y0 * s };
  }
  if (!silent) { persist(); render(); }
}

/* ---------- Snapping ---------- */

const snapV = v => Math.round(v / state.snap) * state.snap;

// extraPts: additional snap targets, e.g. the vertices of a polygon being drawn
function snapPoint(p, e, from, excludeId, extraPts = []) {
  snapHit = null;
  const tol = 10 / state.view.s;
  // 1) Snap to nearby wall ends / room corners
  if (!e.altKey) {
    let best = null, bd = tol;
    const test = (x, y) => {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < bd) { bd = d; best = { x, y }; }
    };
    for (const it of state.items) {
      if (it.id === excludeId) continue;
      if (it.type === 'wall' || it.type === 'dim') { test(it.x1, it.y1); test(it.x2, it.y2); }
      else if (it.type === 'room') for (const [x, y] of roomPts(it)) test(x, y);
    }
    for (const [x, y] of extraPts) test(x, y);
    if (best) { snapHit = best; return { ...best }; }
  }

  const ortho = from && state.ortho !== e.shiftKey;
  let dir = null, rawLen = 0;
  if (ortho) {
    const dx = p.x - from.x, dy = p.y - from.y;
    const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    dir = { x: Math.cos(a), y: Math.sin(a) };
    rawLen = dx * dir.x + dy * dir.y;
  }

  // 2) Snap onto a wall centreline (T-junctions); with ortho, where the ray crosses the wall
  if (!e.altKey) {
    let best = null, bd = tol;
    for (const w of state.items) {
      if (w.type !== 'wall' || w.id === excludeId) continue;
      const vx = w.x2 - w.x1, vy = w.y2 - w.y1, L2 = vx * vx + vy * vy;
      if (L2 < 1e-6) continue;
      if (ortho) {
        const den = dir.x * vy - dir.y * vx;
        if (Math.abs(den) < 1e-9) continue;
        const s = ((w.x1 - from.x) * vy - (w.y1 - from.y) * vx) / den;
        const t = ((w.x1 - from.x) * dir.y - (w.y1 - from.y) * dir.x) / den;
        if (t < 0 || t > 1 || Math.abs(s) < tol) continue;
        if (Math.abs(s - rawLen) < bd) { bd = Math.abs(s - rawLen); best = { x: from.x + dir.x * s, y: from.y + dir.y * s }; }
      } else {
        const t = clamp(((p.x - w.x1) * vx + (p.y - w.y1) * vy) / L2, 0, 1);
        const q = { x: w.x1 + vx * t, y: w.y1 + vy * t };
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < bd) { bd = d; best = q; }
      }
    }
    if (best) { snapHit = best; return best; }
  }

  if (ortho) {
    const len = e.altKey ? rawLen : snapV(rawLen);
    return { x: from.x + dir.x * len, y: from.y + dir.y * len };
  }
  if (e.altKey) return { x: p.x, y: p.y };
  return { x: snapV(p.x), y: snapV(p.y) };
}

// Alignment guide lines shown while placing/moving furniture
let guides = [];

// Furniture magnet: offset (dx, dy) for box b (mm) so that
//  - its edge sits flush against a horizontal/vertical wall face (not the centreline), or
//  - its centre/edge aligns with another item's centre/edge (like draw.io smart guides)
// The nearest candidate within ~12 px is picked for each axis.
function furnMagnet(b, excludeIds = []) {
  const tol = 12 / state.view.s;
  const best = { x: null, y: null };
  // weight < 1 makes a candidate win ties more easily (centre alignment is usually the intent)
  const pick = (axis, d, guide, weight = 1) => {
    const score = Math.abs(d) * weight;
    if (Math.abs(d) < tol && (best[axis] === null || score < best[axis].score)) best[axis] = { d, guide, score };
  };
  const bc = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };

  for (const w of state.items) {
    if (w.type !== 'wall') continue;
    const h = w.t / 2;
    if (Math.abs(w.y1 - w.y2) < 0.5) {
      const x0 = Math.min(w.x1, w.x2) - h, x1 = Math.max(w.x1, w.x2) + h;
      if (b.x1 <= x0 || b.x0 >= x1) continue;
      pick('y', w.y1 + h - b.y0);   // furniture below the wall
      pick('y', w.y1 - h - b.y1);   // furniture above the wall
    } else if (Math.abs(w.x1 - w.x2) < 0.5) {
      const y0 = Math.min(w.y1, w.y2) - h, y1 = Math.max(w.y1, w.y2) + h;
      if (b.y1 <= y0 || b.y0 >= y1) continue;
      pick('x', w.x1 + h - b.x0);   // furniture right of the wall
      pick('x', w.x1 - h - b.x1);   // furniture left of the wall
    }
  }

  for (const f of state.items) {
    if (f.type !== 'furn' || excludeIds.includes(f.id)) continue;
    const o = itemBox(f), oc = { x: (o.x0 + o.x1) / 2, y: (o.y0 + o.y1) / 2 };
    // [target value on the other furniture, value on the moving box]
    const pairsX = [[o.x0, b.x0], [o.x1, b.x1], [oc.x, bc.x], [o.x1, b.x0], [o.x0, b.x1]];
    const pairsY = [[o.y0, b.y0], [o.y1, b.y1], [oc.y, bc.y], [o.y1, b.y0], [o.y0, b.y1]];
    // index 2 = centre-to-centre pair
    pairsX.forEach(([t, v], i) => pick('x', t - v, { x: t, a: Math.min(o.y0, b.y0), b: Math.max(o.y1, b.y1) }, i === 2 ? 0.6 : 1));
    pairsY.forEach(([t, v], i) => pick('y', t - v, { y: t, a: Math.min(o.x0, b.x0), b: Math.max(o.x1, b.x1) }, i === 2 ? 0.6 : 1));
  }

  guides = [best.x?.guide, best.y?.guide].filter(Boolean);
  // null = no target on that axis (use grid snap)
  return { dx: best.x ? best.x.d : null, dy: best.y ? best.y.d : null };
}

// Place a door/window on the nearest wall (follows wall angle & thickness)
function placeOpening(o, p, e) {
  let best = null, bd = Infinity;
  for (const w of state.items) {
    if (w.type !== 'wall') continue;
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L2 = dx * dx + dy * dy;
    if (!L2) continue;
    const t = clamp(((p.x - w.x1) * dx + (p.y - w.y1) * dy) / L2, 0, 1);
    const qx = w.x1 + dx * t, qy = w.y1 + dy * t;
    const d = Math.hypot(p.x - qx, p.y - qy);
    if (d < w.t / 2 + 14 / state.view.s && d < bd) { bd = d; best = { w, t }; }
  }
  if (best) {
    const { w } = best;
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    let along = best.t * L;
    if (!e.altKey) along = snapV(along);
    along = clamp(along, Math.min(o.w / 2, L / 2), Math.max(L - o.w / 2, L / 2));
    o.x = w.x1 + (w.x2 - w.x1) / L * along;
    o.y = w.y1 + (w.y2 - w.y1) / L * along;
    o.rot = Math.atan2(w.y2 - w.y1, w.x2 - w.x1) * 180 / Math.PI;
    o.t = w.t;
  } else {
    o.x = e.altKey ? p.x : snapV(p.x);
    o.y = e.altKey ? p.y : snapV(p.y);
  }
}
