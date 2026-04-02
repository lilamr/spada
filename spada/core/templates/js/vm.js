/* ════════════════════════════════════════════════════════
   SpaDa — VM
   ════════════════════════════════════════════════════════ */

function initVm(){
  const vmSel=document.getElementById('vm-lyr');
  LAYERS.forEach(l=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.name;vmSel.appendChild(o);});
  if(LAYERS.length)updateVmFields();
}

function ensureVmap(){
  if(vmap)return;
  vmap=L.map('vmap',{zoomControl:true,attributionControl:false});
  vmActiveTile=L.tileLayer(TILE_CONFIGS.cd.url, TILE_CONFIGS.cd.opts);
  vmActiveTile.addTo(vmap);
  L.control.scale({imperial:false,position:'bottomleft'}).addTo(vmap);
  const bounds=[];LAYERS.forEach(layer=>{try{const b=L.geoJSON(layer.geojson).getBounds();if(b.isValid())bounds.push(b);}catch(e){}});
  if(bounds.length){let b=bounds[0];bounds.slice(1).forEach(x=>b=b.extend(x));vmap.fitBounds(b,{padding:[20,20]});}
}

function changeVmBasemap(k){
  if(!vmap)return;
  if(vmActiveTile)vmap.removeLayer(vmActiveTile);
  vmActiveTile=L.tileLayer(TILE_CONFIGS[k].url, TILE_CONFIGS[k].opts);
  vmActiveTile.addTo(vmap);vmActiveTile.bringToBack();
}

function updateVmFields(){
  const id=document.getElementById('vm-lyr').value;const layer=LAYERS.find(l=>l.id===id);if(!layer)return;
  const type=document.getElementById('vm-type').value;
  /* Semua field tersedia untuk semua selector */
  const opts=allFieldsOpts(layer);
  document.getElementById('vm-val').innerHTML=opts;
  document.getElementById('vm-time').innerHTML=opts;
  document.getElementById('vm-from').innerHTML=opts;
  document.getElementById('vm-to').innerHTML=opts;
  document.getElementById('vm-val-grp').style.display=  ['heatmap','proportional','choropleth','hexbin','dotdensity','cartogram'].includes(type)?'flex':'none';
  document.getElementById('vm-time-grp').style.display= type==='timeseries'?'flex':'none';
  document.getElementById('vm-time-ctrl').style.display=type==='timeseries'?'block':'none';
  document.getElementById('vm-from-grp').style.display= type==='flow'?'flex':'none';
  document.getElementById('vm-to-grp').style.display=   type==='flow'?'flex':'none';
  document.getElementById('vm-pal-grp').style.display=  ['heatmap','proportional','choropleth','hexbin','dotdensity','cartogram','flow'].includes(type)?'flex':'none';
  document.getElementById('vm-res-grp').style.display=  type==='hexbin'?'flex':'none';
}

function renderVisualMap(){
  ensureVmap();if(vmLayer){vmap.removeLayer(vmLayer);vmLayer=null;}
  vmTimeLayers={};vmTimesteps=[];document.getElementById('vm-time-ctrl').style.display='none';
  const id=document.getElementById('vm-lyr').value;const layer=LAYERS.find(l=>l.id===id);if(!layer)return;
  const type=document.getElementById('vm-type').value;const valF=document.getElementById('vm-val').value;
  const pal=PALETTES[document.getElementById('vm-pal').value]||PALETTES.Blues;
  const features=getFilteredFeatures(layer);
  if(type==='heatmap')buildHeatmap(features,valF);
  else if(type==='cluster')buildCluster(features,layer);
  else if(type==='proportional')buildProportional(features,valF,pal);
  else if(type==='choropleth')buildChoropleth(features,valF,pal,layer);
  else if(type==='hexbin')buildHexbin(features,valF,pal);
  else if(type==='dotdensity')buildDotDensity(features,valF,pal);
  else if(type==='cartogram')buildCartogram(features,valF,pal);
  else if(type==='timeseries')buildTimeSeries(features,layer);
  else if(type==='flow')buildFlow(features,valF,pal);
}

