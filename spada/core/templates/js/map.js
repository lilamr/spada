/* ═══════════════════════════════════════════════════════════
   SpaDa — MAP
   Peta tematik: init, basemap, sidebar, layer render, PNG export.
═══════════════════════════════════════════════════════════ */

function toggleCtrl(ctrlId, restoreId) {
  const ctrl = document.getElementById(ctrlId);
  const btn  = document.getElementById(restoreId);
  const collapsed = ctrl.classList.toggle('collapsed');
  if (btn) btn.style.display = collapsed ? 'block' : 'none';
  setTimeout(() => { map && map.invalidateSize(); vmap && vmap.invalidateSize(); }, 250);
}

function init() {
  map = L.map('map', { zoomControl: true, attributionControl: false });
  activeTile = TILES.cd;
  activeTile.addTo(map);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  map.on('mousemove', e =>
    document.getElementById('sb-coords').textContent =
      `Lat: ${e.latlng.lat.toFixed(5)}  Lon: ${e.latlng.lng.toFixed(5)}`
  );
  buildSidebar();
  renderAllLayers();
  buildLegends();
  initAttr();
  initPivot();
  initChart();
  initVm();
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'b') { e.preventDefault(); toggleSidebar(); }
  });
}

function changeBasemap(k) {
  map.removeLayer(activeTile);
  activeTile = TILES[k];
  activeTile.addTo(map);
  activeTile.bringToBack();
}

function toggleSidebar() {
  sbOpen = !sbOpen;
  document.getElementById('sidebar').classList.toggle('collapsed', !sbOpen);
  document.getElementById('btn-sb').textContent = sbOpen ? '◀' : '▶';
  document.getElementById('btn-sb-float').style.display = sbOpen ? 'none' : 'block';
  setTimeout(() => { map.invalidateSize(); if (vmap) vmap.invalidateSize(); }, 240);
}

function buildSidebar() {
  const el = document.getElementById('layer-list');
  el.innerHTML = '';
  LAYERS.slice().reverse().forEach(layer => {
    const n = layer.geojson.features ? layer.geojson.features.length : 0;
    const div = document.createElement('div');
    div.className = 'layer-item';
    div.innerHTML = `<div class="layer-head" data-id="${layer.id}">
      <div class="layer-dot" style="background:${layer.style.fill_color}"></div>
      <span class="layer-name" title="${layer.name}">${layer.name}</span>
      <span class="layer-badge">${n.toLocaleString()}</span>
      <span class="layer-vis ${layer.visible ? 'on' : ''}" onclick="toggleLyr(event,'${layer.id}')">${layer.visible ? '👁' : '🚫'}</span>
      <span class="layer-leg-toggle" onclick="toggleLegend(this,'${layer.id}')">▼</span>
    </div>
    <div class="layer-legend" id="leg-${layer.id}"></div>`;
    div.querySelector('.layer-head').addEventListener('click', e => {
      if (e.target.classList.contains('layer-vis') || e.target.classList.contains('layer-leg-toggle')) return;
      document.querySelectorAll('.layer-head').forEach(h => h.classList.remove('active'));
      div.querySelector('.layer-head').classList.add('active');
    });
    el.appendChild(div);
  });
}

function toggleLegend(btn, id) {
  btn.classList.toggle('open');
  const leg = document.getElementById('leg-' + id);
  leg.classList.toggle('open');
  if (leg.classList.contains('open') && !leg.innerHTML.trim()) buildLayerLegend(id, leg);
}

function buildLayerLegend(id, el) {
  const layer = LAYERS.find(l => l.id === id);
  if (!layer) return;
  const s = layer.style;
  let html = '';
  if (s.classify_method === 'single' || !s.classify_field) {
    html = `<div class="legend-item"><div class="legend-swatch" style="background:${s.fill_color}"></div><span>${layer.name}</span></div>`;
  } else if (s.classify_method === 'categorized' && s.color_map) {
    Object.entries(s.color_map).forEach(([cat, col]) => {
      html += `<div class="legend-item"><div class="legend-swatch" style="background:${col}"></div><span>${cat}</span></div>`;
    });
  } else if (s.classify_method === 'graduated' && s.color_map?.breaks) {
    const br = s.color_map.breaks, pl = s.color_map.palette;
    br.forEach((b, i) => {
      const nxt = br[i + 1];
      const lbl = nxt != null ? `${b.toFixed(2)} – ${nxt.toFixed(2)}` : ` ≥ ${b.toFixed(2)}`;
      html += `<div class="legend-item"><div class="legend-swatch" style="background:${pl[i] || pl[pl.length-1]}"></div><span>${lbl}</span></div>`;
    });
  }
  el.innerHTML = html || '<span style="color:var(--tx3);font-size:9px">Single color</span>';
}

