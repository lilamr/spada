/* ════════════════════════════════════════════════════════
   SpaDa — ATRIBUT
   ════════════════════════════════════════════════════════ */

function initAttr(){
  const sel=document.getElementById('attr-lyr');
  LAYERS.forEach(l=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.name;sel.appendChild(o);});
  if(LAYERS.length){sel.value=LAYERS[0].id;loadTable();}
}

function loadTable(){
  const id=document.getElementById('attr-lyr').value;
  const layer=LAYERS.find(l=>l.id===id);if(!layer)return;
  attrLyrId=id;const tf=layer.table_fields;
  attrAll=layer.geojson.features.map(f=>{const row={};tf.forEach(t=>{row[t.name]=f.properties?f.properties[t.name]:null;});return row;});
  attrFiltered=[...attrAll];activeFilter={col:null,op:null,val:null};
  document.getElementById('filter-col').innerHTML=tf.map(t=>`<option value="${t.name}">${t.alias}</option>`).join('');
  document.getElementById('filter-val').value='';
  document.getElementById('sb-filter').textContent='';
  resetMapOpacity(layer);renderTable(layer);
}

function matchVal(rv,op,vs){
  const rs=String(rv??'').toLowerCase(),rn=parseFloat(rv),vn=parseFloat(vs);
  if(op==='contains')return rs.includes(vs.toLowerCase());
  if(op==='eq')return rs===vs.toLowerCase();if(op==='neq')return rs!==vs.toLowerCase();
  if(op==='gt')return !isNaN(rn)&&!isNaN(vn)&&rn>vn;if(op==='lt')return !isNaN(rn)&&!isNaN(vn)&&rn<vn;
  if(op==='gte')return !isNaN(rn)&&!isNaN(vn)&&rn>=vn;if(op==='lte')return !isNaN(rn)&&!isNaN(vn)&&rn<=vn;
  if(op==='startswith')return rs.startsWith(vs.toLowerCase());if(op==='endswith')return rs.endsWith(vs.toLowerCase());
  if(op==='empty')return rv===null||rv===undefined||rv==='';if(op==='notempty')return rv!==null&&rv!==undefined&&rv!=='';
  return true;
}

function applyFilter(){
  const id=document.getElementById('attr-lyr').value;
  const col=document.getElementById('filter-col').value;
  const op=document.getElementById('filter-op').value;
  const val=document.getElementById('filter-val').value.trim();
  const layer=LAYERS.find(l=>l.id===id);if(!layer)return;
  activeFilter={col,op,val};
  attrFiltered=attrAll.filter(r=>matchVal(r[col],op,val));
  applyMapOpacity(layer,col,op,val);
  const opLbl=document.getElementById('filter-op').selectedOptions[0].text;
  const colLbl=document.getElementById('filter-col').selectedOptions[0].text;
  document.getElementById('sb-filter').textContent=`Filter: "${colLbl}" ${opLbl} "${val}" — ${attrFiltered.length.toLocaleString()} baris`;
  renderTable(layer);
}

function resetFilter(){
  const id=document.getElementById('attr-lyr').value;const layer=LAYERS.find(l=>l.id===id);if(!layer)return;
  activeFilter={col:null,op:null,val:null};attrFiltered=[...attrAll];
  document.getElementById('filter-val').value='';
  document.getElementById('sb-filter').textContent='';
  resetMapOpacity(layer);renderTable(layer);
}

function applyMapOpacity(layer,col,op,val){
  const lf=lfLayers[layer.id];if(!lf)return;
  lf.eachLayer(sub=>{
    const props=sub.feature?sub.feature.properties:{};const ok=!col||matchVal(props[col],op,val);
    try{if(sub.setStyle)sub.setStyle({opacity:ok?1:.07,fillOpacity:ok?layer.style.opacity:.05});}catch(e){}
  });
}

function resetMapOpacity(layer){
  const lf=lfLayers[layer.id];if(!lf)return;
  lf.eachLayer(sub=>{try{if(sub.setStyle)sub.setStyle({opacity:1,fillOpacity:layer.style.opacity});}catch(e){}});
}

