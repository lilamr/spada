/* ═══════════════════════════════════════════════════════════
   SpaDa — HELPERS & STATE
   State vars, utility functions, tile layer definitions.
   LAYERS and PALETTES are injected by Python in dashboard.html.
═══════════════════════════════════════════════════════════ */

/* ── Runtime state ── */
let map, vmap, lfLayers = {}, vmLayer = null;
let curTab = 'map', sbOpen = true;
let attrAll = [], attrFiltered = [], attrLyrId = null;
let activeFilter = { col: null, op: null, val: null };
let sortCol = null, sortAsc = true, chartInst = null;
let pvData = null, pvRowKeys = [], pvColKeys = [], pvFields = {};
let pvSortCol = null, pvSortAsc = true;
let vmTimesteps = [], vmTimeLayers = {};
let chartLabels = [], chartDatasets = [], chartFy = '', chartSortDir = 0;
let vmActiveTile = null;
let pvRowRecords = [];

/* ── Global filter state (per layer) ──
   globalFilters[layerId] = { col, op, val } | null
   Diisi dari tab Atribut, dikonsumsi oleh Pivot, Chart, VM.
──────────────────────────────────────── */
const globalFilters = {};

/** Kembalikan features layer yang sudah difilter sesuai globalFilters. */
function getFilteredFeatures(layer) {
  const f = globalFilters[layer.id];
  if (!f || !f.col) return layer.geojson.features;
  return layer.geojson.features.filter(feat =>
    matchVal(feat.properties?.[f.col], f.op, f.val)
  );
}

/** Simpan filter global untuk layer tertentu dan update indikator. */
function setGlobalFilter(layerId, col, op, val) {
  globalFilters[layerId] = col ? { col, op, val } : null;
  _updateFilterIndicator();
}

/** Hapus filter global untuk layer tertentu. */
function clearGlobalFilter(layerId) {
  delete globalFilters[layerId];
  _updateFilterIndicator();
}

/** Tampilkan badge 🔴 di tab Atribut jika ada filter aktif. */
function _updateFilterIndicator() {
  const anyActive = Object.values(globalFilters).some(f => f && f.col);
  const attrTab = document.querySelector('.tab[onclick*="\'attr\'"]');
  if (attrTab) attrTab.innerHTML = anyActive
    ? '📊 Atribut <span style="color:#ef4444;font-size:8px">●</span>'
    : '📊 Atribut';
}

/* ── Tile config — URL + options terpisah agar bisa di-reuse di vm.js ── */
const TILE_CONFIGS = {
  cd:   { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',   opts: { attribution: '© CartoDB', maxZoom: 19, crossOrigin: 'anonymous' } },
  osm:  { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',               opts: { attribution: '© OSM',     maxZoom: 19, crossOrigin: 'anonymous' } },
  cl:   { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',   opts: { attribution: '© CartoDB', maxZoom: 19, crossOrigin: 'anonymous' } },
  esri: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', opts: { attribution: '© ESRI', maxZoom: 19, crossOrigin: 'anonymous' } },
  topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',                 opts: { attribution: '© OpenTopo', maxZoom: 17, crossOrigin: 'anonymous' } },
};

const TILES = {
  cd:   L.tileLayer(TILE_CONFIGS.cd.url,   TILE_CONFIGS.cd.opts),
  osm:  L.tileLayer(TILE_CONFIGS.osm.url,  TILE_CONFIGS.osm.opts),
  cl:   L.tileLayer(TILE_CONFIGS.cl.url,   TILE_CONFIGS.cl.opts),
  esri: L.tileLayer(TILE_CONFIGS.esri.url, TILE_CONFIGS.esri.opts),
  topo: L.tileLayer(TILE_CONFIGS.topo.url, TILE_CONFIGS.topo.opts),
};
let activeTile = TILES.cd;

/* ── Field helpers ── */
function fieldAlias(layer, name) {
  const f = layer.all_fields.find(x => x.name === name);
  return f ? f.alias : name;
}
function numericFields(layer)     { return layer.all_fields.filter(f => f.type === 'numeric'); }
function categoricalFields(layer) { return layer.all_fields.filter(f => f.type === 'categorical'); }
function allFieldsOpts(layer)     { return layer.all_fields.map(f => `<option value="${f.name}">${f.alias}</option>`).join(''); }
function numericFieldsOpts(layer) { return numericFields(layer).map(f => `<option value="${f.name}">${f.alias}</option>`).join(''); }
function categoricalFieldsOpts(layer) { return categoricalFields(layer).map(f => `<option value="${f.name}">${f.alias}</option>`).join(''); }

/* ── Colour & number utilities ── */
function rgba(h, a) {
  const r = parseInt(h.slice(1,3), 16), g = parseInt(h.slice(3,5), 16), b = parseInt(h.slice(5,7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function numFmt(v) {
  if (v === null || v === undefined) return '—';
  return typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2)) : String(v);
}
function hmColor(v, mn, mx) {
  if (v === null || mx === mn) return '';
  const t = (v - mn) / (mx - mn);
  const r = Math.round(99 + t*156), g = Math.round(102 - t*80), b = Math.round(241 - t*195);
  return `rgba(${r},${g},${b},.3)`;
}
function colorScale(v, mn, mx, pal) {
  if (mx === mn) return pal[Math.floor(pal.length / 2)];
  const t = Math.max(0, Math.min(1, (v - mn) / (mx - mn)));
  return pal[Math.floor(t * (pal.length - 1))];
}
function getNumVals(features, field) {
  return features.map(f => parseFloat(f.properties?.[field])).filter(v => !isNaN(v));
}

/* ── Aggregation ── */
function aggVals(arr, agg) {
  if (!arr || !arr.length) return null;
  const nums = arr.map(Number).filter(x => !isNaN(x));
  if (agg === 'count') return arr.length;
  if (!nums.length) return null;
  if (agg === 'sum')  return nums.reduce((a, b) => a + b, 0);
  if (agg === 'mean') return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (agg === 'min')  return Math.min(...nums);
  if (agg === 'max')  return Math.max(...nums);
  return null;
}

/* ── CSV / download utilities ── */
function csvEsc(v) {
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}
function dlText(text, name, mime) {
  const a = document.createElement('a');
  a.download = name;
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.click();
}
