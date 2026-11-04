'use strict';

/* ---------- History & persistence ---------- */

function commit() {
  undoStack.push(JSON.stringify(state.items));
  if (undoStack.length > 200) undoStack.shift();
  redoStack = [];
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(state.items));
  state.items = JSON.parse(undoStack.pop());
  pruneSel();
  changed();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(state.items));
  state.items = JSON.parse(redoStack.pop());
  pruneSel();
  changed();
}

const curSheet = () => state.sheets.find(s => s.id === state.cur);

// Copy the active items/view back to the current sheet object
function syncSheet() {
  const s = curSheet();
  if (s) { s.items = state.items; s.view = { ...state.view }; }
}

function projectData() {
  syncSheet();
  return {
    app: 'floorplan', version: 2,
    unit: state.unit, snap: state.snap, def: state.def,
    meta: state.meta, print: state.print,
    cur: state.cur, sheets: state.sheets,
  };
}

// Accepts v2 format (sheets) and legacy v1 (items only → one sheet)
function applyProject(d) {
  let sheets = Array.isArray(d?.sheets) ? d.sheets
    : Array.isArray(d?.items) ? [{ name: 'Sheet 1', items: d.items, view: d.view }] : [];
  sheets = sheets.filter(s => Array.isArray(s?.items)).map(s => ({
    id: s.id || uid(), name: String(s.name || 'Sheet'), items: s.items, view: s.view?.s > 0 ? s.view : null,
    ...(s.underlay?.src ? { underlay: s.underlay } : {}),
  }));
  if (!sheets.length) return false;
  state.sheets = sheets;
  if (UNITS[d.unit]) state.unit = d.unit;
  if (d.snap > 0) state.snap = d.snap;
  if (d.def) Object.assign(state.def, d.def);
  if (d.meta) Object.assign(state.meta, d.meta);
  if (d.print) Object.assign(state.print, d.print);
  for (const k in histories) delete histories[k];
  state.cur = sheets.some(s => s.id === d.cur) ? d.cur : sheets[0].id;
  const s = curSheet();
  state.items = s.items;
  state.view = s.view ? { ...s.view } : null;
  if (!state.view) fit(true);
  undoStack = []; redoStack = [];
  state.sel = [];
  return true;
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(projectData())); } catch (err) {
      // Usually a full browser quota (big underlay images) — the work is still on screen
      if (err?.name === 'QuotaExceededError') {
        setHint('Browser storage is full, so autosave stopped. Use Save (Ctrl+S) to keep your work in a file, or remove large underlay images.', true);
      }
    }
  }, 250);
}
function load() {
  try { return applyProject(JSON.parse(localStorage.getItem(STORE_KEY))); } catch { return false; }
}

/* ---------- Sheets ---------- */

const histories = {}; // sheetId -> { undo, redo } (not persisted)

function switchSheet(id) {
  if (curSheet()) {
    syncSheet();
    histories[state.cur] = { undo: undoStack, redo: redoStack };
  }
  state.cur = id;
  const s = curSheet();
  state.items = s.items;
  state.view = s.view ? { ...s.view } : null;
  ({ undo: undoStack, redo: redoStack } = histories[id] || { undo: [], redo: [] });
  state.sel = [];
  draft = null; drag = null; typed = ''; showTyped();
  if (!state.view) fit(true);
  renderSheets();
  changed();
}

function nextSheetName() {
  let n = state.sheets.length + 1;
  while (state.sheets.some(s => s.name === `Sheet ${n}`)) n++;
  return `Sheet ${n}`;
}

// Clone items with new ids; groups are copied as new groups
// (a lone member of a group does not keep the group id)
function cloneItems(items) {
  const count = {}, gmap = {};
  for (const it of items) if (it.g) count[it.g] = (count[it.g] || 0) + 1;
  return items.map(it => {
    const c = { ...it, id: uid() };
    if (c.g) {
      if (count[c.g] > 1) c.g = gmap[c.g] ||= uid();
      else delete c.g;
    }
    return c;
  });
}

