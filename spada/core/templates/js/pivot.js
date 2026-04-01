/* ════════════════════════════════════════════════════════
   SpaDa — PIVOT (Versi A: Setiap field Baris = kolom terpisah)
   Mirip Excel / LibreOffice
   ════════════════════════════════════════════════════════ */

function initPivot(){
  const sel=document.getElementById('pv-lyr');
  LAYERS.forEach(l=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.name;sel.appendChild(o);});
  if(LAYERS.length)updatePivotFields();
}

function updatePivotFields(){
  const id=document.getElementById('pv-lyr').value;const layer=LAYERS.find(l=>l.id===id);if(!layer)return;
  const opts=allFieldsOpts(layer);

  // Baris (multi)
  const rowSel = document.getElementById('pv-row');
  rowSel.innerHTML = opts;
  rowSel.multiple = true;
  rowSel.size = 5;

  // Kolom (multi)
  const colSel = document.getElementById('pv-col');
  colSel.innerHTML = '<option value="">(Tidak ada kolom pivot)</option>'+opts;
  colSel.multiple = true;
  colSel.size = 5;

  // Nilai (single)
  const valSel = document.getElementById('pv-val');
  valSel.innerHTML = opts;
  valSel.multiple = false;
  const numFields = numericFields(layer);
  if(numFields.length) valSel.value = numFields[0].name;
}

function sortPivot(key){
  if(pvSortCol === key) {
    pvSortAsc = !pvSortAsc;
  } else {
    pvSortCol = key;
    pvSortAsc = true;
  }
  _renderPivotBody();
}

function _renderPivotHeader(){
  if(!pvRowRecords || !pvFields) return;

  const thStyle = 'cursor:pointer;user-select:none; padding:8px 6px;';
  let html = '<tr>';

  // Header untuk setiap field Baris (kolom terpisah)
  pvFields.row.forEach(f => {
    const alias = fieldAlias({all_fields: pvFields.allFields}, f);
    const sortKey = 'row_' + f;
    const sortIndicator = (pvSortCol === sortKey) ? (pvSortAsc ? ' ↑' : ' ↓') : '';
    html += `<th style="${thStyle}" onclick="sortPivot('${sortKey}')">${alias}${sortIndicator}</th>`;
  });

  // Header untuk kolom nilai
  pvColKeys.forEach(ck => {
    const sortIndicator = (pvSortCol === ck) ? (pvSortAsc ? ' ↑' : ' ↓') : '';
    html += `<th class="rh" style="${thStyle}" onclick="sortPivot('${ck}')">${ck}${sortIndicator}</th>`;
  });

  // Header Total
  const totalIndicator = (pvSortCol === '__total__') ? (pvSortAsc ? ' ↑' : ' ↓') : '';
  html += `<th class="rh" style="${thStyle};color:var(--ac2)" onclick="sortPivot('__total__')">Total${totalIndicator}</th>`;

  html += '</tr>';
  document.getElementById('pt-head').innerHTML = html;
}