function buildHeatmap(features,valF){
  const pts=[];features.forEach(f=>{if(!f.geometry)return;try{const c=L.geoJSON(f).getBounds().getCenter();const v=parseFloat(f.properties?.[valF])||1;pts.push([c.lat,c.lng,Math.max(0.1,v)])}catch(e){}});
  vmLayer=L.heatLayer(pts,{radius:25,blur:20,maxZoom:18}).addTo(vmap);
}

function buildCluster(features,layer){
  const s=layer.style;vmLayer=L.markerClusterGroup();
  features.forEach(f=>{if(!f.geometry)return;try{const c=L.geoJSON(f).getBounds().getCenter();const pf=layer.popup_fields||[];const props=f.properties||{};const rows=pf.map(p=>{const v=props[p.name];return v!=null?`<div class="pr"><span class="pk">${p.alias}</span><span class="pv">${v}</span></div>`:'';}).filter(Boolean).join('');const m=L.circleMarker(c,{radius:s.point_radius||6,fillColor:s.fill_color,color:s.stroke_color,weight:1,fillOpacity:.85});m.bindPopup(`<div class="ph">📍 ${layer.name}</div>${rows||'—'}`);vmLayer.addLayer(m);}catch(e){}});
  vmap.addLayer(vmLayer);
}

function buildProportional(features,valF,pal){
  const nums=getNumVals(features,valF);if(!nums.length)return;const mn=Math.min(...nums),mx=Math.max(...nums);const layers=[];
  features.forEach(f=>{if(!f.geometry)return;const v=parseFloat(f.properties?.[valF]);if(isNaN(v))return;try{const c=L.geoJSON(f).getBounds().getCenter();const r=Math.max(4,((v-mn)/(mx-mn||1))*30+4);const m=L.circleMarker(c,{radius:r,fillColor:colorScale(v,mn,mx,pal),color:'#fff',weight:1,fillOpacity:.8});m.bindPopup(`<div class="ph">${v}</div>`);layers.push(m);}catch(e){}});
  vmLayer=L.layerGroup(layers).addTo(vmap);
}

function buildChoropleth(features,valF,pal,layer){
  const nums=getNumVals(features,valF);if(!nums.length)return;const mn=Math.min(...nums),mx=Math.max(...nums);
  vmLayer=L.geoJSON({type:'FeatureCollection',features},{style:f=>{const v=parseFloat(f.properties?.[valF]);return {fillColor:isNaN(v)?'#64748b':colorScale(v,mn,mx,pal),color:'#fff',weight:1,fillOpacity:.8};},onEachFeature:(f,lyr)=>lyr.bindPopup(`<div class="ph">${f.properties?.[valF]??'—'}</div>`)}).addTo(vmap);
}

function buildHexbin(features,valF,pal){
  const res=parseFloat(document.getElementById('vm-res').value)||1;const grid={};
  features.forEach(f=>{if(!f.geometry)return;try{const c=L.geoJSON(f).getBounds().getCenter();const row=Math.floor(c.lat/res),col=Math.floor(c.lng/res);const key=`${row}_${col}`;const v=parseFloat(f.properties?.[valF])||0;if(!grid[key])grid[key]={row,col,vals:[]};grid[key].vals.push(v);}catch(e){}});
  const totals=Object.values(grid).map(g=>g.vals.reduce((a,b)=>a+b,0));const mn=Math.min(...totals),mx=Math.max(...totals);const layers=[];
  Object.values(grid).forEach(g=>{const tot=g.vals.reduce((a,b)=>a+b,0);const col=colorScale(tot,mn,mx,pal);const sw=L.latLng(g.row*res,g.col*res),ne=L.latLng((g.row+1)*res,(g.col+1)*res);const rect=L.rectangle([sw,ne],{fillColor:col,color:'#fff',weight:1,fillOpacity:.75});rect.bindPopup(`<div class="ph">Σ ${tot.toFixed(2)} (${g.vals.length})</div>`);layers.push(rect);});
  vmLayer=L.layerGroup(layers).addTo(vmap);
}