function addSheet(name, items = [], view = null, afterId = null) {
  syncSheet();
  const s = { id: uid(), name: name || nextSheetName(), items, view };
  const i = afterId ? state.sheets.findIndex(x => x.id === afterId) + 1 : state.sheets.length;
  state.sheets.splice(i, 0, s);
  switchSheet(s.id);
}

function duplicateSheet(id) {
  syncSheet();
  const src = state.sheets.find(s => s.id === id);
  addSheet(`${src.name} (copy)`, cloneItems(src.items), src.view ? { ...src.view } : null, id);
  if (src.underlay) {
    curSheet().underlay = { ...src.underlay };
    persist();
    render();
    renderUnderlayPanel();
  }
}

// Add all items from one sheet to another existing sheet (undoable on the target sheet)
function copyAllTo(srcId, dstId) {
  syncSheet();
  const src = state.sheets.find(s => s.id === srcId);
  const copies = cloneItems(src.items);
  if (state.cur !== dstId) switchSheet(dstId);
  commit();
  state.items.push(...copies);
  changed();
  setHint(`${copies.length} item${copies.length === 1 ? '' : 's'} copied from "${src.name}". Ctrl+Z to undo.`);
}

function moveSheet(id, dir) {
  const i = state.sheets.findIndex(s => s.id === id), j = i + dir;
  if (j < 0 || j >= state.sheets.length) return;
  [state.sheets[i], state.sheets[j]] = [state.sheets[j], state.sheets[i]];
  persist();
  renderSheets();
}

function deleteSheet(id) {
  if (state.sheets.length < 2) return;
  const i = state.sheets.findIndex(s => s.id === id);
  if (!confirm(`Delete sheet "${state.sheets[i].name}"? This cannot be undone.`)) return;
  state.sheets.splice(i, 1);
  delete histories[id];
  if (id === state.cur) {
    state.cur = null;
    switchSheet(state.sheets[Math.max(0, i - 1)].id);
  } else {
    persist();
    renderSheets();
  }
}

function renderSheets() {
  $('#sheetTabs').innerHTML = state.sheets.map(s => {
    const active = s.id === state.cur;
    return `<div class="sheet-tab${active ? ' active' : ''}" data-sheet="${s.id}" title="Double-click to rename · right-click for menu">` +
      `<span class="sname">${esc(s.name)}</span>` +
      (active ? `<button class="tab-menu" data-menu="${s.id}" title="Sheet menu">▾</button>` : '') + `</div>`;
  }).join('');
}

function startRename(id) {
  const tab = document.querySelector(`.sheet-tab[data-sheet="${id}"]`);
  const span = tab?.querySelector('.sname');
  if (!span) return;
  const s = state.sheets.find(x => x.id === id);
  const inp = document.createElement('input');
  inp.className = 'sheet-rename';
  inp.value = s.name;
  span.replaceWith(inp);
  inp.focus();
  inp.select();
  let done = false;
  const finish = ok => {
    if (done) return;
    done = true;
    if (ok && inp.value.trim()) s.name = inp.value.trim();
    persist();
    renderSheets();
    renderSummary();
  };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  inp.addEventListener('blur', () => finish(true));
}

function closeMenu() { $('#sheetMenu')?.remove(); }

