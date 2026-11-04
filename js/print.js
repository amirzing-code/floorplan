'use strict';

/* ---------- Print / PDF to scale ---------- */
// Each page is an SVG sized in real paper millimetres, so a 1:100 drawing measures true
// with a scale rule. The browser's print dialog does the rest ("Save as PDF" or a printer).

const PAPERS = { A4: [297, 210], A3: [420, 297], A2: [594, 420] }; // landscape, mm
const STD_SCALES = [10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1250, 2000, 2500, 5000];
const PRINT_K = 4;      // SVG units per paper mm (screen-tuned px sizes then print at sensible weights)
const PRINT_MARGIN = 10; // page margin, mm
const TB_H = 22;         // title block height, mm

function paperSize(p) {
  const [a, b] = PAPERS[p.paper] || PAPERS.A3;
  return p.orient === 'portrait' ? [b, a] : [a, b];
}

// Drawing area on the page (mm), above the title block
function printRegion(pw, ph) {
  return { x: PRINT_MARGIN, y: PRINT_MARGIN, w: pw - 2 * PRINT_MARGIN, h: ph - 2 * PRINT_MARGIN - TB_H - 3 };
}

// Scale for one sheet: { ratio (1:ratio), fits, empty }. "fit" = largest standard scale that fits.
function sheetScale(items, p) {
  const keep = state.items;
  state.items = items;
  const b = bounds();
  state.items = keep;
  if (!b) return { ratio: 100, fits: true, empty: true, b };
  const [pw, ph] = paperSize(p), rg = printRegion(pw, ph);
  const bw = Math.max(b.x1 - b.x0, 1), bh = Math.max(b.y1 - b.y0, 1);
  const need = Math.max(bw / rg.w, bh / rg.h); // smallest ratio that fits
  const ratio = p.scale === 'fit' ? (STD_SCALES.find(r => r >= need) || Math.ceil(need)) : +p.scale;
  return { ratio, fits: ratio >= need - 1e-9, empty: false, b };
}

const printSheets = p => {
  syncSheet();
  return p.sheets === 'all' ? state.sheets : [curSheet()];
};

// One-line summary for the dialog (scale chosen, or a cropping warning)
function printInfo(p) {
  const res = printSheets(p).map(s => ({ s, ...sheetScale(s.items, p) }));
  const bad = res.filter(r => !r.fits);
  if (bad.length) {
    return { warn: true, text: `At 1:${p.scale} the drawing is larger than ${p.paper} ${p.orient} and will be cropped (${bad.map(r => r.s.name).join(', ')}). Choose a smaller scale, a larger paper or Best fit.` };
  }
  const scales = [...new Set(res.map(r => '1:' + r.ratio))].join(', ');
  return { warn: false, text: `${res.length} page${res.length === 1 ? '' : 's'} · ${p.paper} ${p.orient} · scale ${scales}` };
}