function buildDotDensity(features,valF,pal){
  const nums=getNumVals(features,valF);const mx=nums.length?Math.max(...nums):1;const layers=[];
  features.forEach(f=>{if(!f.geometry)return;const v=Math.max(1,Math.round((parseFloat(f.properties?.[valF])||1)/mx*20));try{const bounds=L.geoJSON(f).getBounds();const sw=bounds.getSouthWest(),ne=bounds.getNorthEast();const col=colorScale(parseFloat(f.properties?.[valF])||0,0,mx,pal);for(let i=0;i<v;i++){const lat=sw.lat+Math.random()*(ne.lat-sw.lat),lng=sw.lng+Math.random()*(ne.lng-sw.lng);layers.push(L.circleMarker([lat,lng],{radius:2,fillColor:col,color:col,weight:0,fillOpacity:.7}));}}catch(e){}});
  vmLayer=L.layerGroup(layers).addTo(vmap);
}

function buildCartogram(features,valF,pal){
  const nums=getNumVals(features,valF);if(!nums.length)return;const mn=Math.min(...nums),mx=Math.max(...nums);const layers=[];
  features.forEach(f=>{if(!f.geometry)return;const v=parseFloat(f.properties?.[valF]);if(isNaN(v))return;try{const c=L.geoJSON(f).getBounds().getCenter();const r=Math.max(6,((v-mn)/(mx-mn||1))*40+6);const m=L.circleMarker(c,{radius:r,fillColor:colorScale(v,mn,mx,pal),color:'#fff',weight:1,fillOpacity:.75});m.bindPopup(`<div class="ph">${f.properties?.name||f.properties?.nama||'—'}: ${v}</div>`);layers.push(m);}catch(e){}});
  vmLayer=L.layerGroup(layers).addTo(vmap);
}

function buildTimeSeries(features,layer){
  const timeF=document.getElementById('vm-time').value;const s=layer.style;const byTime={};
  features.forEach(f=>{const t=String(f.properties?.[timeF]??'N/A');if(!byTime[t])byTime[t]=[];byTime[t].push(f);});
  vmTimesteps=Object.keys(byTime).sort();if(!vmTimesteps.length)return;
  vmTimesteps.forEach(t=>{vmTimeLayers[t]=L.geoJSON({type:'FeatureCollection',features:byTime[t]},{pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:6,fillColor:s.fill_color,color:'#fff',weight:1,fillOpacity:.85}),style:()=>{return {fillColor:s.fill_color,color:'#fff',weight:1,fillOpacity:.75};}});});
  const slider=document.getElementById('vm-slider');slider.min=0;slider.max=vmTimesteps.length-1;slider.value=0;
  document.getElementById('vm-time-ctrl').style.display='block';onVmSlider(0);
}

function onVmSlider(idx){
  if(!vmTimesteps.length)return;const t=vmTimesteps[parseInt(idx)];document.getElementById('vm-time-lbl').textContent=t;
  Object.values(vmTimeLayers).forEach(lf=>{if(vmap.hasLayer(lf))vmap.removeLayer(lf);});
  if(vmTimeLayers[t])vmTimeLayers[t].addTo(vmap);vmLayer=vmTimeLayers[t];
}

function buildFlow(features,valF,pal){
  const nums=getNumVals(features,valF);const mx=nums.length?Math.max(...nums):1;const pts=[];
  features.forEach(f=>{if(!f.geometry)return;try{const c=L.geoJSON(f).getBounds().getCenter();pts.push({c,v:parseFloat(f.properties?.[valF])||1})}catch(e){}});
  const layers=[];
  for(let i=0;i<pts.length-1;i++){
    const w=Math.max(1,(pts[i].v/mx)*6);const col=colorScale(pts[i].v,0,mx,pal);
    const line=L.polyline([pts[i].c,pts[i+1].c],{color:col,weight:w,opacity:.7});line.bindPopup(`<div class="ph">${numFmt(pts[i].v)}</div>`);layers.push(line);
    const mlat=(pts[i].c.lat+pts[i+1].c.lat)/2,mlng=(pts[i].c.lng+pts[i+1].c.lng)/2;
    layers.push(L.circleMarker([mlat,mlng],{radius:3,fillColor:col,color:col,weight:0,fillOpacity:.9}));
  }
  vmLayer=L.layerGroup(layers).addTo(vmap);
}