function openSheetMenu(id, x, y) {
  closeMenu();
  const i = state.sheets.findIndex(s => s.id === id);
  const others = state.sheets.filter(s => s.id !== id);
  const m = document.createElement('div');
  m.className = 'menu';
  m.id = 'sheetMenu';
  m.innerHTML =
    `<button data-a="rename">Rename</button>` +
    `<button data-a="dup">Duplicate sheet</button>` +
    (others.length
      ? `<div class="menu-label">Copy all items to</div>` +
        others.map(s => `<button class="indent" data-a="copyto" data-to="${s.id}">${esc(s.name)}</button>`).join('')
      : '') +
    `<hr><button data-a="left"${i === 0 ? ' disabled' : ''}>Move left</button>` +
    `<button data-a="right"${i === state.sheets.length - 1 ? ' disabled' : ''}>Move right</button>` +
    `<hr><button class="danger" data-a="del"${state.sheets.length < 2 ? ' disabled' : ''}>Delete sheet</button>`;
  document.body.append(m);
  // Tabs sit at the bottom, so the menu opens upward
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.max(8, y - r.height) + 'px';
  m.addEventListener('click', e => {
    const b = e.target.closest('button[data-a]');
    if (!b || b.disabled) return;
    closeMenu();
    const a = b.dataset.a;
    if (a === 'rename') startRename(id);
    else if (a === 'dup') duplicateSheet(id);
    else if (a === 'copyto') copyAllTo(id, b.dataset.to);
    else if (a === 'left') moveSheet(id, -1);
    else if (a === 'right') moveSheet(id, 1);
    else if (a === 'del') deleteSheet(id);
  });
}

document.addEventListener('pointerdown', e => { if (!e.target.closest('#sheetMenu')) closeMenu(); }, true);

$('#sheetTabs').addEventListener('click', e => {
  if (e.target.closest('input')) return;
  const mb = e.target.closest('[data-menu]');
  if (mb) {
    const r = mb.getBoundingClientRect();
    return openSheetMenu(mb.dataset.menu, r.left, r.top - 4);
  }
  const tab = e.target.closest('[data-sheet]');
  if (tab && tab.dataset.sheet !== state.cur) switchSheet(tab.dataset.sheet);
});
$('#sheetTabs').addEventListener('dblclick', e => {
  if (e.target.closest('input, [data-menu]')) return;
  const tab = e.target.closest('[data-sheet]');
  if (tab) startRename(tab.dataset.sheet);
});
$('#sheetTabs').addEventListener('contextmenu', e => {
  const tab = e.target.closest('[data-sheet]');
  if (!tab || e.target.closest('input')) return;
  e.preventDefault();
  openSheetMenu(tab.dataset.sheet, e.clientX, e.clientY - 4);
});
$('#addSheet').addEventListener('click', () => addSheet());

/* ---------- Clipboard (can paste into other sheets) ---------- */

let clipboard = null;

const offsetItem = (c, off) => shiftItem(c, { ...c }, off, off);
const pasteOffset = () => Math.max(state.snap * 5, 300);

function copySel(cut) {
  const items = selItems();
  if (!items.length) return;
  // Cut: paste back at the original position, without offset
  clipboard = { items: items.map(i => ({ ...i })), sheet: cut ? null : state.cur };
  if (cut) deleteSel();
  setHint(`${items.length} item${items.length === 1 ? '' : 's'} ${cut ? 'cut' : 'copied'}. Switch sheet (if needed) and press Ctrl+V to paste.`);
}

function paste() {
  if (!clipboard) return;
  commit();
  // On the same sheet, offset slightly so it doesn't overlap the original
  const off = clipboard.sheet === state.cur ? pasteOffset() : 0;
  const copies = cloneItems(clipboard.items);
  if (off) copies.forEach(c => offsetItem(c, off));
  if (off) clipboard.items = copies.map(c => ({ ...c }));
  state.items.push(...copies);
  state.sel = copies.map(c => c.id);
  changed();
}

// Copy / move selected items to another sheet (same position)
function sendSelTo(dstId, move) {
  const items = selItems();
  if (!items.length || !state.sheets.some(s => s.id === dstId)) return;
  const srcName = curSheet().name;
  const copies = cloneItems(items);
  if (move) deleteSel();
  switchSheet(dstId);
  commit();
  state.items.push(...copies);
  state.sel = copies.map(c => c.id);
  changed();
  setHint(`${copies.length} item${copies.length === 1 ? '' : 's'} ${move ? 'moved' : 'copied'} from "${srcName}". Ctrl+Z to undo.`);
}

// Called after any change to items
function changed() {
  persist();
  render();
  renderProps();
  renderSummary();
  $('#undo').disabled = !undoStack.length;
  $('#redo').disabled = !redoStack.length;
}
