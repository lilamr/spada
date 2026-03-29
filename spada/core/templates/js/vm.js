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
  const features=layer.geojson.features;
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
  /* Tampilkan legenda berdasarkan tipe visual map dan layer yang aktif */
  const id=document.getElementById('vm-lyr').value;
  const layer=LAYERS.find(l=>l.id===id);if(!layer)return;
  const type=document.getElementById('vm-type').value;
  const valF=document.getElementById('vm-val')?.value;
  const palName=document.getElementById('vm-pal')?.value||'Blues';
  const pal=PALETTES[palName]||PALETTES.Blues;
  if(['heatmap','cluster'].includes(type)){
    const row=document.createElement('div');row.className='ov-item';
    row.innerHTML=`<span>${layer.name}</span>`;ovItems.appendChild(row);
  }else if(['proportional','cartogram','dotdensity'].includes(type)&&valF){
    const nums=getNumVals(layer.geojson.features,valF);
    if(nums.length){
      const mn=Math.min(...nums),mx=Math.max(...nums);
      [[mn,'min'],[((mn+mx)/2).toFixed(1),'mid'],[mx,'max']].forEach(([v,lbl])=>{
        const col=colorScale(Number(v),mn,mx,pal);
        const row=document.createElement('div');row.className='ov-item';
        row.innerHTML=`<div class="ov-swatch" style="background:${col}"></div><span>${v} (${lbl})</span>`;
        ovItems.appendChild(row);
      });
    }
  }else if(['choropleth','hexbin'].includes(type)&&valF){
    const nums=getNumVals(layer.geojson.features,valF);
    if(nums.length){
      const mn=Math.min(...nums),mx=Math.max(...nums);
      pal.forEach((col,i)=>{
        const v=mn+(mx-mn)*i/(pal.length-1||1);
        const row=document.createElement('div');row.className='ov-item';
        row.innerHTML=`<div class="ov-swatch" style="background:${col}"></div><span>${v.toFixed(1)}</span>`;
        ovItems.appendChild(row);
      });
    }
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
  /* Reuse _renderMapToCanvas dari map.js */
  _renderMapToCanvas(vmEl, (out, ctx, W, H) => {
    _drawLegendOnCanvas(ctx, ov, sc, vmEl, W, H);
    if (ov) ov.style.display = 'none';
    if (sc) sc.style.display = 'none';
    const a = document.createElement('a');
    a.download = 'spada-visualmap.png';
    a.href = out.toDataURL('image/png');
    a.click();
  });
}

window.addEventListener('DOMContentLoaded',init);