function _buildVmExportOverlay(){
  const ovItems=document.getElementById('vm-ov-items');
  if(!ovItems||!vmLayer)return;
  ovItems.innerHTML='';
  const id=document.getElementById('vm-lyr').value;
  const layer=LAYERS.find(l=>l.id===id);if(!layer)return;
  const type=document.getElementById('vm-type').value;
  const valF=document.getElementById('vm-val')?.value;
  const palName=document.getElementById('vm-pal')?.value||'Blues';
  const pal=PALETTES[palName]||PALETTES.Blues;
  const features=getFilteredFeatures(layer);

  function addScaleRows(vals){
    if(!vals||!vals.length)return;
    const mn=Math.min(...vals),mx=Math.max(...vals),md=(mn+mx)/2;
    [[mn,'min'],[md,'mid'],[mx,'max']].forEach(([v,lbl])=>{
      const col=colorScale(Number(v),mn,mx,pal);
      const row=document.createElement('div');row.className='ov-item';
      row.innerHTML=`<div class="ov-swatch" style="background:${col}"></div><span>${Number(v).toFixed(1)} (${lbl})</span>`;
      ovItems.appendChild(row);
    });
  }

  function hexbinTotals(feats,field){
    const res=parseFloat(document.getElementById('vm-res')?.value)||1;
    const grid={};
    feats.forEach(f=>{
      if(!f.geometry)return;
      try{
        const c=L.geoJSON(f).getBounds().getCenter();
        const row=Math.floor(c.lat/res),col=Math.floor(c.lng/res),key=`${row}_${col}`;
        const v=parseFloat(f.properties?.[field]);
        if(isNaN(v))return;
        if(!grid[key])grid[key]=0;
        grid[key]+=v;
      }catch(e){}
    });
    return Object.values(grid);
  }

  if(type==='heatmap'){
    [['#1d4ed8','rendah'],['#1df909','sedang'],['#f54b02','tinggi']].forEach(([col,lbl])=>{
      const row=document.createElement('div');row.className='ov-item';
      row.innerHTML=`<div class="ov-swatch" style="background:${col}"></div><span>${lbl}</span>`;
      ovItems.appendChild(row);
    });
  }else if(type==='cluster'){
    const row=document.createElement('div');row.className='ov-item';
    row.innerHTML=`<div class="ov-swatch" style="background:${layer.style.fill_color||'#a855f7'}"></div><span>${features.length} titik</span>`;
    ovItems.appendChild(row);
    const row2=document.createElement('div');row2.className='ov-item';
    row2.innerHTML='<span>Cluster otomatis berdasarkan zoom</span>';
    ovItems.appendChild(row2);
  }else if(['proportional','cartogram','dotdensity','flow'].includes(type)&&valF){
    addScaleRows(getNumVals(features,valF));
  }else if(['choropleth','hexbin'].includes(type)&&valF){
    const nums=type==='hexbin'?hexbinTotals(features,valF):getNumVals(features,valF);
    if(nums.length){
      const mn=Math.min(...nums),mx=Math.max(...nums),den=Math.max(1,pal.length-1);
      pal.forEach((col,i)=>{
        const v=mn+(mx-mn)*i/den;
        const row=document.createElement('div');row.className='ov-item';
        row.innerHTML=`<div class="ov-swatch" style="background:${col}"></div><span>${v.toFixed(1)}</span>`;
        ovItems.appendChild(row);
      });
    }
  }else if(type==='timeseries'){
    const idx=parseInt(document.getElementById('vm-slider')?.value||'0');
    const curLabel=vmTimesteps[idx]??'N/A';
    const timeF=document.getElementById('vm-time')?.value;
    const activeCount=features.filter(f=>String(f.properties?.[timeF]??'N/A')===curLabel).length;
    const row=document.createElement('div');row.className='ov-item';
    row.innerHTML=`<span>${curLabel} · ${activeCount} fitur</span>`;
    ovItems.appendChild(row);
  }
  const scaleLine=document.querySelector('#vmap .leaflet-control-scale-line');
  const scaleEl=document.getElementById('vm-export-scale');
  if(scaleLine&&scaleEl)scaleEl.textContent=scaleLine.textContent;
}

