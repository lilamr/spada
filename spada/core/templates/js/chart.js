/* ════════════════════════════════════════════════════════
   SpaDa — CHART
   ════════════════════════════════════════════════════════ */

function initChart(){
  const sel=document.getElementById('ch-lyr');
  LAYERS.forEach(l=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.name;sel.appendChild(o);});
  if(LAYERS.length)updateChartFields();
}

function updateChartFields(){
  const id=document.getElementById('ch-lyr').value;const layer=LAYERS.find(l=>l.id===id);if(!layer)return;
  /* Semua field bisa jadi X maupun Y */
  const opts=allFieldsOpts(layer);
  document.getElementById('ch-x').innerHTML=opts;
  document.getElementById('ch-y').innerHTML=opts;
  if(layer.all_fields.length>1)document.getElementById('ch-y').selectedIndex=1;
}

function renderChart(){
  const id=document.getElementById('ch-lyr').value;const layer=LAYERS.find(l=>l.id===id);if(!layer)return;
  const type=document.getElementById('ch-type').value;
  const fx=document.getElementById('ch-x').value;const fy=document.getElementById('ch-y').value;
  const agg=document.getElementById('ch-agg').value;
  const fyAlias=fieldAlias(layer,fy);chartFy=fyAlias;
  const rows=layer.geojson.features.map(f=>f.properties||{});
  const grouped={};rows.forEach(r=>{const key=String(r[fx]??'N/A');const val=parseFloat(r[fy]);if(!grouped[key])grouped[key]=[];grouped[key].push(isNaN(val)?0:val);});
  chartLabels=Object.keys(grouped).slice(0,80);
  chartValues=chartLabels.map(k=>{const arr=grouped[k];if(agg==='count')return arr.length;if(agg==='sum')return arr.reduce((a,b)=>a+b,0);if(agg==='mean')return arr.reduce((a,b)=>a+b,0)/arr.length;if(agg==='min')return Math.min(...arr);if(agg==='max')return Math.max(...arr);return arr.length;});
  const pal=['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];
  const colors=chartLabels.map((_,i)=>pal[i%pal.length]);const isCirc=['pie','doughnut'].includes(type),isH=type==='horizontalBar';
  if(chartInst)chartInst.destroy();
  chartInst=new Chart(document.getElementById('chart-canvas').getContext('2d'),{
    type:isH?'bar':type,
    data:{labels:chartLabels,datasets:[{label:`${agg.toUpperCase()}(${fyAlias})`,data:chartValues,backgroundColor:isCirc?colors:rgba('#6366f1',.75),borderColor:isCirc?colors:'#6366f1',borderWidth:1.5,tension:.4}]},
    options:{indexAxis:isH?'y':'x',responsive:true,maintainAspectRatio:true,
      plugins:{legend:{labels:{color:'#94a3b8',font:{family:"'Space Grotesk'",size:10}}},tooltip:{backgroundColor:'#1a1d27',borderColor:'#2d3250',borderWidth:1,titleColor:'#818cf8',bodyColor:'#e2e8f0'}},
      scales:isCirc?{}:{x:{ticks:{color:'#64748b',maxRotation:40,font:{size:9}},grid:{color:'rgba(45,50,80,.4)'}},y:{ticks:{color:'#64748b',font:{size:9}},grid:{color:'rgba(45,50,80,.4)'}}}
    }
  });
}

function dlChartPng(){if(!chartInst)return;const a=document.createElement('a');a.download='spada-chart.png';a.href=document.getElementById('chart-canvas').toDataURL('image/png');a.click();}

function sortChart(){
  if(!chartLabels.length)return;
  chartSortDir=chartSortDir===1?-1:1;
  const pairs=chartLabels.map((l,i)=>([l,chartValues[i]]));
  pairs.sort((a,b)=>chartSortDir*(a[1]-b[1]));
  chartLabels=pairs.map(p=>p[0]);
  chartValues=pairs.map(p=>p[1]);
  if(chartInst){
    chartInst.data.labels=chartLabels;
    chartInst.data.datasets[0].data=chartValues;
    chartInst.update();
  }
  const btn=document.querySelector('[onclick="sortChart()"]');
  if(btn)btn.textContent=chartSortDir===1?'⇅ Sort ↑ Naik':'⇅ Sort ↓ Turun';
}

function dlChartSvg(){
  if(!chartLabels.length)return;
  const W=800,H=420,PAD=60,BAR_AREA=W-PAD*2,barW=Math.max(8,Math.min(40,BAR_AREA/chartLabels.length-4));
  const max=Math.max(...chartValues)||1,min=Math.min(0,...chartValues),range=max-min;
  const pal=['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];
  let bars='';
  chartLabels.forEach((lbl,i)=>{
    const x=PAD+(i+.5)*(BAR_AREA/chartLabels.length);const v=chartValues[i];const barH=Math.max(2,(v-min)/range*(H-PAD*2));const y=H-PAD-barH;const col=pal[i%pal.length];
    bars+=`<rect x="${x-barW/2}" y="${y}" width="${barW}" height="${barH}" fill="${col}" rx="2"/>`;
    if(chartLabels.length<=20){const txtLbl=lbl.length>8?lbl.slice(0,8)+'…':lbl;bars+=`<text x="${x}" y="${H-PAD+14}" text-anchor="middle" fill="#64748b" font-size="9" font-family="sans-serif">${txtLbl}</text><text x="${x}" y="${y-4}" text-anchor="middle" fill="#e2e8f0" font-size="9" font-family="sans-serif">${typeof v==='number'?v.toFixed(1):v}</text>`;}
  });
  dlText(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#0f1117"><text x="${W/2}" y="22" text-anchor="middle" fill="#818cf8" font-size="13" font-weight="600" font-family="sans-serif">${chartFy}</text><line x1="${PAD}" y1="${H-PAD}" x2="${W-PAD}" y2="${H-PAD}" stroke="#2d3250" stroke-width="1"/><line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${H-PAD}" stroke="#2d3250" stroke-width="1"/>${bars}</svg>`,'spada-chart.svg','image/svg+xml');
}
/* ── Visual Map ── */
