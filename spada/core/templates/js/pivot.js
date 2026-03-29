/* ════════════════════════════════════════════════════════
   SpaDa — PIVOT
   ════════════════════════════════════════════════════════ */

function initPivot(){
  const sel=document.getElementById('pv-lyr');
  LAYERS.forEach(l=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.name;sel.appendChild(o);});
  if(LAYERS.length)updatePivotFields();
}

function updatePivotFields(){
  const id=document.getElementById('pv-lyr').value;const layer=LAYERS.find(l=>l.id===id);if(!layer)return;
  /* Semua field bisa jadi baris/kolom/nilai — tidak dibatasi tipe */
  const opts=allFieldsOpts(layer);
  document.getElementById('pv-row').innerHTML=opts;
  document.getElementById('pv-col').innerHTML='<option value="">(Tidak ada)</option>'+opts;
  document.getElementById('pv-val').innerHTML=opts;
  if(layer.all_fields.length>1)document.getElementById('pv-val').selectedIndex=1;
}

function sortPivot(col){
  if(pvSortCol===col)pvSortAsc=!pvSortAsc;else{pvSortCol=col;pvSortAsc=true;}
  /* Sort pvRowKeys berdasarkan nilai di kolom yang diklik */
  pvRowKeys.sort((a,b)=>{
    let va,vb;
    if(col==='__row__'){va=a;vb=b;}
    else if(col==='__total__'){va=pvData[a]?Object.values(pvData[a]).filter(v=>v!==null).reduce((s,v)=>s+v,0):null;vb=pvData[b]?Object.values(pvData[b]).filter(v=>v!==null).reduce((s,v)=>s+v,0):null;}
    else{va=pvData[a]?.[col]??null;vb=pvData[b]?.[col]??null;}
    if(va===null&&vb===null)return 0;if(va===null)return 1;if(vb===null)return-1;
    if(typeof va==='number'&&typeof vb==='number')return pvSortAsc?va-vb:vb-va;
    return pvSortAsc?String(va).localeCompare(String(vb)):String(vb).localeCompare(String(va));
  });
  _renderPivotBody();
}

function _renderPivotHeader(){
  if(!pvData)return;
  const noCol=pvColKeys.length===1&&pvColKeys[0]==='Nilai';
  const sortInd=c=>pvSortCol===c?(pvSortAsc?'↑':'↓'):'';
  const thStyle='cursor:pointer;user-select:none;';
  document.getElementById('pt-head').innerHTML=noCol?
    `<tr><th style="${thStyle}" onclick="sortPivot('__row__')">${pvFields.rowAlias} ${sortInd('__row__')}</th><th class="rh" style="${thStyle}" onclick="sortPivot('Nilai')">${pvFields.valAlias} (${pvFields.agg}) ${sortInd('Nilai')}</th><th class="rh" style="${thStyle};color:var(--ac2)" onclick="sortPivot('__total__')">Total ${sortInd('__total__')}</th></tr>`:
    `<tr><th style="${thStyle}" onclick="sortPivot('__row__')">${pvFields.rowAlias} ${sortInd('__row__')}</th>`+pvColKeys.map(ck=>`<th class="rh" style="${thStyle}" onclick="sortPivot('${ck}')">${ck} ${sortInd(ck)}</th>`).join('')+`<th class="rh" style="${thStyle};color:var(--ac2)" onclick="sortPivot('__total__')">Total ${sortInd('__total__')}</th></tr>`;
}

