'use strict';

/* ---------- Geometry: polygons, wall outlines, room detection ---------- */

// Room outline as [[x, y], …]. Rectangle rooms store x/y/w/h; polygon rooms store pts.
// pts arrays are never mutated in place (copies share them), always replaced.
const roomPts = r => r.pts || [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];

function polyArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  return Math.abs(a / 2);
}

function polyPerimeter(pts) {
  let p = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) p += Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
  return p;
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const roomArea = r => (r.pts ? polyArea(r.pts) : r.w * r.h);
const roomPerimeter = r => (r.pts ? polyPerimeter(r.pts) : 2 * (r.w + r.h));

// A point inside the polygon for the room label: the centroid if it is inside
// (convex-ish rooms), otherwise the middle of the widest horizontal span
function labelPoint(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    a += f;
    cx += (pts[j][0] + pts[i][0]) * f;
    cy += (pts[j][1] + pts[i][1]) * f;
  }
  if (Math.abs(a) > 1e-9) {
    cx /= 3 * a;
    cy /= 3 * a;
    if (pointInPoly(cx, cy, pts)) return { x: cx, y: cy };
  }
  const ys = pts.map(p => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let best = { x: pts[0][0], y: pts[0][1], w: -1 };
  for (let k = 1; k < 20; k++) {
    const y = y0 + (y1 - y0) * k / 20, xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y)) xs.push(xi + (y - yi) * (xj - xi) / (yj - yi));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (xs[i + 1] - xs[i] > best.w) best = { x: (xs[i] + xs[i + 1]) / 2, y, w: xs[i + 1] - xs[i] };
    }
  }
  return { x: best.x, y: best.y };
}

// Intersection of lines p + s·u and q + t·v (null if parallel)
function lineX(p, u, q, v) {
  const den = u.x * v.y - u.y * v.x;
  if (Math.abs(den) < 1e-9) return null;
  const s = ((q.x - p.x) * v.y - (q.y - p.y) * v.x) / den;
  return { x: p.x + u.x * s, y: p.y + u.y * s };
}

/* Wall outline (mm) with mitred corners.
   An end shared with exactly one other wall is mitred against it; any other end is butt
   (T-junction ends sit on the other wall's centreline, so the overlap is hidden). */
function wallOutline(w, walls) {
  const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
  if (L < 1e-6) return null;
  const d = { x: (w.x2 - w.x1) / L, y: (w.y2 - w.y1) / L }, n = { x: -d.y, y: d.x }, h = w.t / 2;
  const near = (x, y, P) => Math.abs(x - P.x) < 1 && Math.abs(y - P.y) < 1;

  // Corners at end P where `dir` points from P into this wall; returns [left, right] of dir
  const mitre = (P, dir) => {
    const others = walls.filter(o => o !== w && (near(o.x1, o.y1, P) || near(o.x2, o.y2, P)));
    if (others.length !== 1) return null;
    const o = others[0], Lo = Math.hypot(o.x2 - o.x1, o.y2 - o.y1);
    if (Lo < 1e-6) return null;
    const od = near(o.x1, o.y1, P)
      ? { x: (o.x2 - o.x1) / Lo, y: (o.y2 - o.y1) / Lo }
      : { x: (o.x1 - o.x2) / Lo, y: (o.y1 - o.y2) / Lo };
    const nd = { x: -dir.y, y: dir.x }, no = { x: -od.y, y: od.x }, ho = o.t / 2;
    // This wall's left face meets the other wall's right face, and vice versa
    const c1 = lineX({ x: P.x + nd.x * h, y: P.y + nd.y * h }, dir, { x: P.x - no.x * ho, y: P.y - no.y * ho }, od);
    const c2 = lineX({ x: P.x - nd.x * h, y: P.y - nd.y * h }, dir, { x: P.x + no.x * ho, y: P.y + no.y * ho }, od);
    const lim = 4 * Math.max(h, ho);
    if (!c1 || !c2 || Math.hypot(c1.x - P.x, c1.y - P.y) > lim || Math.hypot(c2.x - P.x, c2.y - P.y) > lim) return null;
    return [c1, c2];
  };

  const P1 = { x: w.x1, y: w.y1 }, P2 = { x: w.x2, y: w.y2 };
  const m1 = mitre(P1, d), m2 = mitre(P2, { x: -d.x, y: -d.y });
  // +n side and −n side corners at each end (at P2 the "left" of −d is the −n side)
  const a1 = m1 ? m1[0] : { x: P1.x + n.x * h, y: P1.y + n.y * h };
  const b1 = m1 ? m1[1] : { x: P1.x - n.x * h, y: P1.y - n.y * h };
  const a2 = m2 ? m2[1] : { x: P2.x + n.x * h, y: P2.y + n.y * h };
  const b2 = m2 ? m2[0] : { x: P2.x - n.x * h, y: P2.y - n.y * h };
  return [a1, a2, b2, b1];
}