function buildLegends() {
  const first = LAYERS.find(l => l.visible);
  if (first) {
    const btn = document.querySelector(`[onclick*="${first.id}"].layer-leg-toggle`);
    const leg = document.getElementById('leg-' + first.id);
    if (btn && leg) { btn.classList.add('open'); leg.classList.add('open'); buildLayerLegend(first.id, leg); }
  }
}

function toggleLyr(e, id) {
  e.stopPropagation();
  const l = LAYERS.find(x => x.id === id);
  if (!l) return;
  l.visible = !l.visible;
  l.visible ? lfLayers[id].addTo(map) : map.removeLayer(lfLayers[id]);
  const vis = document.querySelector(`[data-id="${id}"] .layer-vis`);
  if (vis) { vis.textContent = l.visible ? '👁' : '🚫'; vis.className = 'layer-vis' + (l.visible ? ' on' : ''); }
  updateSb();
}

function featureColor(f, s) {
  if (s.classify_method === 'single' || !s.classify_field) return s.fill_color;
  const v = f.properties[s.classify_field];
  if (s.classify_method === 'categorized') return s.color_map[String(v)] || s.fill_color;
  if (s.classify_method === 'graduated') {
    const br = s.color_map.breaks || [], pl = s.color_map.palette || [];
    for (let i = br.length - 1; i >= 0; i--) { if (v >= br[i]) return pl[i] || s.fill_color; }
    return pl[0] || s.fill_color;
  }
  return s.fill_color;
}

function renderAllLayers() {
  const bounds = [];
  LAYERS.forEach(layer => {
    const lf = buildLfLayer(layer);
    lfLayers[layer.id] = lf;
    if (layer.visible) lf.addTo(map);
    try { const b = lf.getBounds(); if (b.isValid()) bounds.push(b); } catch(e) {}
  });
  if (bounds.length) { let b = bounds[0]; bounds.slice(1).forEach(x => b = b.extend(x)); map.fitBounds(b, { padding: [22, 22] }); }
  updateSb();
}

function buildLfLayer(layer) {
  const s = layer.style;
  const isPt = s.geom_type && s.geom_type.toLowerCase().includes('point');
  const isLn = s.geom_type && (s.geom_type.toLowerCase().includes('line') || s.geom_type.toLowerCase().includes('string'));
  const gl = L.geoJSON(layer.geojson, {
    pointToLayer: (f, ll) => {
      const c = featureColor(f, s);
      return L.circleMarker(ll, { radius: s.point_radius, fillColor: c, color: s.stroke_color, weight: s.stroke_width, opacity: 1, fillOpacity: s.opacity });
    },
    style: f => {
      const c = featureColor(f, s);
      return { fillColor: c, color: isLn ? c : s.stroke_color, weight: s.stroke_width, opacity: 1, fillOpacity: s.opacity };
    },
    onEachFeature: (feature, obj) => {
      obj.on('click', e => { L.DomEvent.stopPropagation(e); showPopup(feature, e.latlng, layer); syncRow(feature, layer); });
      obj.on('mouseover', () => { if (!isPt) obj.setStyle({ weight: s.stroke_width + 2 }); });
      obj.on('mouseout',  () => { if (!isPt) gl.resetStyle(obj); });
    },
  });
  if (s.label_field) renderLabels(layer.geojson, s);
  return gl;
}

function showPopup(feature, latlng, layer) {
  const props = feature.properties || {};
  const pf = layer.popup_fields;
  let rows = pf ? pf.map(f => {
    const v = props[f.name];
    if (v === null || v === undefined || v === '') return '';
    return `<div class="pr"><span class="pk">${f.alias}</span><span class="pv">${v}</span></div>`;
  }).filter(Boolean).join('') : '';
  L.popup({ maxWidth: 270, maxHeight: 340 })
    .setLatLng(latlng)
    .setContent(`<div class="ph">📍 ${layer.name}</div>${rows || '<span style="font-size:9px;color:var(--tx3)">—</span>'}`)
    .openOn(map);
}