function dlVmPng() {
  if (!vmap) return;
  _buildVmExportOverlay();

  const vmEl = document.getElementById('vmap');
  const ov   = document.getElementById('vm-export-overlay');
  const sc   = document.getElementById('vm-export-scale');

  if (ov) ov.style.display = 'block';
  if (sc) sc.style.display = 'block';

  _renderMapToCanvas(vmEl, vmap, 'vm', (out, ctx, W, H) => {
    _drawLegendOnCanvas(ctx, ov, sc, vmEl, W, H);
    if (ov) ov.style.display = 'none';
    if (sc) sc.style.display = 'none';

    const a = document.createElement('a');
    a.download = 'spada-visualmap.png';
    a.href = out.toDataURL('image/png');
    a.click();
  });
}

/* ── Render cluster map ke canvas dengan membaca visual DOM Leaflet ── */
function _renderClusterFromDom(ctx, leafletVmap, clusterGroup, mapRect) {
  const container = leafletVmap.getContainer();

  // Render cluster icons (lingkaran besar dengan angka)
  const clusterEls = container.querySelectorAll('.marker-cluster');
  clusterEls.forEach(el => {
    const r = el.getBoundingClientRect();
    const cx = r.left - mapRect.left + r.width / 2;
    const cy = r.top  - mapRect.top  + r.height / 2;
    const radius = r.width / 2;

    let bgColor = '#51ac5e';
    const innerDiv = el.querySelector('div');
    if (innerDiv) {
      const bg = innerDiv.style.background || innerDiv.style.backgroundColor;
      if (bg) bgColor = bg;
      else {
        const computed = window.getComputedStyle(innerDiv);
        if (computed.background) bgColor = computed.backgroundColor || bgColor;
      }
    }

    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.65, 0, Math.PI * 2);
    ctx.fill();

    const span = el.querySelector('span');
    if (span) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(10, radius * 0.8)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(span.textContent, cx, cy);
    }
    ctx.restore();
  });

  // Render marker individual yang tidak ter-cluster
  const markerEls = container.querySelectorAll('.leaflet-marker-icon:not(.marker-cluster)');
  markerEls.forEach(el => {
    const r = el.getBoundingClientRect();
    const cx = r.left - mapRect.left + r.width / 2;
    const cy = r.top  - mapRect.top  + r.height / 2;

    const svg = el.querySelector('svg circle, circle');
    let fillColor = '#6366f1';
    if (svg) fillColor = svg.getAttribute('fill') || fillColor;

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  });

  // Fallback: render circleMarker individual jika tidak ada cluster DOM
  if (!clusterEls.length) {
    clusterGroup.getLayers && clusterGroup.getLayers().forEach(layer => {
      if (!(layer instanceof L.CircleMarker)) return;
      const ll = layer.getLatLng();
      const pt = leafletVmap.latLngToContainerPoint(ll);
      const opt = layer.options || {};
      ctx.save();
      ctx.globalAlpha = opt.fillOpacity ?? 0.85;
      ctx.fillStyle = opt.fillColor || '#6366f1';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, opt.radius || 6, 0, Math.PI * 2);
      ctx.fill();
      if (opt.weight > 0) {
        ctx.strokeStyle = opt.color || '#ffffff';
        ctx.lineWidth = opt.weight || 1;
        ctx.stroke();
      }
      ctx.restore();
    });
  }
}

