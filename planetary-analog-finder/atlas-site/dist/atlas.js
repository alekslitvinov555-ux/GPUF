(() => {
  const $ = id => document.getElementById(id);
  const data = window.ANALOG_DATA;
  const model = createAtlasModel(data);
  const targets = window.PLANETARY_TARGETS;
  const names = { moon:'Moon', mars:'Mars' };
  const featureLabels = {tmean:'Mean temperature',tmin:'Minimum temperature',diurnal:'Day–night temperature swing',albedo:'Albedo',precip:'Precipitation',soil:'Topsoil wetness',rh:'Relative humidity',wind:'Wind speed',elev:'Elevation',frost:'Frost days',seasonal:'Seasonal temperature swing'};
  const targetIds = { moon:['moon_south_pole','moon_mare'], mars:['jezero_combined','gale_rems','elysium_twins','mars_periglacial'] };
  const titles = {moon_south_pole:'South pole',moon_mare:'Basaltic plains',jezero_combined:'Jezero crater',gale_rems:'Gale crater',elysium_twins:'Elysium Planitia',mars_periglacial:'Mid-latitudes'};
  const state = { body:'moon', applied:false, selected:null, results:[] };
  const targetGlobe = new AtlasGlobe($('target-globe'), marker => chooseSite(marker));
  const earthGlobe = new AtlasGlobe($('earth-globe'), marker => showResult(marker));
  document.querySelectorAll('#home canvas').forEach(canvas => new AtlasGlobe(canvas));
  const coord = point => point.lon == null ? Math.abs(point.lat).toFixed(3)+'° S · geographic pole' : TerraNovaFormat.formatCoord(point.lat,point.lon,3);
  const percent = score => new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(score*100)+'%';
  const number = value => new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
  const label = key => featureLabels[key] ?? data.config.features[key].label;
  const source = row => row.feature.source;
  const nasaPower = 'https://power.larc.nasa.gov/';
  const element = (tag,content,className) => {
    const node = document.createElement(tag);
    if (content != null) node.textContent = content;
    if (className) node.className = className;
    return node;
  };
  const link = (title,url) => {
    const a = element('a',title+' ↗');
    a.href=url; a.target='_blank'; a.rel='noopener'; return a;
  };
  function sites() {
    return targetIds[state.body].flatMap(id => targets[id].sites.map(site => ({ ...site, id })));
  }
  function renderSites() {
    const points=sites();
    targetGlobe.setMarkers(points.map(site => ({...site,active:state.selected?.name===site.name})));
    const buttons=points.map(site => {
      const btn=element('button',site.name);
      btn.type='button'; btn.disabled=!state.applied;
      btn.setAttribute('aria-pressed',String(state.selected?.name===site.name));
      btn.onclick=()=>chooseSite(site); return btn;
    });
    $('sites').replaceChildren(...buttons);
  }
  function resetResult() {
    state.results=[];
    $('comparison').hidden=true; $('compare').hidden=true;
    $('compare-imagery').replaceChildren();
    $('ranked').replaceChildren(); $('export-actions').hidden=true; $('reason').replaceChildren();
    $('earth-label').textContent='Matches appear here';
    earthGlobe.setMarkers([]);
  }
  function showCriteria() {
    $('panel').hidden=false; $('criteria').hidden=false; $('results').hidden=true;
    $('panel-title').textContent='Criteria';
    if (matchMedia('(max-width: 780px)').matches) document.getElementById('panel').scrollIntoView({block:'start'});
    for (const button of document.querySelectorAll('[data-preset]')) button.setAttribute('aria-pressed','false');
    const keys=new Set(targetIds[state.body].flatMap(id => Object.keys(data.config.profiles[id].targets)));
    $('weights').replaceChildren(...[...keys].map(key => {
      const block=element('div',null,'weight');
      const caption=element('label',label(key)); caption.htmlFor='weight-'+key;
      const output=element('output',state.weights[key]??1); caption.append(output);
      const input=element('input'); input.type='range'; input.min='0'; input.max='5'; input.step='1';
      input.value=state.weights[key]??1; input.id='weight-'+key; input.name=key;
      input.oninput=()=>{output.value=input.value;};
      block.append(caption,input); return block;
    }));
  }
  function start(body) {
    Object.assign(state,{body,applied:false,selected:null,weights:{},allowed:[]});
    $('home').hidden=true; $('workspace').hidden=false;
    $('workspace').classList.remove('arrive'); void $('workspace').offsetWidth; $('workspace').classList.add('arrive');
    $('panel').hidden=true;
    $('pair-title').textContent=names[body]+' → Earth'; $('target-title').textContent=names[body];
    $('guide').textContent='Open Criteria to set your search priorities.';
    targetGlobe.setBody(body); earthGlobe.setBody('earth'); resetResult(); renderSites();
    const site=sites()[0]; if(site) targetGlobe.fly(site.lat,site.lon ?? 0,1.04);
    $('settings').focus();
  }
  function chooseSite(site) {
    if (!state.applied) { showCriteria(); return; }
    state.selected=site; renderSites(); resetResult();
    targetGlobe.fly(site.lat,site.lon ?? 0);
    state.results=model.rank(site.id,state.weights,state.allowed,state.novelOnly);
    $('guide').textContent=state.results.length?'Select an Earth candidate or open its comparison.':'Adjust the criteria or search area.';
    $('panel').hidden=false; $('criteria').hidden=true; $('results').hidden=false;
    $('panel-title').textContent='Earth candidates';
    $('scope').textContent=state.results.length
      ? 'Cells scored: '+state.results.length+'. NASA POWER grid: 0.5° × 0.625°. Targets within the same region may share a profile.'
      : 'No candidates for this target and filter combination.';
    if(state.results.length) showResult(state.results[0]);
    $('export-actions').hidden=!state.results.length;
  }
  function showResult(cell) {
    const best=state.results.slice(0,state.limit);
    earthGlobe.fly(cell.lat,cell.lon,1.31);
    earthGlobe.setMarkers(best.map(item=>({...item,active:item.index===cell.index})));
    $('earth-label').textContent=cell.country.name+' · '+coord(cell);
    $('ranked').replaceChildren(...best.map((item,i)=>{
      const button=element('button',null,'rank-item');
      const name=element('span',(i+1)+'. '+item.country.name);
      name.append(element('small',coord(item)));
      button.append(name,element('strong',percent(item.score)));
      button.setAttribute('aria-pressed',String(item.index===cell.index));
      button.onclick=()=>showResult(item); return button;
    }));
    const insight=element('p',cell.nearest.name ? 'Nearest cataloged analog: '+cell.nearest.name+' · '+Math.round(cell.nearest.km)+' km' : 'No cataloged analog distance available.');
    $('reason').replaceChildren(insight,...cell.rows.slice().sort((a,b)=>b.score-a.score).map(row=>{
      const line=element('div',null,'metric-mini');
      const score=element('strong',percent(row.score));
      score.style.setProperty('--match',percent(row.score));
      line.append(element('span',label(row.key)),score); return line;
    }));
    $('compare').hidden=false;
    $('compare').onclick=()=>renderCompare(cell,true);
    renderCompare(cell,false);
  }
  function renderCompare(cell,focus) {
    const site=state.selected, target=targets[site.id];
    const left=element('article',null,'place'), right=element('article',null,'place');
    const map='https://www.openstreetmap.org/?mlat='+cell.lat+'&mlon='+cell.lon+'#map=9/'+cell.lat+'/'+cell.lon;
    left.append(element('strong',site.name),element('small',coord(site)),link('Mission map or source',site.source || target.localMap || 'https://trek.nasa.gov/'));
    right.append(element('strong',cell.country.name+' · '+percent(cell.score)),element('small',coord(cell)),link('Open in OpenStreetMap',map));
    $('compare-cards').replaceChildren(left,right);
    $('compare-imagery').replaceChildren(atlasImagery(state.body,site),atlasImagery('earth',cell));
    const table=element('table',null,'metric-table');
    table.append(element('caption',titles[site.id]+' · Criteria used in the ranking'));
    const head=table.createTHead().insertRow();
    for(const title of ['Criterion',names[state.body],'Earth','Match']) {
      const th=element('th',title); th.scope='col'; head.append(th);
    }
    const tbody=table.createTBody();
    for(const row of cell.rows) {
      const tr=tbody.insertRow(), unit=row.feature.unit;
      const targetText=row.direct?number(row.goal)+' '+unit:'Proxy '+percent(row.goal);
      const earthText=number(row.value)+' '+unit+(row.direct?'':' · '+percent(row.percentile)+' of sample');
      for(const value of [label(row.key),targetText,earthText,percent(row.score)]) tr.insertCell().textContent=value;
      tr.cells[0].title=source(row);
      tr.cells[1].title=row.target.why;
      const ramp=TerraNovaColors.LAYER_RAMPS.tmean;
      if(ramp) {
        const swatch=TerraNovaColors.paint([row.score],1,1,'metric',{ramp,lo:0,hi:1});
        const rgb=swatch.data ?? swatch;
        if(rgb.length>=3) tr.cells[3].style.borderBottomColor='rgb('+[...rgb.slice(0,3)].join(',')+')';
      }
    }
    const provenance=element('p','Earth values use 2001–2025 climatology. Proxy targets are expressed as percentiles of the pilot dataset. Scores measure similarity on the selected criteria. Field suitability and testing history require separate verification.','source-note');
    const sources=element('p',null,'source-note'); sources.append(link('NASA POWER',nasaPower));
    if(site.id==='jezero_combined') sources.append(' · ',link('Perseverance MEDA archive','https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html'));
    $('compare-metrics').replaceChildren(table,calculationDetails(cell),provenance,sources);
    $('comparison').hidden=false;
    if(focus) $('comparison').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function calculationDetails(cell) {
    const detail=element('details',null,'advanced');
    detail.open=true;
    detail.append(element('summary','Full calculation · '+percent(cell.score)));
    detail.append(element('p','For each row, similarity = exp(−z²), where z = (Earth input − target input) ÷ scale. Contribution = similarity × weight ÷ total weight. Contributions sum to the final score.'));
    const scroll=element('div',null,'calculation-scroll');
    const table=element('table',null,'metric-table');
    const head=table.createTHead().insertRow();
    for(const title of ['Criterion','Basis','Target input','Earth input','Difference','Scale','z','Weight','Similarity','Contribution']){
      const th=element('th',title);th.scope='col';head.append(th);
    }
    const body=table.createTBody();
    const precision=n=>Number(n.toPrecision(7)).toString();
    for(const row of cell.rows){
      const tr=body.insertRow();
      const values=[label(row.key),row.direct?row.feature.unit:'Area-weighted percentile (0–1)',
        ...[row.goal,row.actual,row.difference,row.scale,row.distance,row.weight,row.score,row.contribution].map(precision)];
      for(const value of values)tr.insertCell().textContent=value;
    }
    const total=body.insertRow();
    for(const value of ['Final score','','','','','', '',precision(cell.totalWeight),'',precision(cell.score)])
      total.insertCell().textContent=value;
    scroll.append(table);detail.append(scroll);
    for(const row of cell.rows)detail.append(element('p',label(row.key)+' · '+row.feature.source+' · '+row.target.why));
    const download=element('button','Download calculation CSV ↓','quiet');
    download.type='button';
    download.onclick=()=>{
      const quote=s=>'"'+String(s).replaceAll('"','""')+'"';
      const lines=['target,earth_lat,earth_lon,criterion,basis,target_input,earth_input,difference,scale,z,weight,similarity,weighted_contribution,final_score,earth_source,target_rationale'];
      for(const row of cell.rows)lines.push([quote(state.selected.name),cell.lat,cell.lon,quote(label(row.key)),
        quote(row.direct?row.feature.unit:'area-weighted percentile'),row.goal,row.actual,row.difference,row.scale,row.distance,
        row.weight,row.score,row.contribution,cell.score,quote(row.feature.source),quote(row.target.why)].join(','));
      saveExport(lines.join('\r\n'),'text/csv','analog-calculation.csv');
    };
    detail.append(download);
    return detail;
  }
  function saveExport(payload,mime,name) {
    const url=URL.createObjectURL(new Blob([payload],{type:mime}));
    const a=element('a');a.href=url;a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  function exportResults(format) {
    const rows=state.results.slice(0,state.limit);
    const target=state.selected.name;
    const csv=s=>'"'+String(s).replaceAll('"','""')+'"';
    const payload=format==='csv'
      ? ['target,country,latitude,longitude,similarity,nearest_known_analog_km',
          ...rows.map(row=>[csv(target),csv(row.country.name),row.lat,row.lon,row.score,Math.round(row.nearest.km)].join(','))].join('\r\n')
      : JSON.stringify({type:'FeatureCollection',features:rows.map(row=>({
          type:'Feature',geometry:{type:'Point',coordinates:[row.lon,row.lat]},
          properties:{target,country:row.country.name,similarity:row.score,nearestCatalogedAnalog:row.nearest.name,source:'NASA POWER 2001–2025'}
        }))},null,2);
    saveExport(payload,format==='csv'?'text/csv':'application/geo+json','earth-analogs.'+format);
  }
  document.querySelectorAll('[data-pair]').forEach(button=>button.onclick=()=>start(button.dataset.pair));
  document.querySelectorAll('[data-preset]').forEach(button=>button.onclick=()=>{
    const preferred={thermal:['tmean','tmin','diurnal','seasonal','frost'],dry:['precip','soil','rh']};
    const keys=preferred[button.dataset.preset];
    for(const input of $('weights').querySelectorAll('input')){
      input.value=keys?(keys.includes(input.name)?5:1):1;
      input.oninput();
    }
    document.querySelectorAll('[data-preset]').forEach(preset=>preset.setAttribute('aria-pressed',String(preset===button)));
  });
  $('sources-toggle').onclick=()=> $('sources-dialog').showModal();
  $('export-csv').onclick=()=> exportResults('csv');
  $('export-geo').onclick=()=> exportResults('geojson');
  $('back').onclick=()=>{ $('workspace').hidden=true; $('home').hidden=false; document.querySelector('[data-pair="'+state.body+'"]').focus(); };
  $('settings').onclick=showCriteria; $('edit').onclick=showCriteria;
  $('close-panel').onclick=()=>{ $('panel').hidden=true; $('settings').focus(); };
  $('criteria').onsubmit=event=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const allowed=form.getAll('country');
    const weights=Object.fromEntries([...form].filter(([key])=>key!=='country').map(([key,value])=>[key,Number(value)]));
    if(!allowed.length || !Object.values(weights).some(Boolean)) {
      $('guide').textContent='Select at least one country and one nonzero criterion.'; return;
    }
    Object.assign(state,{allowed,weights,novelOnly:$('novel').checked,limit:Number($('limit').value),applied:true,selected:null});
    resetResult(); renderSites();
    $('panel').hidden=true;
    $('guide').textContent='Choose a target from the globe or the list below.';
    $('sites').querySelector('button')?.focus();
  };
})();



