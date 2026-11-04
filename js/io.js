'use strict';

/* ---------- Files & export ---------- */

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const fileSlug = () => 'floorplan-' + (curSheet()?.name || 'sheet').replace(/[^\w\-]+/g, '_');

function saveFile() {
  download(new Blob([JSON.stringify(projectData(), null, 2)], { type: 'application/json' }), 'floorplan.json');
}

$('#file').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  let d;
  try { d = JSON.parse(await f.text()); } catch { d = null; }
  const hasWork = state.sheets.some(s => (s.id === state.cur ? state.items : s.items).length);
  if (hasWork && !confirm('Opening this file will replace all current sheets. Continue?')) return;
  if (!applyProject(d)) return setHint('Invalid file — expected a Floor Plan JSON file.', true);
  syncOptions();
  renderSheets();
  changed();
});

function exportSvgString() {
  const keepView = { ...state.view };
  const W = svg.clientWidth, H = svg.clientHeight;
  fit(true);
  render(true);
  const clone = svg.cloneNode(true);
  clone.setAttribute('width', W);
  clone.setAttribute('height', H);
  clone.setAttribute('viewBox', `0 0 ${W} ${H}`);
  // The underlay is only exported when "Print" is ticked for it
  const u = curUnderlay();
  if (!u || !u.visible || !u.print) clone.querySelector('#ulImg')?.remove();
  const str = new XMLSerializer().serializeToString(clone);
  state.view = keepView;
  render();
  return { str, W, H };
}

function exportSvg() {
  download(new Blob([exportSvgString().str], { type: 'image/svg+xml' }), fileSlug() + '.svg');
}

function exportPng() {
  const { str, W, H } = exportSvgString();
  const img = new Image();
  img.onload = () => {
    const k = 2;
    const c = document.createElement('canvas');
    c.width = W * k; c.height = H * k;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.scale(k, k);
    ctx.drawImage(img, 0, 0);
    c.toBlob(b => download(b, fileSlug() + '.png'), 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
}