function _renderPivotBody(){
  if(!pvRowRecords || !pvData) return;
  _renderPivotHeader();

  const hm = document.getElementById('pv-hm').value;
  let allVals = [];
  pvRowRecords.forEach(rec => {
    pvColKeys.forEach(ck => {
      const v = pvData[rec.__key]?.[ck];
      if(v !== null && v !== undefined) allVals.push(v);
    });
  });

  // === SORTING LOGIC ===
  if(pvSortCol){
    pvRowRecords.sort((a, b) => {
      let va, vb;

      if(pvSortCol.startsWith('row_')){
        const field = pvSortCol.replace('row_', '');
        va = a[field];
        vb = b[field];
      } 
      else if(pvSortCol === '__total__'){
        const totalA = pvColKeys.reduce((sum, ck) => sum + (pvData[a.__key]?.[ck] || 0), 0);
        const totalB = pvColKeys.reduce((sum, ck) => sum + (pvData[b.__key]?.[ck] || 0), 0);
        va = totalA;
        vb = totalB;
      } 
      else {
        // sorting berdasarkan kolom nilai
        va = pvData[a.__key]?.[pvSortCol] || 0;
        vb = pvData[b.__key]?.[pvSortCol] || 0;
      }

      if(va === vb) return 0;
      if(va == null) return 1;
      if(vb == null) return -1;

      if(typeof va === 'number' && typeof vb === 'number'){
        return pvSortAsc ? va - vb : vb - va;
      }
      return pvSortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }
  // ====================

  let bodyHtml = '';
  pvRowRecords.forEach(rec => {
    const rowKey = rec.__key;
    const rowNums = pvColKeys.map(ck => pvData[rowKey]?.[ck]).filter(v => v !== null && v !== undefined);
    const rowTotal = aggVals(rowNums, pvFields.agg === 'count' ? 'sum' : pvFields.agg);

    bodyHtml += '<tr>';

    // Kolom-kolom Baris (terpisah)
    pvFields.row.forEach(f => {
      bodyHtml += `<td class="cl">${rec[f] ?? ''}</td>`;
    });

    // Nilai
    pvColKeys.forEach(ck => {
      const v = pvData[rowKey]?.[ck];
      let bg = '';
      if(hm === 'row' && rowNums.length) bg = hmColor(v, Math.min(...rowNums), Math.max(...rowNums));
      else if(hm === 'all' && allVals.length) bg = hmColor(v, Math.min(...allVals), Math.max(...allVals));
      bodyHtml += `<td class="vc"${bg ? ` style="background:${bg}"` : ''}>${numFmt(v)}</td>`;
    });

    bodyHtml += `<td class="rc">${numFmt(rowTotal)}</td></tr>`;
  });

  // Baris Total
  const colTotalsHtml = pvColKeys.map(ck => {
    const arr = pvRowRecords.map(rec => pvData[rec.__key]?.[ck]).filter(v => v !== null && v !== undefined);
    return `<td class="rc">${numFmt(aggVals(arr, pvFields.agg==='count'?'sum':pvFields.agg))}</td>`;
  }).join('');

  const grandTotal = numFmt(aggVals(allVals, pvFields.agg==='count'?'sum':pvFields.agg));

  bodyHtml += `<tr style="border-top:1px solid var(--bd)"><td class="cl" colspan="${pvFields.row.length}" style="color:var(--ac2);text-align:right;font-weight:600">Total</td>${colTotalsHtml}<td class="rc">${grandTotal}</td></tr>`;

  document.getElementById('pt-body').innerHTML = bodyHtml;
}

function renderPivot(){
  const id=document.getElementById('pv-lyr').value;
  const layer=LAYERS.find(l=>l.id===id);if(!layer)return;

  const rowFs = Array.from(document.getElementById('pv-row').selectedOptions).map(o=>o.value).filter(Boolean);
  const colFs = Array.from(document.getElementById('pv-col').selectedOptions).map(o=>o.value).filter(f=>f);
  const valF = document.getElementById('pv-val').value;
  const agg = document.getElementById('pv-agg').value;

  if(!rowFs.length || !valF) return;

  const hasCol = colFs.length > 0;
  const rowAlias = rowFs.map(f=>fieldAlias(layer,f)).join(' | ');

  const features = getFilteredFeatures(layer);
  const rows = features.map(f=>f.properties||{});

  // Buat kombinasi unik untuk Baris (setiap field jadi kolom sendiri)
  const rowRecords = [];
  const seen = new Set();

  rows.forEach(r => {
    const record = { __key: '' };
    rowFs.forEach(f => record[f] = String(r[f] ?? 'N/A'));
    record.__key = rowFs.map(f => record[f]).join(' | ');   // hanya untuk internal key

    const keyStr = JSON.stringify(record);
    if(!seen.has(keyStr)){
      seen.add(keyStr);
      rowRecords.push(record);
    }
  });

  // Urutkan sesuai urutan field di dropdown Baris
  rowRecords.sort((a,b) => {
    for(let f of rowFs){
      const cmp = a[f].localeCompare(b[f]);
      if(cmp !== 0) return cmp;
    }
    return 0;
  });

  pvRowRecords = rowRecords;           // ← variabel baru
  pvColKeys = hasCol ? [...new Set(rows.map(r => colFs.map(f=>String(r[f]??'N/A')).join(' | ')))].sort() : ['Nilai'];

  pvFields = {row: rowFs, col: colFs, val: valF, agg, rowAlias, allFields: layer.all_fields};
  pvSortCol = null; pvSortAsc = true;

  // Bangun data pivot
  const grids = {};
  pvRowRecords.forEach(rec => { grids[rec.__key] = {}; pvColKeys.forEach(ck => grids[rec.__key][ck] = []); });

  rows.forEach(r => {
    const rowKey = rowFs.map(f => String(r[f] ?? 'N/A')).join(' | ');
    const colKey = hasCol ? colFs.map(f => String(r[f] ?? 'N/A')).join(' | ') : 'Nilai';
    if(grids[rowKey] && grids[rowKey][colKey] !== undefined){
      grids[rowKey][colKey].push(r[valF]);
    }
  });

  pvData = {};
  pvRowRecords.forEach(rec => {
    pvData[rec.__key] = {};
    pvColKeys.forEach(ck => {
      pvData[rec.__key][ck] = aggVals(grids[rec.__key][ck], agg);
    });
  });

  // Info filter
  const gf = globalFilters[id];
  const filterInfo = document.getElementById('pv-filter-info');
  if(filterInfo){
    filterInfo.textContent = gf&&gf.col ? `⚡ Filter aktif: ${gf.col} ${gf.op} "${gf.val}" (${features.length} baris)` : '';
    filterInfo.style.color = '#f59e0b';
  }

  _renderPivotBody();
}

function dlPivotCsv(){
  if(!pvRowRecords || !pvData) return;

  let header = [...pvFields.row.map(f => fieldAlias({all_fields:pvFields.allFields}, f))];
  header = header.concat(pvColKeys, ['Total']);

  const csvRows = [header.map(csvEsc).join(',')];

  pvRowRecords.forEach(rec => {
    const rowKey = rec.__key;
    const rowData = pvFields.row.map(f => rec[f] ?? '');
    pvColKeys.forEach(ck => rowData.push(pvData[rowKey]?.[ck] ?? ''));
    const nums = pvColKeys.map(ck => pvData[rowKey]?.[ck]).filter(v=>v!==null&&v!==undefined);
    rowData.push(aggVals(nums, pvFields.agg==='count'?'sum':pvFields.agg) ?? '');

    csvRows.push(rowData.map(csvEsc).join(','));
  });

  dlText(csvRows.join('\n'),'spada-pivot.csv','text/csv');
}