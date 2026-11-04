'use strict';

/* ---------- Underlay: a reference image (brochure plan, scan, photo) to trace over ---------- */
// Stored per sheet: sheet.underlay = { src (data URL), x, y, w, h (mm), opacity, visible, print }.
// Drawn in its own <image> behind the drawing so re-renders don't re-parse the big data URL.

const ulImg = $('#ulImg');
let ulShownSrc = null;
const curUnderlay = () => curSheet()?.underlay || null;

function updateUnderlay() {
  const u = curUnderlay();
  if (!u || !u.visible) { ulImg.setAttribute('visibility', 'hidden'); return; }
  if (ulShownSrc !== u.src) { ulImg.setAttribute('href', u.src); ulShownSrc = u.src; }
  const s = state.view.s;
  ulImg.setAttribute('x', X(u.x).toFixed(1));
  ulImg.setAttribute('y', Y(u.y).toFixed(1));
  ulImg.setAttribute('width', Math.max(u.w * s, 0).toFixed(1));
  ulImg.setAttribute('height', Math.max(u.h * s, 0).toFixed(1));
  ulImg.setAttribute('opacity', u.opacity);
  ulImg.setAttribute('visibility', 'visible');
}

// Markup for print pages (only when "include in print / export" is on)
function underlayMarkup(u) {
  if (!u || !u.visible || !u.print) return '';
  return `<image href="${u.src}" x="${X(u.x).toFixed(1)}" y="${Y(u.y).toFixed(1)}" width="${(u.w * state.view.s).toFixed(1)}" ` +
    `height="${(u.h * state.view.s).toFixed(1)}" opacity="${u.opacity}" preserveAspectRatio="none"/>`;
}

// Read an image file and shrink it (max side `max` px, JPEG) to keep project files small
function loadImage(file, max = 2400) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = reject;
    rd.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve({ src: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height });
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}

async function importUnderlay(file) {
  let im;
  try { im = await loadImage(file); } catch { return setHint('Could not read that image. Use a JPG or PNG file (for a PDF, export the page as an image first).', true); }
  // Start at ~80% of the visible canvas width, centred; the user then calibrates the scale
  const s = state.view.s, w = svg.clientWidth / s * 0.8, h = w * im.h / im.w;
  const cx = (svg.clientWidth / 2 - state.view.ox) / s, cy = (svg.clientHeight / 2 - state.view.oy) / s;
  const old = curUnderlay();
  curSheet().underlay = {
    src: im.src, x: cx - w / 2, y: cy - h / 2, w, h,
    opacity: old?.opacity ?? 0.5, visible: true, print: old?.print ?? false,
  };
  persist();
  render();
  renderUnderlayPanel();
  setTool('calib');
}

// Scale the underlay about p1 so that the picked distance equals `real` mm
function calibrate(p1, p2, real) {
  const u = curUnderlay(), d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (!u || d < 1e-6 || !(real > 0)) return;
  const k = real / d;
  Object.assign(u, { x: p1.x + (u.x - p1.x) * k, y: p1.y + (u.y - p1.y) * k, w: u.w * k, h: u.h * k });
  persist();
  render();
  setHint(`Underlay scaled — the picked distance is now ${fmt(real)}. Draw your walls over it.`);
}

// Second click of the calibration tool: ask for the real distance
function finishCalibration() {
  const d = draft;
  draft = null;
  const measured = Math.hypot(d.x2 - d.x1, d.y2 - d.y1);
  if (measured < 1) return render();
  const ans = prompt(`Real length of this line? (e.g. 6m, 600cm, 20'4")`, fmtVal(measured));
  if (ans !== null) {
    const real = parseLength(ans);
    if (real > 0) calibrate({ x: d.x1, y: d.y1 }, { x: d.x2, y: d.y2 }, real);
    else setHint('Invalid length — calibration cancelled.', true);
  }
  setTool('select');
}

function renderUnderlayPanel() {
  const u = curUnderlay(), card = $('#ulCard');
  card.hidden = !u;
  if (!u) return;
  $('#ulPanel').innerHTML =
    `<div class="field"><span class="muted">Opacity</span><input type="range" id="ulOpacity" min="0.1" max="1" step="0.05" value="${u.opacity}"></div>` +
    `<div class="btnrow">` +
    `<label class="chip"><input type="checkbox" id="ulVisible"${u.visible ? ' checked' : ''}><span>Visible</span></label>` +
    `<label class="chip" title="Include the image when printing / exporting"><input type="checkbox" id="ulPrint"${u.print ? ' checked' : ''}><span>Print</span></label></div>` +
    `<div class="btnrow"><button data-ul="calib">Calibrate scale</button><button data-ul="move" class="${state.tool === 'ulmove' ? 'on' : ''}">Move</button></div>` +
    `<div class="btnrow"><button data-ul="replace">Replace image</button><button data-ul="remove">Remove</button></div>` +
    `<p class="note">Calibrate: click two points on the image whose real distance you know, then type that distance.</p>`;
}

$('#ulPanel').addEventListener('input', e => {
  const u = curUnderlay();
  if (!u) return;
  if (e.target.id === 'ulOpacity') u.opacity = +e.target.value;
  if (e.target.id === 'ulVisible') u.visible = e.target.checked;
  if (e.target.id === 'ulPrint') u.print = e.target.checked;
  persist();
  updateUnderlay();
});
$('#ulPanel').addEventListener('click', e => {
  const a = e.target.dataset?.ul;
  if (!a) return;
  if (a === 'calib') setTool('calib');
  else if (a === 'move') setTool(state.tool === 'ulmove' ? 'select' : 'ulmove');
  else if (a === 'replace') $('#ulFile').click();
  else if (a === 'remove' && confirm('Remove the underlay image from this sheet?')) {
    delete curSheet().underlay;
    persist();
    render();
    setTool('select');
  }
  renderUnderlayPanel();
});

$('#underlay').addEventListener('click', () => $('#ulFile').click());
$('#ulFile').addEventListener('change', e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) importUnderlay(f);
});
