'use strict';

/* ---------- Furniture ---------- */

// SVG primitives (px coords, origin at furniture centre; back = -y)
const n2 = v => +v.toFixed(2);
const cl = c => (c ? ` class="${c}"` : '');
const R = (x, y, w, h, rx = 0, c = '') =>
  `<rect${cl(c)} x="${n2(x)}" y="${n2(y)}" width="${n2(Math.max(w, 0))}" height="${n2(Math.max(h, 0))}"${rx ? ` rx="${n2(rx)}"` : ''}/>`;
const Ci = (cx, cy, r) => `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}"/>`;
const El = (cx, cy, rx, ry) => `<ellipse cx="${n2(cx)}" cy="${n2(cy)}" rx="${n2(rx)}" ry="${n2(ry)}"/>`;
const Ln = (x1, y1, x2, y2, c = '') => `<line${cl(c)} x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}"/>`;
const Pa = (d, c = '') => `<path${cl(c)} d="${d.replace(/-?\d+\.\d+/g, m => n2(+m))}"/>`;

// Each draw function takes (W, D, k): width & depth in px, k = px per mm
const drawSofa = n => (W, D) => {
  const hw = W / 2, hd = D / 2, a = Math.min(W * 0.12, D * 0.22), b = D * 0.22;
  let s = R(-hw, -hd, W, D, Math.min(W, D) * 0.06) + R(-hw + a, -hd, W - 2 * a, b) +
    R(-hw, -hd, a, D, a * 0.3) + R(hw - a, -hd, a, D, a * 0.3);
  const cw = (W - 2 * a) / n;
  for (let i = 1; i < n; i++) s += Ln(-hw + a + cw * i, -hd + b, -hw + a + cw * i, hd);
  return s;
};

const drawDining = n => (W, D) => {
  const hw = W / 2, hd = D / 2, td = D * 0.54, cw = W / n * 0.62, ch = (D - td) / 2 * 1.15;
  let s = '';
  for (let i = 0; i < n; i++) {
    const cx = -hw + W / n * (i + 0.5);
    s += R(cx - cw / 2, -hd, cw, ch, cw * 0.15) + Ln(cx - cw / 2, -hd + ch * 0.25, cx + cw / 2, -hd + ch * 0.25);
    s += R(cx - cw / 2, hd - ch, cw, ch, cw * 0.15) + Ln(cx - cw / 2, hd - ch * 0.25, cx + cw / 2, hd - ch * 0.25);
  }
  return s + R(-hw, -td / 2, W, td, Math.min(W, td) * 0.04);
};

const drawBed = pillows => (W, D) => {
  const hw = W / 2, hd = D / 2, hb = D * 0.04, g = W * 0.06;
  const pw = (W - g * (pillows + 1)) / pillows, ph = D * 0.13, y0 = -hd + D * 0.3;
  let s = R(-hw, -hd, W, D) + R(-hw, -hd, W, hb);
  for (let i = 0; i < pillows; i++) s += R(-hw + g + i * (pw + g), -hd + hb + D * 0.03, pw, ph, ph * 0.3);
  return s + Ln(-hw, y0, hw, y0) + Pa(`M${hw - W * 0.3} ${y0} L${hw} ${y0 + W * 0.3}`, 'nf');
};

const FURN_CATS = [
  { id: 'living', name: 'Living Room', kw: 'ruang tamu' },
  { id: 'bedroom', name: 'Bedroom', kw: 'bilik tidur' },
  { id: 'kitchen', name: 'Kitchen', kw: 'dapur' },
  { id: 'bath', name: 'Bathroom & WC', kw: 'bilik air tandas toilet' },
];