function renderLabels(geojson, s) {
  geojson.features.forEach(f => {
    if (!f.geometry) return;
    const val = f.properties[s.label_field];
    if (val === null || val === undefined) return;
    try {
      const c = L.geoJSON(f).getBounds().getCenter();
      const halo = s.label_halo ? 'text-shadow:0 0 3px #fff,-1px -1px 0 #fff,1px 1px 0 #fff;' : '';
      L.marker(c, { icon: L.divIcon({ className: '', iconSize: [0, 0],
        html: `<div style="font-family:'Space Grotesk',sans-serif;font-size:${s.label_size}px;font-weight:600;color:${s.label_color};white-space:nowrap;${halo}pointer-events:none;transform:translate(-50%,-50%)">${String(val)}</div>`
      }) }).addTo(map);
    } catch(e) {}
  });
}

function updateSb() {
  const vis = LAYERS.filter(l => l.visible);
  const tot = vis.reduce((s, l) => s + (l.geojson.features ? l.geojson.features.length : 0), 0);
  document.getElementById('sb-lyr').textContent = `${vis.length} layer · ${tot.toLocaleString()} fitur`;
}

function switchTab(tab) {
  curTab = tab;
  const tabs = ['map', 'attr', 'pivot', 'chart', 'vm'];
  document.querySelectorAll('.tab').forEach((b, i) => b.classList.toggle('active', tabs[i] === tab));
  document.getElementById('map-view').style.display   = tab === 'map'   ? 'flex' : 'none';
  document.getElementById('attr-view').style.display  = tab === 'attr'  ? 'flex' : 'none';
  document.getElementById('pivot-view').style.display = tab === 'pivot' ? 'flex' : 'none';
  document.getElementById('chart-view').style.display = tab === 'chart' ? 'flex' : 'none';
  document.getElementById('vm-view').style.display    = tab === 'vm'    ? 'flex' : 'none';
  /* Sidebar hanya tampil di tab Peta */
  const sb = document.getElementById('sidebar');
  const sbFloat = document.getElementById('btn-sb-float');
  if (tab === 'map') {
    sb.style.display = '';
    if (sbFloat && !sbOpen) sbFloat.style.display = 'block';
  } else {
    sb.style.display = 'none';
    if (sbFloat) sbFloat.style.display = 'none';
  }
  if (tab === 'map') setTimeout(() => map.invalidateSize(), 50);
  if (tab === 'vm' && vmap) setTimeout(() => vmap.invalidateSize(), 50);
}

/* ── Export overlay (legend + scale untuk PNG) ── */
function _buildExportOverlay() {
  const ovItems = document.getElementById('ov-items');
  if (!ovItems) return;
  ovItems.innerHTML = '';
  LAYERS.slice().reverse().forEach(layer => {
    if (!layer.visible) return;
    const s = layer.style;
    if (s.classify_method === 'single' || !s.classify_field) {
      const row = document.createElement('div'); row.className = 'ov-item';
      row.innerHTML = `<div class="ov-swatch" style="background:${s.fill_color}"></div><span>${layer.name}</span>`;
      ovItems.appendChild(row);
    } else if (s.classify_method === 'categorized' && s.color_map) {
      const hd = document.createElement('div'); hd.className = 'ov-item';
      hd.innerHTML = `<span style="color:var(--ac2);font-weight:600">${layer.name}</span>`; ovItems.appendChild(hd);
      Object.entries(s.color_map).forEach(([cat, col]) => {
        const row = document.createElement('div'); row.className = 'ov-item';
        row.innerHTML = `<div class="ov-swatch" style="background:${col}"></div><span>${cat}</span>`; ovItems.appendChild(row);
      });
    } else if (s.classify_method === 'graduated' && s.color_map?.breaks) {
      const hd = document.createElement('div'); hd.className = 'ov-item';
      hd.innerHTML = `<span style="color:var(--ac2);font-weight:600">${layer.name}</span>`; ovItems.appendChild(hd);
      const br = s.color_map.breaks, pl = s.color_map.palette;
      br.forEach((b, i) => {
        const nxt = br[i + 1];
        const lbl = nxt != null ? `${b.toFixed(1)}–${nxt.toFixed(1)}` : ` ≥ ${b.toFixed(1)}`;
        const row = document.createElement('div'); row.className = 'ov-item';
        row.innerHTML = `<div class="ov-swatch" style="background:${pl[i] || pl[pl.length-1]}"></div><span>${lbl}</span>`; ovItems.appendChild(row);
      });
    }
  });
  const scaleLine = document.querySelector('.leaflet-control-scale-line');
  const scaleEl = document.getElementById('map-export-scale');
  if (scaleLine && scaleEl) scaleEl.textContent = scaleLine.textContent;
}