/* ==================== RENDER VM LAYER KE CANVAS ==================== */
function renderVmLayerToCanvas(ctx, leafletVmap, vmLayer) {
  if (!vmLayer || !leafletVmap) return;
  const mapRect = leafletVmap.getContainer().getBoundingClientRect();

  // Helper: cek apakah objek adalah LatLng
  function isLatLng(v){
    return v && typeof v.lat === 'number' && typeof v.lng === 'number';
  }

  // Helper: gambar segmen polyline secara rekursif (handle nested array)
  function drawLineSegments(latlngs){
    if(!Array.isArray(latlngs)||!latlngs.length)return;
    if(isLatLng(latlngs[0])){
      latlngs.forEach((ll,i)=>{
        const p=leafletVmap.latLngToContainerPoint(ll);
        if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
      });
      return;
    }
    latlngs.forEach(seg=>drawLineSegments(seg));
  }

  // Helper: gambar ring polygon secara rekursif (handle nested array)
  function drawPolygonRings(latlngs){
    if(!Array.isArray(latlngs)||!latlngs.length)return;
    if(isLatLng(latlngs[0])){
      const projected=latlngs.map(ll=>leafletVmap.latLngToContainerPoint(ll));
      if(projected.length<3)return;
      ctx.moveTo(projected[0].x,projected[0].y);
      for(let i=1;i<projected.length;i++)ctx.lineTo(projected[i].x,projected[i].y);
      ctx.closePath();
      return;
    }
    latlngs.forEach(r=>drawPolygonRings(r));
  }

  // 1. Heatmap — baca dari canvas internal leaflet.heat
  //    Deteksi robust: instanceof L.HeatLayer ATAU ada _canvas (vm_codex fix)
  if ((L.HeatLayer && vmLayer instanceof L.HeatLayer) || vmLayer._canvas) {
    const heatCanvas = vmLayer._canvas;
    if (heatCanvas) {
      const r = heatCanvas.getBoundingClientRect();
      try {
        ctx.drawImage(heatCanvas, r.left - mapRect.left, r.top - mapRect.top, r.width, r.height);
      } catch(e) {}
    }
    return;
  }

  // 2. Cluster — render visual cluster dari DOM (vm_claude fix)
  if (vmLayer instanceof L.MarkerClusterGroup || (vmLayer._featureGroup !== undefined)) {
    _renderClusterFromDom(ctx, leafletVmap, vmLayer, mapRect);
    return;
  }

  // 3. Ambil semua layers (handle GeoJSON, LayerGroup)
  let layers = [];
  if (vmLayer.getLayers) {
    layers = vmLayer.getLayers();
  } else {
    layers = [vmLayer];
  }

  layers.forEach(layer => {
    const opt = layer.options || {};

    // === CIRCLE MARKER (Proportional, Cartogram, Dot Density) ===
    if (layer instanceof L.CircleMarker) {
      const ll = layer.getLatLng();
      const pt = leafletVmap.latLngToContainerPoint(ll);
      ctx.save();
      ctx.globalAlpha = opt.fillOpacity ?? 0.85;
      ctx.fillStyle = opt.fillColor || '#f59e0b';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, opt.radius || 8, 0, Math.PI * 2);
      ctx.fill();
      if (opt.weight > 0) {
        ctx.strokeStyle = opt.color || '#ffffff';
        ctx.lineWidth = opt.weight;
        ctx.stroke();
      }
      ctx.restore();
    }

    // === RECTANGLE (Hexbin) ===
    else if (layer instanceof L.Rectangle) {
      const bounds = layer.getBounds();
      const sw = leafletVmap.latLngToContainerPoint(bounds.getSouthWest());
      const ne = leafletVmap.latLngToContainerPoint(bounds.getNorthEast());
      const x = Math.min(sw.x, ne.x), y = Math.min(sw.y, ne.y);
      const w = Math.abs(ne.x - sw.x), h = Math.abs(ne.y - sw.y);
      ctx.save();
      ctx.globalAlpha = opt.fillOpacity ?? 0.75;
      ctx.fillStyle = opt.fillColor || '#3b82f6';
      ctx.fillRect(x, y, w, h);
      if (opt.weight > 0) {
        ctx.strokeStyle = opt.color || '#fff';
        ctx.lineWidth = opt.weight;
        ctx.strokeRect(x, y, w, h);
      }
      ctx.restore();
    }

    // === POLYLINE (Flow) ===
    else if (layer instanceof L.Polyline) {
      const latlngs = layer.getLatLngs();
      ctx.save();
      ctx.strokeStyle = opt.color || '#ef4444';
      ctx.lineWidth = opt.weight || 5;
      ctx.globalAlpha = opt.opacity ?? 0.75;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      drawLineSegments(latlngs);
      ctx.stroke();
      ctx.restore();
    }

    // === POLYGON (Choropleth & Timeseries) ===
    else if (layer instanceof L.Polygon) {
      ctx.save();
      ctx.globalAlpha = opt.fillOpacity ?? 0.75;
      ctx.fillStyle = opt.fillColor || '#3b82f6';
      ctx.strokeStyle = opt.color || '#ffffff';
      ctx.lineWidth = opt.weight || 1.5;
      ctx.beginPath();
      drawPolygonRings(layer.getLatLngs());
      ctx.fill('evenodd');
      ctx.stroke();
      ctx.restore();
    }
  });
}
