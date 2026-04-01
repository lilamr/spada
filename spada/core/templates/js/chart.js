/* ════════════════════════════════════════════════════════
   SpaDa — CHART (Multi Y + X + Y + Series/Group By)
   ════════════════════════════════════════════════════════ */

const CHART_PAL = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

function initChart(){
  const sel=document.getElementById('ch-lyr');
  LAYERS.forEach(l=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.name;sel.appendChild(o);});
  if(LAYERS.length)updateChartFields();
}

function updateChartFields(){
  const id=document.getElementById('ch-lyr').value;
  const layer=LAYERS.find(l=>l.id===id);if(!layer)return;
  const opts=allFieldsOpts(layer);

  document.getElementById('ch-x').innerHTML=opts;
  
  // Multi Y
  document.getElementById('ch-y').innerHTML=opts;
  if(layer.all_fields.length>1) document.getElementById('ch-y').options[1].selected=true;

  // Single Y + Series
  document.getElementById('ch-y-single').innerHTML=opts;
  document.getElementById('ch-series').innerHTML='<option value="">(Tidak ada series)</option>'+opts;

  updateChartMode(); // pastikan tampilan sesuai mode default
}

function updateChartMode(){
  const mode = document.getElementById('ch-mode').value;
  document.getElementById('ch-multi-y-grp').style.display = mode === 'multi-y' ? 'block' : 'none';
  document.getElementById('ch-grouped-grp').style.display = mode === 'grouped' ? 'block' : 'none';
  document.getElementById('ch-series-grp').style.display = mode === 'grouped' ? 'block' : 'none';
}

function _chSelectedY(){
  return Array.from(document.getElementById('ch-y').selectedOptions).map(o=>o.value);
}