// w × d = default size (mm). kw = extra search keywords.
const FURN = {
  sofa3: { cat: 'living', name: '3-Seater Sofa', w: 2100, d: 900, kw: 'sofa couch settee 3-seater tempat', draw: drawSofa(3) },
  sofa2: { cat: 'living', name: '2-Seater Sofa', w: 1500, d: 900, kw: 'sofa couch loveseat 2-seater tempat', draw: drawSofa(2) },
  armchair: { cat: 'living', name: 'Armchair', w: 900, d: 850, kw: 'armchair sofa kerusi', draw: drawSofa(1) },
  coffee: {
    cat: 'living', name: 'Coffee Table', w: 1200, d: 600, kw: 'coffee table meja kopi',
    draw: (W, D) => R(-W / 2, -D / 2, W, D, Math.min(W, D) * 0.1) + R(-W * 0.42, -D * 0.35, W * 0.84, D * 0.7, Math.min(W, D) * 0.06),
  },
  tv: {
    cat: 'living', name: 'TV Console', w: 1800, d: 450, kw: 'tv cabinet console kabinet',
    draw: (W, D) => R(-W / 2, -D / 2, W, D) + R(-W * 0.3, -D * 0.35, W * 0.6, D * 0.15),
  },
  dining4: { cat: 'living', name: '4-Seat Dining Set', w: 1200, d: 1500, kw: 'dining table set makan meja kerusi', draw: drawDining(2) },
  dining6: { cat: 'living', name: '6-Seat Dining Set', w: 1800, d: 1500, kw: 'dining table set makan meja kerusi', draw: drawDining(3) },

  bed_king: { cat: 'bedroom', name: 'King Bed', w: 1800, d: 2000, kw: 'bed katil king', draw: drawBed(2) },
  bed_queen: { cat: 'bedroom', name: 'Queen Bed', w: 1500, d: 1900, kw: 'bed katil queen', draw: drawBed(2) },
  bed_single: { cat: 'bedroom', name: 'Single Bed', w: 900, d: 1900, kw: 'bed katil single bujang', draw: drawBed(1) },
  wardrobe: {
    cat: 'bedroom', name: 'Wardrobe', w: 1800, d: 600, kw: 'wardrobe almari pakaian closet',
    draw: (W, D, k) => {
      const hw = W / 2, hd = D / 2;
      let s = R(-hw, -hd, W, D) + Ln(-hw, hd - D * 0.1, hw, hd - D * 0.1) + Ln(-hw + W * 0.04, 0, hw - W * 0.04, 0, 'dash');
      const n = clamp(Math.round(W / k / 200), 3, 14);
      for (let i = 0; i < n; i++) {
        const x = -hw + W / n * (i + 0.5);
        s += Ln(x - D * 0.08, -D * 0.22, x + D * 0.08, D * 0.22);
      }
      return s;
    },
  },
  nightstand: {
    cat: 'bedroom', name: 'Bedside Table', w: 450, d: 400, kw: 'nightstand bedside side table meja sisi lampu',
    draw: (W, D) => R(-W / 2, -D / 2, W, D) + Ci(0, 0, Math.min(W, D) * 0.22),
  },
  desk: {
    cat: 'bedroom', name: 'Study Desk', w: 1200, d: 1000, kw: 'desk study meja tulis kerusi',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2, dd = D * 0.58, cw = Math.min(W * 0.4, D * 0.5), ch = D * 0.45;
      return R(-cw / 2, hd - ch, cw, ch, cw * 0.2) + Ln(-cw / 2, hd - ch * 0.22, cw / 2, hd - ch * 0.22) + R(-hw, -hd, W, dd);
    },
  },
  dresser: {
    cat: 'bedroom', name: 'Dressing Table', w: 1000, d: 800, kw: 'dresser dressing table vanity meja solek cermin',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2, td = D * 0.55;
      return Ci(0, hd - D * 0.2, Math.min(W * 0.18, D * 0.2)) + R(-hw, -hd, W, td) + R(-W * 0.3, -hd, W * 0.6, td * 0.12);
    },
  },

  kcab: {
    cat: 'kitchen', name: 'Base Cabinet', w: 2400, d: 600, kw: 'kitchen base cabinet counter kabinet dapur',
    draw: (W, D, k) => {
      const hw = W / 2, hd = D / 2, fy = hd - D * 0.08;
      let s = R(-hw, -hd, W, D) + Ln(-hw, fy, hw, fy);
      const n = Math.max(1, Math.round(W / k / 600));
      for (let i = 1; i < n; i++) s += Ln(-hw + W / n * i, -hd, -hw + W / n * i, fy, 'dash');
      return s;
    },
  },
  kcab_l: {
    cat: 'kitchen', name: 'L-Shaped Base Cabinet', w: 2400, d: 1800, kw: 'kitchen base cabinet corner l-shaped l kabinet sudut',
    draw: (W, D, k) => {
      const hw = W / 2, hd = D / 2, dp = Math.min(600 * k, W * 0.45, D * 0.45), f = dp * 0.92;
      return Pa(`M${-hw} ${-hd} H${hw} V${-hd + dp} H${-hw + dp} V${hd} H${-hw} Z`) +
        Pa(`M${hw} ${-hd + f} H${-hw + f} V${hd}`, 'nf');
    },
  },
  ksink: {
    cat: 'kitchen', name: 'Kitchen Sink', w: 800, d: 600, kw: 'sink sinki kitchen dapur',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2, m = Math.min(W, D);
      return R(-hw, -hd, W, D) + R(-W * 0.38, -hd + D * 0.2, W * 0.76, D * 0.62, m * 0.08) +
        Ci(0, -hd + D * 0.51, m * 0.05) + Ln(0, -hd + D * 0.05, 0, -hd + D * 0.2);
    },
  },
  hob: {
    cat: 'kitchen', name: '4-Burner Hob', w: 600, d: 600, kw: 'hob stove cooker burner dapur gas 4 api tungku',
    draw: (W, D) => {
      const m = Math.min(W, D);
      return R(-W / 2, -D / 2, W, D) + Ci(-W / 4, -D / 4, m * 0.17) + Ci(W / 4, -D / 4, m * 0.12) +
        Ci(-W / 4, D / 4, m * 0.12) + Ci(W / 4, D / 4, m * 0.17);
    },
  },
  hob2: {
    cat: 'kitchen', name: '2-Burner Hob', w: 720, d: 420, kw: 'hob stove cooker burner dapur gas 2 api tungku',
    draw: (W, D) => {
      const m = Math.min(W / 2, D);
      return R(-W / 2, -D / 2, W, D) + Ci(-W / 4, 0, m * 0.34) + Ci(-W / 4, 0, m * 0.16) +
        Ci(W / 4, 0, m * 0.34) + Ci(W / 4, 0, m * 0.16);
    },
  },
  fridge: {
    cat: 'kitchen', name: 'Refrigerator', w: 700, d: 700, kw: 'fridge refrigerator peti sejuk ais',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2, fy = hd - D * 0.12;
      return R(-hw, -hd, W, D) + Ln(-hw, fy, hw, fy) + Ln(-W * 0.05, fy + D * 0.04, -W * 0.05, hd) +
        Ln(W * 0.05, fy + D * 0.04, W * 0.05, hd) + Ln(-hw, -hd, hw, fy, 'dash') + Ln(hw, -hd, -hw, fy, 'dash');
    },
  },
  washer: {
    cat: 'kitchen', name: 'Washing Machine', w: 600, d: 600, kw: 'washing machine washer mesin basuh dobi',
    draw: (W, D) => {
      const m = Math.min(W, D);
      return R(-W / 2, -D / 2, W, D) + Ln(-W / 2, -D * 0.34, W / 2, -D * 0.34) + Ci(0, D * 0.08, m * 0.33) + Ci(0, D * 0.08, m * 0.24);
    },
  },

  wc: {
    cat: 'bath', name: 'Water Closet', w: 400, d: 700, kw: 'toilet wc water closet tandas duduk jamban mangkuk',
    draw: (W, D) => {
      const hd = D / 2, cy = -hd + D * 0.62;
      return El(0, cy, W * 0.42, D * 0.38) + El(0, cy + D * 0.03, W * 0.3, D * 0.27) + R(-W / 2, -hd, W, D * 0.24, W * 0.06);
    },
  },
  squat: {
    cat: 'bath', name: 'Squat Toilet', w: 450, d: 600, kw: 'squat toilet tandas cangkung jamban',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2;
      return R(-hw, -hd, W, D, W / 2) + El(0, D * 0.12, W * 0.26, D * 0.27) +
        R(-hw + W * 0.07, -hd + D * 0.14, W * 0.17, D * 0.28, W * 0.05) + R(hw - W * 0.24, -hd + D * 0.14, W * 0.17, D * 0.28, W * 0.05);
    },
  },
  basin: {
    cat: 'bath', name: 'Wash Basin', w: 500, d: 400, kw: 'basin sink sinki wash',
    draw: (W, D) => {
      const m = Math.min(W, D);
      return R(-W / 2, -D / 2, W, D, m * 0.3) + El(0, D * 0.06, W * 0.36, D * 0.3) + Ci(0, D * 0.06, m * 0.04) +
        Ln(0, -D * 0.46, 0, -D * 0.3);
    },
  },
  shower: {
    cat: 'bath', name: 'Shower', w: 900, d: 900, kw: 'shower pancuran mandi',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2;
      return R(-hw, -hd, W, D) + Ln(-hw, -hd, hw, hd, 'dash') + Ln(hw, -hd, -hw, hd, 'dash') + Ci(0, 0, Math.min(W, D) * 0.06);
    },
  },
  bathtub: {
    cat: 'bath', name: 'Bathtub', w: 1700, d: 750, kw: 'bathtub bath tub tab mandi',
    draw: (W, D) => {
      const hw = W / 2, hd = D / 2, m = Math.min(W, D);
      return R(-hw, -hd, W, D, m * 0.05) + R(-hw + W * 0.05, -hd + D * 0.1, W * 0.9, D * 0.8, D * 0.35) +
        Ci(-hw + W * 0.14, 0, m * 0.05);
    },
  },
  vanity: {
    cat: 'bath', name: 'Vanity Unit', w: 800, d: 500, kw: 'vanity unit cabinet basin kabinet sinki',
    draw: (W, D) => {
      const m = Math.min(W, D);
      return R(-W / 2, -D / 2, W, D) + El(0, D * 0.05, W * 0.3, D * 0.3) + Ci(0, D * 0.05, m * 0.04) +
        Ln(0, -D * 0.45, 0, -D * 0.25);
    },
  },
};