/* ── PNG Export (pure Canvas API — tidak butuh html2canvas untuk peta) ── */
function _renderMapToCanvas(mapEl, cb) {
  const W = mapEl.offsetWidth, H = mapEl.offsetHeight;
  const out = document.createElement('canvas'); out.width = W * 2; out.height = H * 2;
  const ctx = out.getContext('2d'); ctx.scale(2, 2);
  ctx.fillStyle = '#0f1117'; ctx.fillRect(0, 0, W, H);

  /* Tile images — skip jika cross-origin (akan menyebabkan canvas tainted) */
  const mapRect = mapEl.getBoundingClientRect();
  const tileImgs = Array.from(mapEl.querySelectorAll('.leaflet-tile'))
    .filter(img => {
      if (!img.complete || img.naturalWidth === 0) return false;
      try {
        /* Cek apakah same-origin — tile CDN akan throw saat drawImage */
        const url = new URL(img.src);
        return url.origin === window.location.origin;
      } catch(e) { return false; }
    });

  tileImgs.forEach(img => {
    const r = img.getBoundingClientRect();
    try { ctx.drawImage(img, r.left - mapRect.left, r.top - mapRect.top, r.width, r.height); } catch(e) {}
  });

  /* SVG vector layers — aman karena generated locally */
  const svgEls = Array.from(mapEl.querySelectorAll('svg'));
  Promise.all(svgEls.map(svg => new Promise(res => {
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
    const img = new Image();
    const rect = svg.getBoundingClientRect();
    img.onload = () => {
      try { ctx.drawImage(img, rect.left - mapRect.left, rect.top - mapRect.top, rect.width, rect.height); } catch(e) {}
      URL.revokeObjectURL(url); res();
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(); };
    img.src = url;
  }))).then(() => cb(out, ctx, W, H));
}

function _drawLegendOnCanvas(ctx, ovEl, scEl, mapEl, W, H) {
  /* Gambar kotak legenda */
  if (ovEl && ovEl.style.display !== 'none') {
    const mr = mapEl.getBoundingClientRect();
    const or = ovEl.getBoundingClientRect();
    const ox = or.left - mr.left, oy = or.top - mr.top;
    ctx.fillStyle = 'rgba(26,29,39,0.92)';
    ctx.strokeStyle = '#2d3250'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(ox, oy, or.width, or.height, 7); ctx.fill(); ctx.stroke();
    /* Items legenda */
    const items = ovEl.querySelectorAll('.ov-item');
    let y = oy + 22;
    const title = ovEl.querySelector('.ov-title');
    if (title) {
      ctx.fillStyle = '#818cf8'; ctx.font = 'bold 9px sans-serif';
      ctx.fillText(title.textContent, ox + 10, oy + 14);
      ctx.strokeStyle = '#2d3250'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(ox + 8, oy + 17); ctx.lineTo(ox + or.width - 8, oy + 17); ctx.stroke();
    }
    items.forEach(item => {
      const swatch = item.querySelector('.ov-swatch');
      const span   = item.querySelector('span') || item;
      if (swatch) {
        ctx.fillStyle = swatch.style.background || '#6366f1';
        ctx.beginPath(); ctx.roundRect(ox + 10, y - 8, 12, 12, 2); ctx.fill();
        ctx.fillStyle = '#e2e8f0'; ctx.font = '9px sans-serif';
        ctx.fillText(span.textContent.trim().slice(0, 22), ox + 26, y + 2);
      } else {
        ctx.fillStyle = '#818cf8'; ctx.font = 'bold 9px sans-serif';
        ctx.fillText(item.textContent.trim().slice(0, 22), ox + 10, y + 2);
      }
      y += 16;
    });
  }
  /* Skala */
  if (scEl) {
    const txt = scEl.textContent;
    ctx.fillStyle = 'rgba(26,29,39,0.85)';
    ctx.beginPath(); ctx.roundRect(8, H - 24, 80, 18, 3); ctx.fill();
    ctx.fillStyle = '#94a3b8'; ctx.font = '9px monospace';
    ctx.fillText(txt, 12, H - 10);
  }
}

function dlMapPng() {
  _buildExportOverlay();
  const mapEl = document.getElementById('map');
  const ov = document.getElementById('map-export-overlay');
  const sc = document.getElementById('map-export-scale');
  if (ov) ov.style.display = 'block';
  if (sc) sc.style.display = 'block';
  _renderMapToCanvas(mapEl, (out, ctx, W, H) => {
    _drawLegendOnCanvas(ctx, ov, sc, mapEl, W, H);
    if (ov) ov.style.display = 'none';
    if (sc) sc.style.display = 'none';
    const a = document.createElement('a');
    a.download = 'spada-map.png';
    a.href = out.toDataURL('image/png');
    a.click();
  });
}

window.addEventListener('DOMContentLoaded', init);