function syncMapFilter(){
  if(!attrLyrId||!activeFilter.col)return;
  const layer=LAYERS.find(l=>l.id===attrLyrId);if(!layer)return;
  const {col,op,val}=activeFilter;
  const matched=layer.geojson.features.filter(f=>matchVal(f.properties?.[col],op,val));
  if(!matched.length)return;
  try{const gl=L.geoJSON({type:'FeatureCollection',features:matched});map.fitBounds(gl.getBounds().pad(.1));if(curTab!=='map')switchTab('map');}catch(e){}
}

function renderTable(layer){
  const tf=layer.table_fields;
  document.getElementById('at-head').innerHTML='<tr>'+tf.map(t=>`<th onclick="sortTable('${t.name}','${layer.id}')">
    ${t.alias}<span style="margin-left:2px;color:var(--tx3)">${sortCol===t.name?(sortAsc?'↑':'↓'):''}</span></th>`).join('')+'</tr>';
  document.getElementById('at-body').innerHTML=attrFiltered.map((row,i)=>`<tr data-idx="${i}" onclick="selectRow(this,${i},'${layer.id}')">
    `+tf.map(t=>`<td title="${row[t.name]??''}">${row[t.name]!==null&&row[t.name]!==undefined?row[t.name]:''}</td>`).join('')+'</tr>').join('');
  document.getElementById('attr-cnt').textContent=`${attrFiltered.length.toLocaleString()} / ${attrAll.length.toLocaleString()}`;
}

function sortTable(field,lyrId){
  if(sortCol===field)sortAsc=!sortAsc;else{sortCol=field;sortAsc=true;}
  attrFiltered.sort((a,b)=>{const va=a[field],vb=b[field];if(va==null)return 1;if(vb==null)return -1;const na=Number(va),nb=Number(vb);if(!isNaN(na)&&!isNaN(nb))return sortAsc?na-nb:nb-na;return sortAsc?String(va).localeCompare(String(vb)):String(vb).localeCompare(String(va));});
  const layer=LAYERS.find(l=>l.id===lyrId);if(layer)renderTable(layer);
}

function selectRow(row,idx,lyrId){
  document.querySelectorAll('#at-body tr').forEach(r=>r.classList.remove('hi'));row.classList.add('hi');
  const data=attrFiltered[idx];const layer=LAYERS.find(l=>l.id===lyrId);if(!layer)return;
  const f=layer.geojson.features.find(f=>{if(!f.properties)return false;return Object.keys(data).slice(0,3).every(k=>String(f.properties[k])===String(data[k]));}); 
  if(f){const gl=L.geoJSON(f);map.fitBounds(gl.getBounds().pad(.5));if(curTab!=='map')switchTab('map');showPopup(f,gl.getBounds().getCenter(),layer);}
}

function syncRow(feature,layer){
  const sel=document.getElementById('attr-lyr');sel.value=layer.id;loadTable();const props=feature.properties;
  setTimeout(()=>{
    document.querySelectorAll('#at-body tr').forEach(row=>{
      const idx=parseInt(row.dataset.idx);if(isNaN(idx))return;const rd=attrFiltered[idx];if(!rd)return;
      if(Object.keys(props).slice(0,3).every(k=>String(rd[k])===String(props[k]))){
        document.querySelectorAll('#at-body tr').forEach(r=>r.classList.remove('hi'));
        row.classList.add('hi');row.scrollIntoView({behavior:'smooth',block:'center'});
      }
    });
  },300);
}

function dlAttrCsv(){
  const id=document.getElementById('attr-lyr').value;const layer=LAYERS.find(l=>l.id===id);if(!layer||!attrFiltered.length)return;
  const tf=layer.table_fields;const header=tf.map(t=>csvEsc(t.alias)).join(',');
  const rows=attrFiltered.map(row=>tf.map(t=>csvEsc(row[t.name]??'')).join(','));
  dlText([header,...rows].join('\\n'),'spada-atribut.csv','text/csv');
}
