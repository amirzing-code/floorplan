'use strict';

/* ---------- Extended furniture & fixture library ---------- */
// Adds items to FURN (and new categories to FURN_CATS) defined in catalog.js.
// Same conventions as catalog.js: draw(W, D, k) in px, origin = item centre, back (wall) = -y.

FURN_CATS.push(
  { id: 'electrical', name: 'Electrical', kw: 'elektrik' },
  { id: 'outdoor', name: 'Outdoor', kw: 'luar rumah laman' },
);

// Pa() with tiny exponent-form numbers (e.g. 6e-17 from cos) rounded first
const libPa = (d, c) => Pa(d.replace(/-?[\d.]+e[-+]?\d+/gi, m => n2(+m)), c);

// Unfilled helpers (paths with class 'nf' don't hide what's underneath)
const libBox = (x, y, w, h, c = 'nf') => libPa(`M${x} ${y} h${Math.max(w, 0)} v${Math.max(h, 0)} h${-Math.max(w, 0)} Z`, c);
const libOval = (rx, ry, c = 'nf') => libPa(`M${-rx} 0 A${rx} ${ry} 0 1 0 ${rx} 0 A${rx} ${ry} 0 1 0 ${-rx} 0 Z`, c);

// Chair seen from above. a = width along the backrest, b = depth; back = outer side
function libChair(cx, cy, a, b, side) {
  const v = side === 'n' || side === 's', w = v ? a : b, h = v ? b : a, r = Math.min(a, b) * 0.15;
  let s = R(cx - w / 2, cy - h / 2, w, h, r);
  if (side === 'n') s += Ln(cx - w / 2, cy - h / 4, cx + w / 2, cy - h / 4);
  if (side === 's') s += Ln(cx - w / 2, cy + h / 4, cx + w / 2, cy + h / 4);
  if (side === 'w') s += Ln(cx - w / 4, cy - h / 2, cx - w / 4, cy + h / 2);
  if (side === 'e') s += Ln(cx + w / 4, cy - h / 2, cx + w / 4, cy + h / 2);
  return s;
}

// Top-view car. p = fractions of length (from the front, at -y) for windscreen / roof / rear window
const libCar = p => (W, D) => {
  const hw = W / 2, hd = D / 2, bw = W * 0.94, y = f => -hd + D * f;
  const a = bw * 0.42, b = bw * 0.36, c = bw * 0.39;
  return R(-hw, y(p[0] + 0.02), W, D * 0.03, D * 0.01) + // mirrors
    R(-bw / 2, -hd, bw, D, Math.min(bw * 0.25, D * 0.08)) +
    Ln(-bw * 0.3, y(0.02), -bw * 0.38, y(p[0] - 0.02)) + Ln(bw * 0.3, y(0.02), bw * 0.38, y(p[0] - 0.02)) +
    libPa(`M${-a} ${y(p[0])} Q0 ${y(p[0] - 0.03)} ${a} ${y(p[0])} L${b} ${y(p[1])} H${-b} Z`) +
    R(-b, y(p[1]), b * 2, D * (p[2] - p[1]), bw * 0.04) +
    libPa(`M${-b} ${y(p[2])} H${b} L${c} ${y(p[3])} Q0 ${y(p[3] + 0.015)} ${-c} ${y(p[3])} Z`);
};