function renderChart(){
  const id = document.getElementById('ch-lyr').value;
  const layer = LAYERS.find(l=>l.id===id); if(!layer) return;
  
  const type = document.getElementById('ch-type').value;
  const mode = document.getElementById('ch-mode').value;
  const fx = document.getElementById('ch-x').value;
  const agg = document.getElementById('ch-agg').value;
  const isCirc = ['pie','doughnut'].includes(type);
  const isH = type === 'horizontalBar';

  const features = getFilteredFeatures(layer);
  const rows = features.map(f => f.properties || {});

  // Info filter
  const gf = globalFilters[id];
  const filterInfo = document.getElementById('ch-filter-info');
  if(filterInfo){
    filterInfo.textContent = gf&&gf.col ? `⚡ Filter aktif (${features.length} baris)` : '';
    filterInfo.style.color = '#f59e0b';
  }

  let datasets = [];
  chartLabels = [];

  if(mode === 'multi-y'){
    // Mode Lama: Multi Field Y
    const fys = _chSelectedY();
    if(!fys.length) return;

    const allKeys = [...new Set(rows.map(r => String(r[fx] ?? 'N/A')))].slice(0, 80);
    chartLabels = allKeys;

    datasets = fys.map((fy, fi) => {
      const grouped = {};
      allKeys.forEach(k => grouped[k] = []);
      rows.forEach(r => {
        const key = String(r[fx] ?? 'N/A');
        if(grouped[key] !== undefined){
          const val = parseFloat(r[fy]);
          grouped[key].push(isNaN(val) ? 0 : val);
        }
      });
      const data = allKeys.map(k => {
        const arr = grouped[k];
        if(agg==='count') return arr.length;
        if(!arr.length) return 0;
        if(agg==='sum')  return arr.reduce((a,b)=>a+b,0);
        if(agg==='mean') return arr.reduce((a,b)=>a+b,0)/arr.length;
        if(agg==='min')  return Math.min(...arr);
        if(agg==='max')  return Math.max(...arr);
        return arr.length;
      });

      const col = CHART_PAL[fi % CHART_PAL.length];
      return {
        label: `${agg.toUpperCase()}(${fieldAlias(layer,fy)})`,
        data: data,
        backgroundColor: isCirc ? allKeys.map((_,i)=>CHART_PAL[i%CHART_PAL.length]) : rgba(col, .75),
        borderColor: isCirc ? allKeys.map((_,i)=>CHART_PAL[i%CHART_PAL.length]) : col,
        borderWidth: 1.5,
        tension: .4
      };
    });

    chartFy = fys.map(fy => fieldAlias(layer,fy)).join(', ');

  } else {
    // Mode Baru: X + Y tunggal + Series (Group By)
    const fy = document.getElementById('ch-y-single').value;
    const seriesField = document.getElementById('ch-series').value;
    if(!fy) return;

    if(seriesField && seriesField !== ""){
      // Dengan Series/Group By
      const seriesValues = [...new Set(rows.map(r => String(r[seriesField] ?? 'N/A')))].sort();
      const allKeys = [...new Set(rows.map(r => String(r[fx] ?? 'N/A')))].slice(0, 80);
      chartLabels = allKeys;

      datasets = seriesValues.map((seriesVal, fi) => {
        const grouped = {};
        allKeys.forEach(k => grouped[k] = []);
        
        rows.forEach(r => {
          if(String(r[seriesField] ?? 'N/A') === seriesVal){
            const key = String(r[fx] ?? 'N/A');
            if(grouped[key] !== undefined){
              const val = parseFloat(r[fy]);
              grouped[key].push(isNaN(val) ? 0 : val);
            }
          }
        });

        const data = allKeys.map(k => {
          const arr = grouped[k];
          if(agg==='count') return arr.length;
          if(!arr.length) return 0;
          if(agg==='sum')  return arr.reduce((a,b)=>a+b,0);
          if(agg==='mean') return arr.reduce((a,b)=>a+b,0)/arr.length;
          if(agg==='min')  return Math.min(...arr);
          if(agg==='max')  return Math.max(...arr);
          return arr.length;
        });

        const col = CHART_PAL[fi % CHART_PAL.length];
        return {
          label: seriesVal,
          data: data,
          backgroundColor: rgba(col, .75),
          borderColor: col,
          borderWidth: 1.5,
          tension: .4
        };
      });

      chartFy = `${fieldAlias(layer,fy)} dikelompokkan per ${fieldAlias(layer,seriesField)}`;

    } else {
      // Tanpa Series (hanya X + Y tunggal)
      const allKeys = [...new Set(rows.map(r => String(r[fx] ?? 'N/A')))].slice(0, 80);
      chartLabels = allKeys;

      const grouped = {};
      allKeys.forEach(k => grouped[k] = []);
      rows.forEach(r => {
        const key = String(r[fx] ?? 'N/A');
        if(grouped[key] !== undefined){
          const val = parseFloat(r[fy]);
          grouped[key].push(isNaN(val) ? 0 : val);
        }
      });

      const data = allKeys.map(k => {
        const arr = grouped[k];
        if(agg==='count') return arr.length;
        if(!arr.length) return 0;
        if(agg==='sum')  return arr.reduce((a,b)=>a+b,0);
        if(agg==='mean') return arr.reduce((a,b)=>a+b,0)/arr.length;
        if(agg==='min')  return Math.min(...arr);
        if(agg==='max')  return Math.max(...arr);
        return arr.length;
      });

      const col = CHART_PAL[0];
      datasets = [{
        label: `${agg.toUpperCase()}(${fieldAlias(layer,fy)})`,
        data: data,
        backgroundColor: isCirc ? allKeys.map((_,i)=>CHART_PAL[i%CHART_PAL.length]) : rgba(col, .75),
        borderColor: col,
        borderWidth: 1.5,
        tension: .4
      }];

      chartFy = fieldAlias(layer,fy);
    }
  }

  if(chartInst) chartInst.destroy();

  chartInst = new Chart(document.getElementById('chart-canvas').getContext('2d'), {
    type: isH ? 'bar' : type,
    data: { labels: chartLabels, datasets: datasets },
    options: {
      indexAxis: isH ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: "'Space Grotesk'", size: 10 } } },
        tooltip: { backgroundColor: '#1a1d27', borderColor: '#2d3250', borderWidth: 1, titleColor: '#818cf8', bodyColor: '#e2e8f0' }
      },
      scales: isCirc ? {} : {
        x: { ticks: { color: '#64748b', maxRotation: 40, font: { size: 9 } }, grid: { color: 'rgba(45,50,80,.4)' } },
        y: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(45,50,80,.4)' } }
      }
    }
  });
  // Update global variables untuk tombol Sort
  chartLabels = chartLabels;
  chartDatasets = datasets;
}

function dlChartPng(){ if(!chartInst) return; const a=document.createElement('a'); a.download='spada-chart.png'; a.href=document.getElementById('chart-canvas').toDataURL('image/png'); a.click(); }

function sortChart(){
  if(!chartInst || !chartInst.data.labels.length) return;

  chartSortDir = chartSortDir === 1 ? -1 : 1;

  const labels = chartInst.data.labels;
  const firstDataset = chartInst.data.datasets[0];
  if(!firstDataset) return;

  const data = firstDataset.data;

  // Buat index baru yang diurutkan
  const idx = labels.map((_, i) => i)
    .sort((a, b) => chartSortDir * (data[a] - data[b]));

  // Terapkan urutan ke labels
  chartInst.data.labels = idx.map(i => labels[i]);

  // Terapkan urutan ke SEMUA dataset (supaya tetap sinkron saat multi-series)
  chartInst.data.datasets.forEach(ds => {
    ds.data = idx.map(i => ds.data[i]);
  });

  chartInst.update();

  // Update teks tombol
  const btn = document.querySelector('[onclick="sortChart()"]');
  if(btn) btn.textContent = chartSortDir === 1 ? '⇅ Sort ↑ Naik' : '⇅ Sort ↓ Turun';
}

function dlChartSvg(){
  // (bisa dibiarkan sama atau disesuaikan nanti jika perlu)
  if(!chartInst) return;
  // ... kode lama tetap bisa dipakai
  alert("SVG export saat ini masih menggunakan data terakhir. Fitur ini akan ditingkatkan jika diperlukan.");
}