const isFurnTool = t => typeof t === 'string' && t.startsWith('furn:') && Object.hasOwn(FURN, t.slice(5));
const isAnnoTool = t => t === 'text' || t === 'north';
const isPlaceTool = t => isOpeningType(t) || isFurnTool(t) || isAnnoTool(t);

function furnIcon(kind) {
  const f = FURN[kind], k = 20 / Math.max(f.w, f.d);
  return `<svg class="ficon" viewBox="-12 -12 24 24">${f.draw(f.w * k, f.d * k, k)}</svg>`;
}

/* ---------- Tool palette: definitions ---------- */

const TOOL_META = {
  select: { label: 'Select', title: 'Select / move (V, Esc)', kw: 'select pilih alih',
    icon: '<svg viewBox="0 0 24 24"><path d="M6 3l13 8-6 1.5L10 19z" fill="currentColor"/></svg>' },
  wall: { label: 'Wall', title: 'Wall (W)', kw: 'wall dinding',
    icon: '<svg viewBox="0 0 24 24"><path d="M5 20V5h15" fill="none" stroke="currentColor" stroke-width="3.5"/></svg>' },
  room: { label: 'Room', title: 'Room (R)', kw: 'room ruang bilik',
    icon: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" fill="currentColor" fill-opacity=".15" stroke="currentColor" stroke-width="2"/></svg>' },
  pocket: { label: 'Pocket Door', title: 'Pocket door (slides into the wall)', kw: 'door pocket pintu sorong masuk dinding',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M0 12h4M20 12h4" stroke-width="5"/><rect x="0.8" y="10.2" width="10" height="3.6" stroke-dasharray="2 1.5"/><rect x="6" y="11" width="10" height="2" fill="currentColor"/></svg>' },
  roller: { label: 'Roller Shutter', title: 'Roller shutter', kw: 'roller shutter pintu gulung grille',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M0 12h3M21 12h3" stroke-width="5"/><path d="M3 9.5h18" stroke-dasharray="2.5 1.5"/><rect x="3" y="8.5" width="2" height="2" fill="currentColor"/><rect x="19" y="8.5" width="2" height="2" fill="currentColor"/></svg>' },
  slidewin: { label: 'Sliding Window', title: 'Sliding window', kw: 'window sliding tingkap gelangsar sorong',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="8.5" width="20" height="7"/><path d="M2 11h11M11 13h11"/></svg>' },
  louvre: { label: 'Louvre (Nako)', title: 'Louvre window (nako)', kw: 'window louvre louver nako tingkap cermin bilah',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="8.5" width="20" height="7"/><path d="M3.5 14l3-4M7.5 14l3-4M11.5 14l3-4M15.5 14l3-4"/></svg>' },
  text: { label: 'Text', title: 'Text label / note', kw: 'text label note teks tulisan nota',
    icon: '<svg viewBox="0 0 24 24"><path d="M5 4h14v3h-2V6h-4v12h2v2H9v-2h2V6H7v1H5z" fill="currentColor"/></svg>' },
  north: { label: 'North Arrow', title: 'North arrow (Q to rotate)', kw: 'north arrow compass utara arah',
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 5l3.5 11-3.5-2.5L8.5 16z" fill="currentColor"/></svg>' },
  room_poly: { label: 'Polygon Room', title: 'Polygon room — click corners (L / U shapes)', kw: 'room polygon l-shape u-shape bilik poligon bentuk',
    icon: '<svg viewBox="0 0 24 24"><path d="M4 4h9v7h7v9H4z" fill="currentColor" fill-opacity=".15" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="4" cy="4" r="2" fill="currentColor"/><circle cx="13" cy="11" r="2" fill="currentColor"/></svg>' },
  room_auto: { label: 'Auto Room', title: 'Auto room — click inside walls to fill the space', kw: 'room auto detect fill bilik automatik',
    icon: '<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z" fill="none" stroke="currentColor" stroke-width="2.5"/><rect x="6.5" y="6.5" width="11" height="11" fill="currentColor" fill-opacity=".25"/><path d="M12 8.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="currentColor"/></svg>' },
  dim: { label: 'Dimension', title: 'Dimension (M)', kw: 'dimension measure ukur ukuran',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 7v10M21 7v10"/></svg>' },
  door: { label: 'Door', title: 'Door (D)', kw: 'door pintu',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 20h4M20 20h3" stroke-width="3"/><path d="M5 20V5"/><path d="M5 5a15 15 0 0 1 15 15" stroke-dasharray="2 2"/></svg>' },
  double: { label: 'Double Door', title: 'Double door', kw: 'door double pintu berkembar',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M0 20h3M21 20h3" stroke-width="3"/><path d="M3 20v-9M21 20v-9"/><path d="M3 11a9 9 0 0 1 9 9M21 11a9 9 0 0 0-9 9" stroke-dasharray="2 2"/></svg>' },
  double_uneven: { label: 'Unequal Double', title: 'Unequal double door (large + small leaf)', kw: 'door double unequal uneven pintu berkembar tak sama',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M0 20h3M21 20h3" stroke-width="3"/><path d="M3 20V8M21 20v-6"/><path d="M3 8a12 12 0 0 1 12 12M21 14a6 6 0 0 0-6 6" stroke-dasharray="2 2"/></svg>' },
  bifold1: { label: 'Bi-fold', title: 'Bi-fold door (folds to one side)', kw: 'door bifold folding pintu lipat',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M0 20h3M21 20h3" stroke-width="3"/><path d="M3 20l4.5-10 4.5 10" stroke-linejoin="round"/></svg>' },
  bifold: { label: 'Double Bi-fold', title: 'Double bi-fold door (folds to both sides)', kw: 'door bifold folding double pintu lipat',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M0 20h3M21 20h3" stroke-width="3"/><path d="M3 20l3-7 3 7M21 20l-3-7-3 7" stroke-linejoin="round"/></svg>' },
  slide2: { label: '2-Panel Sliding', title: '2-panel sliding door', kw: 'door sliding panel pintu gelangsar daun',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M0 12h4M20 12h4" stroke-width="4"/><rect x="4" y="8.5" width="9" height="2.5"/><rect x="11" y="13" width="9" height="2.5"/></svg>' },
  slide3: { label: '3-Panel Sliding', title: '3-panel sliding door', kw: 'door sliding panel pintu gelangsar daun',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M0 12h4M20 12h4" stroke-width="4"/><rect x="4" y="7.5" width="6.5" height="2.2"/><rect x="8.75" y="10.9" width="6.5" height="2.2"/><rect x="13.5" y="14.3" width="6.5" height="2.2"/></svg>' },
  opening: { label: 'Opening', title: 'Cased opening (doorless opening)', kw: 'cased opening bukaan lubang',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M0 12h5M19 12h5" stroke-width="5"/><path d="M5 9.5h14M5 14.5h14" stroke-dasharray="2 2"/></svg>' },
  window: { label: 'Window', title: 'Window (N)', kw: 'window tingkap',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="9" width="20" height="6"/><path d="M2 12h20"/></svg>' },
};

// Fixed palette sections; furniture sections are appended from FURN_CATS in ui.js
// (after js/library.js has added its items and categories)
const PALETTE_BASE = [
  { id: 'basic', name: 'Basics', kw: 'asas', tools: ['select', 'wall', 'room', 'room_poly', 'room_auto', 'dim'] },
  { id: 'openings', name: 'Doors & Windows', kw: 'pintu tingkap', tools: ['door', 'double', 'double_uneven', 'bifold1', 'bifold', 'slide2', 'slide3', 'pocket', 'roller', 'opening', 'window', 'slidewin', 'louvre'] },
  { id: 'annotations', name: 'Annotations', kw: 'anotasi nota label', tools: ['text', 'north'] },
];

function toolInfo(t) {
  if (isFurnTool(t)) {
    const f = FURN[t.slice(5)];
    return { label: f.name, title: `${f.name} (${f.w} × ${f.d} mm)`, kw: f.kw, icon: furnIcon(t.slice(5)) };
  }
  return TOOL_META[t];
}