function _renderPivotBody(){
  if(!pvData)return;
  _renderPivotHeader();
  const hm=document.getElementById('pv-hm').value;
  let allVals=pvRowKeys.flatMap(rk=>pvColKeys.map(ck=>pvData[rk][ck])).filter(v=>v!==null);
  const rowTotals={};
  pvRowKeys.forEach(rk=>{const arr=pvColKeys.map(ck=>pvData[rk][ck]).filter(v=>v!==null);rowTotals[rk]=aggVals(arr,pvFields.agg==='count'?'sum':pvFields.agg);});
  const colTotals={};
  pvColKeys.forEach(ck=>{const arr=pvRowKeys.map(rk=>pvData[rk][ck]).filter(v=>v!==null);colTotals[ck]=aggVals(arr,pvFields.agg==='count'?'sum':pvFields.agg);});
  let bodyHtml='';
  pvRowKeys.forEach(rk=>{
    const rowArr=pvColKeys.map(ck=>pvData[rk][ck]).filter(v=>v!==null);
    const rowMn=rowArr.length?Math.min(...rowArr):0,rowMx=rowArr.length?Math.max(...rowArr):0;
    bodyHtml+=`<tr><td class="cl">${rk}</td>`;
    pvColKeys.forEach(ck=>{const v=pvData[rk][ck];let bg='';if(hm==='row')bg=hmColor(v,rowMn,rowMx);else if(hm==='all')bg=hmColor(v,Math.min(...allVals),Math.max(...allVals));bodyHtml+=`<td class="vc"${bg?` style="background:${bg}"`:''}>${numFmt(v)}</td>`;});
    bodyHtml+=`<td class="rc">${numFmt(rowTotals[rk])}</td></tr>`;
  });
  bodyHtml+='<tr style="border-top:1px solid var(--bd)"><td class="cl" style="color:var(--ac2)">Total</td>'+pvColKeys.map(ck=>`<td class="rc">${numFmt(colTotals[ck])}</td>`).join('')+`<td class="rc">${numFmt(aggVals(Object.values(rowTotals).filter(v=>v!==null),pvFields.agg==='count'?'sum':pvFields.agg))}</td></tr>`;
  document.getElementById('pt-body').innerHTML=bodyHtml;
}

function renderPivot(){
  const id=document.getElementById('pv-lyr').value;const layer=LAYERS.find(l=>l.id===id);if(!layer)return;
  const rowF=document.getElementById('pv-row').value;const colF=document.getElementById('pv-col').value;
  const valF=document.getElementById('pv-val').value;const agg=document.getElementById('pv-agg').value;
  const noCol=!colF;
  const rowAlias=fieldAlias(layer,rowF);const valAlias=fieldAlias(layer,valF);
  const rows=layer.geojson.features.map(f=>f.properties||{});
  pvRowKeys=[...new Set(rows.map(r=>String(r[rowF]??'N/A')))].sort();
  pvColKeys=noCol?['Nilai']:[...new Set(rows.map(r=>String(r[colF]??'N/A')))].sort();
  pvFields={row:rowF,col:noCol?null:colF,val:valF,agg,rowAlias,valAlias};
  pvSortCol=null;pvSortAsc=true;
  const grid={};
  pvRowKeys.forEach(rk=>{grid[rk]={};pvColKeys.forEach(ck=>{grid[rk][ck]=[];});});
  rows.forEach(r=>{const rk=String(r[rowF]??'N/A');const ck=noCol?'Nilai':String(r[colF]??'N/A');if(grid[rk]&&grid[rk][ck]!==undefined)grid[rk][ck].push(r[valF]);});
  pvData={};
  pvRowKeys.forEach(rk=>{pvData[rk]={};pvColKeys.forEach(ck=>{pvData[rk][ck]=aggVals(grid[rk][ck],agg);});});
  _renderPivotBody();
}

function dlPivotCsv(){
  if(!pvData||!pvRowKeys.length)return;
  const noCol=pvColKeys.length===1&&pvColKeys[0]==='Nilai';
  const header=noCol?[pvFields.rowAlias,pvFields.valAlias,'Total']:[pvFields.rowAlias,...pvColKeys,'Total'];
  const csvRows=[header.map(csvEsc).join(',')];
  pvRowKeys.forEach(rk=>{
    const row=[rk,...pvColKeys.map(ck=>pvData[rk]?.[ck]??'')];
    const vals=pvColKeys.map(ck=>pvData[rk]?.[ck]).filter(v=>v!==null);
    const tot=aggVals(vals,pvFields.agg==='count'?'sum':pvFields.agg);
    csvRows.push([...row,tot??''].map(csvEsc).join(','));
  });
  dlText(csvRows.join('\\n'),'spada-pivot.csv','text/csv');
}
/* ── Chart ── */