/* Auto room: find the region enclosed by walls around point p (mm).
   Rasterises the walls, flood-fills from p, traces the outline, simplifies it and snaps
   each edge onto the matching wall face so the result is exact. Returns pts or null. */
function detectRoom(p) {
  const walls = state.items.filter(i => i.type === 'wall');
  if (!walls.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, tMin = Infinity;
  for (const w of walls) {
    x0 = Math.min(x0, w.x1, w.x2); y0 = Math.min(y0, w.y1, w.y2);
    x1 = Math.max(x1, w.x1, w.x2); y1 = Math.max(y1, w.y1, w.y2);
    tMin = Math.min(tMin, w.t);
  }
  if (p.x <= x0 || p.x >= x1 || p.y <= y0 || p.y >= y1) return null;
  const pad = 400;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  // Cell size: fine enough for the thinnest wall, capped at ~1200 cells per side
  const cell = Math.max(tMin / 3, Math.max(x1 - x0, y1 - y0) / 1200, 5);
  const nx = Math.ceil((x1 - x0) / cell), ny = Math.ceil((y1 - y0) / cell);
  const grid = new Uint8Array(nx * ny); // 1 = wall, 2 = filled

  for (const w of walls) {
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    if (L < 1e-6) continue;
    const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, h = w.t / 2 + cell * 0.5;
    const bx0 = Math.max(0, Math.floor((Math.min(w.x1, w.x2) - h - x0) / cell));
    const bx1 = Math.min(nx - 1, Math.ceil((Math.max(w.x1, w.x2) + h - x0) / cell));
    const by0 = Math.max(0, Math.floor((Math.min(w.y1, w.y2) - h - y0) / cell));
    const by1 = Math.min(ny - 1, Math.ceil((Math.max(w.y1, w.y2) + h - y0) / cell));
    for (let j = by0; j <= by1; j++) {
      for (let i = bx0; i <= bx1; i++) {
        const cx = x0 + (i + 0.5) * cell - w.x1, cy = y0 + (j + 0.5) * cell - w.y1;
        const along = cx * ux + cy * uy, across = -cx * uy + cy * ux;
        if (along >= -h && along <= L + h && Math.abs(across) <= h) grid[j * nx + i] = 1;
      }
    }
  }

  const si = Math.floor((p.x - x0) / cell), sj = Math.floor((p.y - y0) / cell);
  if (grid[sj * nx + si]) return null;
  const stack = [sj * nx + si];
  grid[stack[0]] = 2;
  while (stack.length) {
    const c = stack.pop(), i = c % nx, j = (c - i) / nx;
    if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) return null; // leaked outside
    for (const nb of [c - 1, c + 1, c - nx, c + nx]) {
      if (!grid[nb]) { grid[nb] = 2; stack.push(nb); }
    }
  }

  // Boundary edges between filled and unfilled cells, as directed edges (filled on the left)
  const filled = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && grid[j * nx + i] === 2;
  const next = new Map();
  const key = (i, j) => j * (nx + 1) + i;
  const addEdge = (a, b) => next.set(key(a[0], a[1]), b);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!filled(i, j)) continue;
      if (!filled(i, j - 1)) addEdge([i + 1, j], [i, j]);
      if (!filled(i, j + 1)) addEdge([i, j + 1], [i + 1, j + 1]);
      if (!filled(i - 1, j)) addEdge([i, j], [i, j + 1]);
      if (!filled(i + 1, j)) addEdge([i + 1, j + 1], [i + 1, j]);
    }
  }
  // Trace the loop starting from the top-most, left-most corner (the outer boundary)
  let start = null;
  for (let j = 0; j < ny && !start; j++) for (let i = 0; i < nx; i++) if (filled(i, j)) { start = [i + 1, j]; break; }
  const loop = [start];
  let cur = next.get(key(start[0], start[1]));
  while (cur && (cur[0] !== start[0] || cur[1] !== start[1]) && loop.length < 200000) {
    loop.push(cur);
    cur = next.get(key(cur[0], cur[1]));
  }
  let pts = loop.map(([i, j]) => [x0 + i * cell, y0 + j * cell]);

  pts = simplifyClosed(pts, cell * 1.5);
  if (pts.length < 3) return null;
  return snapEdgesToWallFaces(pts, walls, cell * 2.5);
}