Object.assign(FURN, {
  /* ----- Living ----- */
  sofa_l: {
    cat: 'living', name: 'L-Shaped Sofa', w: 2600, d: 1800, kw: 'sofa l-shaped l corner sectional chaise couch sofa sudut bentuk l',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2, sd = Math.min(D * 0.5, W * 0.38), cw = sd, bt = sd * 0.22, a = sd * 0.2;
      const x0 = -hw + cw, xm = (x0 + hw - a) / 2;
      return libPa(`M${-hw} ${-hd} H${hw} V${-hd + sd} H${x0} V${hd} H${-hw} Z`) +
        R(-hw, -hd, W, bt, bt * 0.3) + R(-hw, -hd, bt, D, bt * 0.3) +
        R(hw - a, -hd, a, sd, a * 0.3) + R(-hw, hd - a, cw, a, a * 0.3) +
        Ln(x0, -hd + bt, x0, -hd + sd) + Ln(xm, -hd + bt, xm, -hd + sd) + Ln(-hw + bt, -hd + sd, x0, -hd + sd);
    },
  },
  coffee_round: {
    cat: 'living', name: 'Round Coffee Table', w: 900, d: 900, kw: 'coffee table round bulat meja kopi',
    draw: (W, D) => El(0, 0, W / 2, D / 2) + El(0, 0, W * 0.4, D * 0.4),
  },
  side_table: {
    cat: 'living', name: 'Side Table', w: 500, d: 500, kw: 'side table end table lamp meja sisi kecil lampu',
    draw: (W, D) => {
      const m = Math.min(W, D);
      return R(-W / 2, -D / 2, W, D, m * 0.08) + R(-W * 0.38, -D * 0.38, W * 0.76, D * 0.76, m * 0.05);
    },
  },
  rug: {
    cat: 'living', name: 'Rug', w: 2000, d: 1400, kw: 'rug carpet mat permaidani karpet ambal',
    draw: (W, D) => {
      const i = Math.min(W, D) * 0.07;
      return libBox(-W / 2, -D / 2, W, D, 'nf dash') + libBox(-W / 2 + i, -D / 2 + i, W - 2 * i, D - 2 * i, 'nf dash');
    },
  },
  dining_round4: {
    cat: 'living', name: 'Round Dining Set (4)', w: 1500, d: 1500, kw: 'dining table round set 4 makan meja bulat kerusi',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2, a = Math.min(W, D) * 0.28, bv = D * 0.27, bh = W * 0.27;
      return libChair(0, -hd + bv / 2, a, bv, 'n') + libChair(0, hd - bv / 2, a, bv, 's') +
        libChair(-hw + bh / 2, 0, a, bh, 'w') + libChair(hw - bh / 2, 0, a, bh, 'e') +
        El(0, 0, W * 0.31, D * 0.31);
    },
  },
  dining_oval6: {
    cat: 'living', name: 'Oval Dining Set (6)', w: 2200, d: 1500, kw: 'dining table oval set 6 makan meja bujur kerusi',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2, a = Math.min(W * 0.18, D * 0.3), bv = D * 0.27, bh = W * 0.17;
      let s = '';
      for (const x of [-W * 0.18, W * 0.18]) s += libChair(x, -hd + bv / 2, a, bv, 'n') + libChair(x, hd - bv / 2, a, bv, 's');
      return s + libChair(-hw + bh / 2, 0, a, bh, 'w') + libChair(hw - bh / 2, 0, a, bh, 'e') +
        El(0, 0, W * 0.37, D * 0.29);
    },
  },
  dining8: { cat: 'living', name: '8-Seat Dining Set', w: 2400, d: 1500, kw: 'dining table set 8 makan meja kerusi', draw: drawDining(4) },
  sideboard: {
    cat: 'living', name: 'Sideboard', w: 1600, d: 450, kw: 'sideboard buffet credenza cabinet console kabinet almari hiasan',
    draw: (W, D, k) => {
      const hw = W / 2, hd = D / 2, fy = hd - D * 0.12, n = clamp(Math.round(W / k / 450), 1, 12), i = Math.min(W, D) * 0.06;
      let s = R(-hw, -hd, W, D) + R(-hw + i, -hd + i, W - 2 * i, fy + hd - 2 * i) + Ln(-hw, fy, hw, fy);
      for (let j = 1; j < n; j++) s += Ln(-hw + W / n * j, -hd + i, -hw + W / n * j, hd, 'dash');
      return s;
    },
  },
  bookshelf: {
    cat: 'living', name: 'Bookshelf', w: 900, d: 350, kw: 'bookshelf bookcase shelf rak buku almari',
    draw: (W, D, k) => {
      const hw = W / 2, hd = D / 2, by = -hd + D * 0.1, n = clamp(Math.round(W / k / 450), 1, 16), bw = W / n;
      const t = Math.min(W * 0.012, bw * 0.08), nb = clamp(Math.round(bw / k / 60), 2, 10), len = [0.75, 0.6, 0.7, 0.55, 0.8];
      let s = R(-hw, -hd, W, D) + Ln(-hw, by, hw, by);
      for (let j = 1; j < n; j++) s += R(-hw + bw * j - t / 2, by, t, hd - by);
      // book spines
      for (let j = 0; j < n; j++)
        for (let b = 0; b < nb; b++) {
          const x = -hw + bw * j + bw * 0.12 + bw * 0.76 * (b + 0.5) / nb;
          s += Ln(x, by, x, by + (hd - by) * len[(j * 3 + b) % 5]);
        }
      return s;
    },
  },
  shoe_rack: {
    cat: 'living', name: 'Shoe Cabinet', w: 900, d: 350, kw: 'shoe cabinet rack kasut rak almari',
    draw: (W, D, k) => {
      const hw = W / 2, hd = D / 2, fy = hd - D * 0.12, n = clamp(Math.round(W / k / 300), 1, 16), cw = W / n;
      let s = R(-hw, -hd, W, D) + Ln(-hw, fy, hw, fy);
      for (let i = 0; i < n; i++) {
        const x = -hw + cw * (i + 0.5), rx = Math.min(cw * 0.14, D * 0.15), ry = D * 0.3;
        s += El(x - cw * 0.18, (-hd + fy) / 2, rx, ry) + El(x + cw * 0.18, (-hd + fy) / 2, rx, ry);
      }
      return s;
    },
  },

  /* ----- Bedroom ----- */
  bed_ss: { cat: 'bedroom', name: 'Super Single Bed', w: 1070, d: 1900, kw: 'bed super single katil bujang', draw: drawBed(1) },
  bunk_bed: {
    cat: 'bedroom', name: 'Bunk Bed', w: 900, d: 1900, kw: 'bunk bed double decker katil dua tingkat',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2, i = Math.min(W, D) * 0.05, lx = hw - W * 0.14;
      let s = drawBed(1)(W, D) + libBox(-hw + i, -hd + i, W - 2 * i, D - 2 * i, 'nf dash') +
        R(lx, D * 0.05, W * 0.14, D * 0.3);
      for (let j = 1; j < 5; j++) s += Ln(lx, D * 0.05 + D * 0.06 * j, hw, D * 0.05 + D * 0.06 * j);
      return s;
    },
  },
  baby_cot: {
    cat: 'bedroom', name: 'Baby Cot', w: 700, d: 1300, kw: 'baby cot crib infant katil bayi baby',
    draw: (W, D, k) => {
      const hw = W / 2, hd = D / 2, r = Math.min(W, D) * 0.08, n = clamp(Math.round(D / k / 100), 3, 40);
      let s = R(-hw, -hd, W, D) + R(-hw + r, -hd + r, W - 2 * r, D - 2 * r);
      for (let i = 1; i < n; i++) {
        const y = -hd + r + (D - 2 * r) / n * i;
        s += Ln(-hw, y, -hw + r, y) + Ln(hw - r, y, hw, y);
      }
      return s + Ln(-hw + r, -hd + r + (D - 2 * r) * 0.25, hw - r, -hd + r + (D - 2 * r) * 0.25);
    },
  },
  wardrobe_sliding: {
    cat: 'bedroom', name: 'Sliding Wardrobe', w: 1800, d: 600, kw: 'wardrobe sliding closet almari pakaian pintu gelangsar',
    draw: (W, D, k) => {
      const hw = W / 2, hd = D / 2, t = D * 0.05, cy = -D * 0.08;
      let s = R(-hw, -hd, W, D) + Ln(-hw + W * 0.04, cy, hw - W * 0.04, cy, 'dash');
      const n = clamp(Math.round(W / k / 200), 3, 14);
      for (let i = 0; i < n; i++) {
        const x = -hw + W / n * (i + 0.5);
        s += Ln(x - D * 0.07, cy - D * 0.2, x + D * 0.07, cy + D * 0.2);
      }
      return s + R(-hw, hd - D * 0.2, W * 0.53, t) + R(-W * 0.03, hd - D * 0.12, W * 0.53, t);
    },
  },
  drawers: {
    cat: 'bedroom', name: 'Chest of Drawers', w: 900, d: 450, kw: 'chest of drawers drawer dresser laci almari',
    draw: (W, D, k) => {
      const hw = W / 2, hd = D / 2, fy = hd - D * 0.12, n = clamp(Math.round(W / k / 450), 1, 8), cw = W / n;
      let s = R(-hw, -hd, W, D) + R(-hw + W * 0.03, -hd + D * 0.06, W * 0.94, fy + hd - D * 0.12) + Ln(-hw, fy, hw, fy);
      for (let i = 0; i < n; i++) s += R(-hw + cw * (i + 0.3), fy + D * 0.03, cw * 0.4, D * 0.05, D * 0.02);
      return s;
    },
  },

  /* ----- Kitchen ----- */
  upper_cab: {
    cat: 'kitchen', name: 'Upper Cabinet', w: 2400, d: 350, kw: 'upper wall cabinet hanging kabinet atas dinding gantung dapur',
    draw: (W, D, k) => {
      const hw = W / 2, hd = D / 2, n = Math.max(1, Math.round(W / k / 600));
      let s = libBox(-hw, -hd, W, D, 'nf dash') + Ln(-hw, hd - D * 0.1, hw, hd - D * 0.1, 'dash');
      for (let i = 1; i < n; i++) s += Ln(-hw + W / n * i, -hd, -hw + W / n * i, hd, 'dash');
      return s;
    },
  },
  upper_cab_l: {
    cat: 'kitchen', name: 'L-Shaped Upper Cabinet', w: 2400, d: 1800, kw: 'upper wall cabinet corner l-shaped l kabinet atas dinding sudut',
    draw: (W, D, k) => {
      const hw = W / 2, hd = D / 2, dp = Math.min(350 * k, W * 0.45, D * 0.45);
      return libPa(`M${-hw} ${-hd} H${hw} V${-hd + dp} H${-hw + dp} V${hd} H${-hw} Z`, 'nf dash') +
        Ln(-hw, -hd, -hw + dp, -hd + dp, 'dash');
    },
  },
  island: {
    cat: 'kitchen', name: 'Kitchen Island', w: 1800, d: 900, kw: 'kitchen island counter breakfast bar pulau kaunter dapur',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2, oy = hd - D * 0.3;
      return R(-hw, -hd, W, D) + Ln(-hw, oy, hw, oy, 'dash') + Ln(-hw + W * 0.03, -hd + D * 0.06, hw - W * 0.03, -hd + D * 0.06);
    },
  },
  bar_stool: {
    cat: 'kitchen', name: 'Bar Stool', w: 400, d: 400, kw: 'bar stool counter stool kerusi tinggi bangku',
    draw: (W, D) => El(0, 0, W / 2, D / 2) + El(0, 0, W * 0.3, D * 0.3),
  },
  sink2: {
    cat: 'kitchen', name: 'Double-Bowl Sink', w: 1000, d: 600, kw: 'double bowl sink kitchen sinki berkembar dua dapur',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2, m = Math.min(W / 2, D), bw = W * 0.4, by = -hd + D * 0.2, bh = D * 0.62;
      return R(-hw, -hd, W, D) + R(-W * 0.45, by, bw, bh, m * 0.08) + R(W * 0.05, by, bw, bh, m * 0.08) +
        Ci(-W * 0.25, by + bh / 2, m * 0.05) + Ci(W * 0.25, by + bh / 2, m * 0.05) + Ln(0, -hd + D * 0.05, 0, by + D * 0.1);
    },
  },
  tall_cab: {
    cat: 'kitchen', name: 'Tall Cabinet', w: 600, d: 600, kw: 'tall cabinet pantry larder oven unit kabinet tinggi almari',
    draw: (W, D) => R(-W / 2, -D / 2, W, D) + Ln(-W / 2, -D / 2, W / 2, D / 2) + Ln(W / 2, -D / 2, -W / 2, D / 2),
  },
  hood: {
    cat: 'kitchen', name: 'Cooker Hood', w: 900, d: 500, kw: 'cooker hood range hood extractor chimney penyedut asap hud dapur',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2, iw = W * 0.18, id = D * 0.18;
      return libBox(-hw, -hd, W, D, 'nf dash') + libBox(-iw, -hd, iw * 2, id * 2, 'nf dash') +
        Ln(-hw, hd, -iw, -hd + id * 2, 'dash') + Ln(hw, hd, iw, -hd + id * 2, 'dash');
    },
  },
  dryer: {
    cat: 'kitchen', name: 'Clothes Dryer', w: 600, d: 600, kw: 'clothes dryer tumble mesin pengering pakaian dobi',
    draw: (W, D) => {
      const m = Math.min(W, D), cy = D * 0.08, r = m * 0.33;
      let s = R(-W / 2, -D / 2, W, D) + Ln(-W / 2, -D * 0.34, W / 2, -D * 0.34) + R(W * 0.2, -D * 0.45, W * 0.2, D * 0.07) + Ci(0, cy, r);
      for (const a of [-90, 30, 150]) {
        const c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180);
        s += Ln(c * r, cy + sn * r, c * r * 0.6, cy + sn * r * 0.6);
      }
      return s + Ci(0, cy, m * 0.04);
    },
  },

  /* ----- Bathroom ----- */
  wc_wall: {
    cat: 'bath', name: 'Wall-Hung WC', w: 360, d: 550, kw: 'wall-hung wall hung toilet wc tandas duduk gantung dinding jamban mangkuk',
    draw: (W, D) => {
      const hd = D / 2;
      return El(0, D * 0.04, W / 2, D * 0.46) + El(0, D * 0.09, W * 0.34, D * 0.33) + R(-W * 0.42, -hd, W * 0.84, D * 0.1, W * 0.03);
    },
  },
  shower_corner: {
    cat: 'bath', name: 'Corner Shower', w: 900, d: 900, kw: 'corner shower quadrant tray pancuran mandi sudut',
    draw: (W, D) => {
      const q = (x0, y0, w, d) =>
        `M${x0} ${y0} H${x0 + w} V${y0 + d * 0.3} A${w * 0.7} ${d * 0.7} 0 0 1 ${x0 + w * 0.3} ${y0 + d} H${x0} Z`;
      const i = Math.min(W, D) * 0.05;
      return libPa(q(-W / 2, -D / 2, W, D)) + libPa(q(-W / 2 + i, -D / 2 + i, W - 2 * i, D - 2 * i), 'nf') +
        Ci(-W * 0.06, -D * 0.06, Math.min(W, D) * 0.05);
    },
  },
  floor_trap: {
    cat: 'bath', name: 'Floor Trap', w: 150, d: 150, kw: 'floor trap drain grating perangkap lantai longkang saliran',
    draw: (W, D) => {
      const rx = W * 0.38, ry = D * 0.38;
      let s = R(-W / 2, -D / 2, W, D) + El(0, 0, rx, ry);
      for (const f of [-0.5, 0, 0.5]) {
        const e = Math.sqrt(1 - f * f);
        s += Ln(f * rx, -e * ry, f * rx, e * ry) + Ln(-e * rx, f * ry, e * rx, f * ry);
      }
      return s;
    },
  },
  water_heater: {
    cat: 'bath', name: 'Water Heater', w: 350, d: 200, kw: 'water heater storage instant pemanas air heater mandi',
    draw: (W, D) => {
      const hw = W / 2, m = Math.min(W, D), n = 6;
      let d = `M${-hw * 0.8} 0`;
      for (let i = 0; i < n; i++) d += ` L${-hw * 0.8 + W * 0.8 / n * (i + 0.5)} ${(i % 2 ? 1 : -1) * D * 0.2} L${-hw * 0.8 + W * 0.8 / n * (i + 1)} 0`;
      return R(-hw, -D / 2, W, D, m * 0.3) + libPa(d, 'nf');
    },
  },

  /* ----- Electrical (symbols, not real size) ----- */
  socket: {
    cat: 'electrical', name: '13A Socket Outlet', w: 300, d: 200, kw: 'socket outlet power point plug 13a soket palam kuasa',
    draw: (W, D) => {
      const hd = D / 2, r = Math.min(W * 0.4, D * 0.55), sx = r * 0.4, sy = -hd + r * Math.sqrt(1 - 0.16);
      return Ln(-W / 2, -hd, W / 2, -hd) + libPa(`M${-r} ${-hd} A${r} ${r} 0 0 0 ${r} ${-hd} Z`) +
        Ln(-sx, sy, -sx, hd) + Ln(sx, sy, sx, hd);
    },
  },
  switch: {
    cat: 'electrical', name: 'Light Switch', w: 200, d: 200, kw: 'light switch suis lampu',
    draw: (W, D) => {
      const m = Math.min(W, D), cx = -W * 0.25, cy = D * 0.25, r = m * 0.14, ex = W * 0.3, ey = -D * 0.3;
      const L = Math.hypot(ex - cx, ey - cy) || 1, ux = (ex - cx) / L, uy = (ey - cy) / L, t = m * 0.15;
      return Ln(cx + ux * r, cy + uy * r, ex, ey) + Ln(ex, ey, ex + uy * t, ey - ux * t) + Ci(cx, cy, r);
    },
  },
  light: {
    cat: 'electrical', name: 'Ceiling Light Point', w: 300, d: 300, kw: 'ceiling light point lamp lampu siling titik',
    draw: (W, D) => {
      const a = Math.SQRT1_2;
      return El(0, 0, W / 2, D / 2) + Ln(-W / 2 * a, -D / 2 * a, W / 2 * a, D / 2 * a) + Ln(W / 2 * a, -D / 2 * a, -W / 2 * a, D / 2 * a);
    },
  },
  downlight: {
    cat: 'electrical', name: 'Downlight', w: 200, d: 200, kw: 'downlight recessed spotlight lampu siling downlight',
    draw: (W, D) => El(0, 0, W / 2, D / 2) + El(0, 0, W * 0.25, D * 0.25),
  },
  ceiling_fan: {
    cat: 'electrical', name: 'Ceiling Fan', w: 1400, d: 1400, kw: 'ceiling fan kipas siling',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2;
      const p = (u, v, a) => {
        const c = Math.cos(a), s = Math.sin(a);
        return `${(c * u - s * v) * hw} ${(s * u + c * v) * hd}`;
      };
      let s = libOval(hw, hd, 'nf dash');
      for (const deg of [-90, 30, 150]) {
        const a = deg * Math.PI / 180;
        s += libPa(`M${p(0.1, -0.06, a)} L${p(0.86, -0.13, a)} Q${p(1, 0, a)} ${p(0.86, 0.13, a)} L${p(0.1, 0.06, a)} Z`);
      }
      return s + El(0, 0, W * 0.09, D * 0.09) + El(0, 0, W * 0.03, D * 0.03);
    },
  },
  aircond: {
    cat: 'electrical', name: 'Air Conditioner (Wall Unit)', w: 900, d: 250, kw: 'air conditioner aircond aircon split unit ac penghawa dingin',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2;
      return R(-hw, -hd, W, D, Math.min(W, D) * 0.2, 'dash') + Ln(-hw + W * 0.05, hd - D * 0.3, hw - W * 0.05, hd - D * 0.3, 'dash') +
        Ln(-hw + W * 0.05, hd - D * 0.15, hw - W * 0.05, hd - D * 0.15, 'dash');
    },
  },

  /* ----- Outdoor ----- */
  car_sedan: { cat: 'outdoor', name: 'Car (Sedan)', w: 1800, d: 4600, kw: 'car sedan saloon parking porch kereta letak kereta garaj', draw: libCar([0.3, 0.42, 0.72, 0.83]) },
  car_mpv: { cat: 'outdoor', name: 'Car (MPV)', w: 1850, d: 4900, kw: 'car mpv van suv parking porch kereta letak kereta garaj', draw: libCar([0.2, 0.32, 0.86, 0.94]) },
  motorcycle: {
    cat: 'outdoor', name: 'Motorcycle', w: 750, d: 2000, kw: 'motorcycle motorbike scooter bike motosikal motor skuter',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2, hy = -hd + D * 0.22;
      return R(-W * 0.08, -hd, W * 0.16, D * 0.27, W * 0.06) + R(-W * 0.1, hd - D * 0.27, W * 0.2, D * 0.27, W * 0.07) +
        R(-hw, hy - D * 0.012, W, D * 0.024, D * 0.01) + R(-hw, hy - D * 0.02, W * 0.14, D * 0.04, D * 0.01) +
        R(hw - W * 0.14, hy - D * 0.02, W * 0.14, D * 0.04, D * 0.01) +
        El(0, -D * 0.06, W * 0.22, D * 0.15) + R(-W * 0.17, D * 0.04, W * 0.34, D * 0.28, W * 0.12);
    },
  },
  gate_sliding: {
    cat: 'outdoor', name: 'Sliding Gate', w: 4000, d: 150, kw: 'sliding gate pagar gelangsar pintu pagar',
    draw: (W, D, k) => {
      const hw = W / 2, hd = D / 2, n = clamp(Math.round(W / k / 300), 2, 60);
      let s = R(-hw, -hd, W, D);
      for (let i = 1; i < n; i++) s += Ln(-hw + W / n * i, -hd, -hw + W / n * i, hd);
      const ay = hd + Math.max(D, W * 0.04), ah = Math.max(D * 0.8, W * 0.025), x1 = -W * 0.3, x2 = W * 0.3;
      return s + Ln(x1, ay, x2, ay) + libPa(`M${x2 - ah * 1.5} ${ay - ah} L${x2} ${ay} L${x2 - ah * 1.5} ${ay + ah}`, 'nf');
    },
  },
  clothes_line: {
    cat: 'outdoor', name: 'Clothes Drying Rack', w: 1500, d: 800, kw: 'clothes drying rack line laundry ampaian jemuran penyidai',
    draw: (W, D, k) => {
      const hw = W / 2, hd = D / 2, e = W * 0.04, n = clamp(Math.round(D / k / 120), 2, 20);
      let s = libBox(-hw, -hd, W, D) + R(-hw, -hd, e, D) + R(hw - e, -hd, e, D);
      for (let i = 1; i < n; i++) s += Ln(-hw + e, -hd + D / n * i, hw - e, -hd + D / n * i);
      return s;
    },
  },
  tree: {
    cat: 'outdoor', name: 'Tree', w: 1500, d: 1500, kw: 'tree plant landscape garden pokok pohon tanaman taman',
    draw: (W, D) => {
      const n = 11, pt = i => [Math.cos(i / n * 2 * Math.PI) * W * 0.44, Math.sin(i / n * 2 * Math.PI) * D * 0.44];
      let [x, y] = pt(0), d = `M${x} ${y}`;
      for (let i = 1; i <= n; i++) {
        const [x2, y2] = pt(i), r = Math.hypot(x2 - x, y2 - y) * 0.6;
        d += ` A${r} ${r} 0 0 1 ${x2} ${y2}`;
        [x, y] = [x2, y2];
      }
      let s = libPa(d + ' Z');
      for (let i = 0; i < 5; i++) {
        const a = (i / 5 + 0.1) * 2 * Math.PI;
        s += Ln(0, 0, Math.cos(a) * W * 0.25, Math.sin(a) * D * 0.25);
      }
      return s + Ci(0, 0, Math.min(W, D) * 0.04);
    },
  },
});
