'use strict';

/* ---------- Init ---------- */

function samplePlan() {
  const w = (x1, y1, x2, y2, t = 150) => ({ id: uid(), type: 'wall', x1, y1, x2, y2, t });
  return [
    { id: uid(), type: 'room', x: 0, y: 0, w: 3500, h: 4000, name: 'Living Room' },
    { id: uid(), type: 'room', x: 3500, y: 0, w: 2500, h: 4000, name: 'Bedroom' },
    w(0, 0, 6000, 0), w(6000, 0, 6000, 4000), w(6000, 4000, 0, 4000), w(0, 4000, 0, 0),
    w(3500, 0, 3500, 4000, 100),
    { id: uid(), type: 'door', x: 1500, y: 4000, w: 900, t: 150, rot: 0, fx: 1, fy: 1 },
    { id: uid(), type: 'door', x: 3500, y: 3000, w: 800, t: 100, rot: 90, fx: 1, fy: 1 },
    { id: uid(), type: 'window', x: 1750, y: 0, w: 1500, t: 150, rot: 0, fx: 1, fy: 1 },
    { id: uid(), type: 'window', x: 4750, y: 0, w: 1200, t: 150, rot: 0, fx: 1, fy: 1 },
    { id: uid(), type: 'dim', x1: 0, y1: -700, x2: 6000, y2: -700 },
  ];
}

let palOpen = true;
try { palOpen = localStorage.getItem('floorplan.palette') !== '0'; } catch { /* ignore */ }
setPalette(palOpen);

if (!load()) applyProject({ sheets: [{ name: 'Option A', items: samplePlan() }] });
syncOptions();
setTool('select');
renderSheets();
new ResizeObserver(() => render()).observe(svg);
changed();

// Installable / offline app — only when served over http(s) (e.g. GitHub Pages), not from file://
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* still works online without it */ });
}