// Douglas–Peucker for a closed ring
function simplifyClosed(pts, tol) {
  if (pts.length < 4) return pts;
  // Split the ring at the point farthest from pts[0]
  let far = 0, fd = -1;
  pts.forEach((p, i) => { const d = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]); if (d > fd) { fd = d; far = i; } });
  const dp = arr => {
    if (arr.length < 3) return arr;
    const [a, b] = [arr[0], arr[arr.length - 1]];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
    let idx = 0, md = -1;
    for (let i = 1; i < arr.length - 1; i++) {
      const d = Math.abs((b[0] - a[0]) * (a[1] - arr[i][1]) - (a[0] - arr[i][0]) * (b[1] - a[1])) / L;
      if (d > md) { md = d; idx = i; }
    }
    if (md <= tol) return [a, b];
    return [...dp(arr.slice(0, idx + 1)).slice(0, -1), ...dp(arr.slice(idx))];
  };
  const left = dp(pts.slice(0, far + 1)), right = dp([...pts.slice(far), pts[0]]);
  return [...left.slice(0, -1), ...right.slice(0, -1)];
}

// Replace each traced edge by the parallel wall face it lies on, then rebuild the corners
function snapEdgesToWallFaces(pts, walls, tol) {
  const faces = [];
  for (const w of walls) {
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    if (L < 1e-6) continue;
    const d = { x: (w.x2 - w.x1) / L, y: (w.y2 - w.y1) / L }, n = { x: -d.y, y: d.x }, h = w.t / 2;
    faces.push({ p: { x: w.x1 + n.x * h, y: w.y1 + n.y * h }, d }, { p: { x: w.x1 - n.x * h, y: w.y1 - n.y * h }, d });
  }
  const lines = pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
    const d = { x: (b[0] - a[0]) / L, y: (b[1] - a[1]) / L }, m = { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 };
    let best = null, bd = tol;
    for (const f of faces) {
      if (Math.abs(d.x * f.d.y - d.y * f.d.x) > 0.05) continue; // not parallel
      const dist = Math.abs((m.x - f.p.x) * -f.d.y + (m.y - f.p.y) * f.d.x);
      if (dist < bd) { bd = dist; best = f; }
    }
    // Use the face's own direction: traced edges can be slightly slanted
    return best ? { p: best.p, d: best.d } : { p: { x: a[0], y: a[1] }, d };
  });
  const out = pts.map((orig, i) => {
    const prev = lines[(i - 1 + lines.length) % lines.length], cur = lines[i];
    const c = lineX(prev.p, prev.d, cur.p, cur.d);
    return c ? [n2(c.x), n2(c.y)] : orig;
  });
  return cleanPoly(out);
}

// Drop duplicate points and points lying on a straight line between their neighbours
function cleanPoly(pts) {
  let res = pts.slice(), changed = true;
  while (changed && res.length > 3) {
    changed = false;
    for (let i = 0; i < res.length; i++) {
      const a = res[(i - 1 + res.length) % res.length], b = res[i], c = res[(i + 1) % res.length];
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      const dup = Math.hypot(b[0] - a[0], b[1] - a[1]) < 1;
      if (dup || Math.abs(cross) < 1e-3 * Math.hypot(c[0] - a[0], c[1] - a[1]) ** 2) {
        res.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return res;
}