function fmtDate(iso) {
  const d = iso ? new Date(iso + 'T00:00:00') : new Date();
  return isNaN(d) ? String(iso) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Scale bar on paper: a "nice" length in the current unit, about 40 mm long
function printScaleBar(x, y, ratio) {
  const K = PRINT_K, u = state.unit === 'ftin' ? 'ft' : state.unit, f = UNITS[u].f;
  const target = 40 * ratio / f;
  const p10 = Math.pow(10, Math.floor(Math.log10(target)));
  const n = target / p10, len = (n >= 5 ? 5 : n >= 2 ? 2 : 1) * p10;
  const mm = len * f / ratio, seg = mm / 4;
  let s = '';
  for (let i = 0; i < 4; i++) {
    s += `<rect x="${n2((x + i * seg) * K)}" y="${n2(y * K)}" width="${n2(seg * K)}" height="${n2(1.2 * K)}" class="${i % 2 ? 'sb-w' : 'sb-b'}"/>`;
  }
  return s + `<text class="tb-l" x="${n2(x * K)}" y="${n2((y - 1.2) * K)}">0</text>` +
    `<text class="tb-l" x="${n2((x + mm) * K)}" y="${n2((y - 1.2) * K)}" text-anchor="middle">${esc(num(len, 6) + ' ' + UNITS[u].name)}</text>`;
}

function titleBlock(pw, ph, sheet, pageNo, pages, ratio) {
  const K = PRINT_K, x0 = PRINT_MARGIN, y0 = ph - PRINT_MARGIN - TB_H, w = pw - 2 * PRINT_MARGIN;
  const m = state.meta;
  // [label, value, width fraction]
  const cells = [
    ['Project', m.project || '—', 0.28], ['Client', m.client || '—', 0.18], ['Drawing', sheet.name, 0.18],
    ['Drawn by', m.drawnBy || '—', 0.12], ['Date', fmtDate(m.date), 0.1], ['Scale', '1:' + ratio, 0.07], ['Sheet', `${pageNo} / ${pages}`, 0.07],
  ];
  let s = `<rect class="tb-line" x="${x0 * K}" y="${y0 * K}" width="${w * K}" height="${TB_H * K}"/>`;
  let x = x0;
  cells.forEach(([lab, val, fr], i) => {
    const cw = w * fr;
    if (i) s += `<line class="tb-line" x1="${n2(x * K)}" y1="${y0 * K}" x2="${n2(x * K)}" y2="${(y0 + TB_H) * K}"/>`;
    // Rough fit: ~0.62 × font size per character
    const maxChars = Math.max(4, Math.floor((cw - 4) / (i ? 2.3 : 2.8)));
    const v = String(val).length > maxChars ? String(val).slice(0, maxChars - 1) + '…' : String(val);
    s += `<text class="tb-l" x="${n2((x + 2) * K)}" y="${n2((y0 + 5) * K)}">${esc(lab)}</text>` +
      `<text class="tb-v${i ? '' : ' big'}" x="${n2((x + 2) * K)}" y="${n2((y0 + 14) * K)}">${esc(v)}</text>`;
    x += cw;
  });
  return s;
}

// Full HTML for all pages to print
function buildPrintPages(p) {
  const K = PRINT_K, [pw, ph] = paperSize(p), rg = printRegion(pw, ph);
  const sheets = printSheets(p);
  const keep = { items: state.items, view: { ...state.view } };
  const style = svg.querySelector('defs style').outerHTML +
    `<style>.tb-line{fill:none;stroke:#222;stroke-width:${0.3 * K}}` +
    `.tb-l{font:${1.9 * K}px "Google Sans",system-ui,sans-serif;fill:#666}` +
    `.tb-v{font:500 ${3.2 * K}px "Google Sans",system-ui,sans-serif;fill:#111}.tb-v.big{font-size:${4 * K}px;font-weight:700}` +
    `.sb-b{fill:#222}.sb-w{fill:#fff;stroke:#222;stroke-width:${0.2 * K}}</style>`;
  let html = '';
  sheets.forEach((sh, i) => {
    const sc = sheetScale(sh.items, p), f = 1 / sc.ratio, s = f * K;
    const cx = sc.b ? (sc.b.x0 + sc.b.x1) / 2 : 0, cy = sc.b ? (sc.b.y0 + sc.b.y1) / 2 : 0;
    state.items = sh.items;
    state.view = { s, ox: (rg.x + rg.w / 2) * K - cx * s, oy: (rg.y + rg.h / 2) * K - cy * s };
    const scene = underlayMarkup(sh.underlay) + buildScene(true, pw * K, ph * K, false);
    html += `<div class="print-page"><svg xmlns="http://www.w3.org/2000/svg" width="${pw}mm" height="${ph}mm" viewBox="0 0 ${pw * K} ${ph * K}">` +
      `<defs>${style}<clipPath id="pclip${i}"><rect x="${rg.x * K}" y="${rg.y * K}" width="${rg.w * K}" height="${rg.h * K}"/></clipPath></defs>` +
      `<rect width="100%" height="100%" fill="#fff"/>` +
      `<g clip-path="url(#pclip${i})">${scene}</g>` +
      `<rect class="tb-line" x="${rg.x * K}" y="${rg.y * K}" width="${rg.w * K}" height="${rg.h * K}"/>` +
      printScaleBar(rg.x + 4, rg.y + rg.h - 5, sc.ratio) +
      titleBlock(pw, ph, sh, i + 1, sheets.length, sc.ratio) +
      `</svg></div>`;
  });
  state.items = keep.items;
  state.view = keep.view;
  return html;
}

function doPrint() {
  const p = state.print, [pw, ph] = paperSize(p);
  let root = $('#printRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'printRoot';
    document.body.append(root);
  }
  root.innerHTML = buildPrintPages(p);
  root.style.setProperty('--pw', pw + 'mm');
  root.style.setProperty('--ph', ph + 'mm');
  $('#pageStyle').textContent = `@page { size: ${pw}mm ${ph}mm; margin: 0; }`;
  render();
  window.print();
}
window.addEventListener('afterprint', () => $('#printRoot')?.replaceChildren());

/* Print dialog */
const PD = {
  paper: '#pPaper', orient: '#pOrient', scale: '#pScale', sheets: '#pSheets',
  project: '#mProject', client: '#mClient', drawnBy: '#mDrawnBy', date: '#mDate',
};

function readPrintDialog() {
  for (const k of ['paper', 'orient', 'scale', 'sheets']) state.print[k] = $(PD[k]).value;
  for (const k of ['project', 'client', 'drawnBy', 'date']) state.meta[k] = $(PD[k]).value.trim();
}

function updatePrintInfo() {
  readPrintDialog();
  const info = printInfo(state.print), el = $('#pInfo');
  el.textContent = info.text;
  el.classList.toggle('warn', info.warn);
}

function openPrint() {
  if (!state.meta.date) state.meta.date = new Date().toISOString().slice(0, 10);
  for (const k of ['paper', 'orient', 'scale', 'sheets']) $(PD[k]).value = state.print[k];
  for (const k of ['project', 'client', 'drawnBy', 'date']) $(PD[k]).value = state.meta[k] || '';
  $('#pSheets').disabled = state.sheets.length < 2;
  updatePrintInfo();
  $('#printDlg').showModal();
}

$('#print').addEventListener('click', openPrint);
$('#printDlg').addEventListener('input', updatePrintInfo);
$('#printDlg').addEventListener('close', () => {
  readPrintDialog();
  persist();
  if ($('#printDlg').returnValue === 'print') doPrint();
});
