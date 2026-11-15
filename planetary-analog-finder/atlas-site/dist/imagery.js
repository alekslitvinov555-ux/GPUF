(() => {
  const endpoints={
    moon:{name:'LRO WAC global mosaic',layer:'Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02',viewer:'https://trek.nasa.gov/moon/'},
    mars:{name:'Viking MDIM 2.1 color mosaic',layer:'Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m',viewer:'https://trek.nasa.gov/mars/'},
    earth:{name:'NASA Blue Marble Next Generation',viewer:'https://worldview.earthdata.nasa.gov/'}
  };
  function tileURL(body,z,x,y) {
    if(body!=='earth') return 'https://trek.nasa.gov/tiles/'+endpoints[body].layer+
      '/1.0.0/default/default028mm/'+z+'/'+y+'/'+x+'.jpg';
    const size=180/2**z;
    const west=x*size-180,north=90-y*size;
    const query=new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.3.0',LAYERS:'BlueMarble_NextGeneration',
      STYLES:'',FORMAT:'image/jpeg',CRS:'EPSG:4326',BBOX:[north-size,west,north,west+size].join(','),WIDTH:'256',HEIGHT:'256'});
    return 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?'+query;
  }
  function alternateView(body,site,fov) {
    const moon='https://padc-web.obspm.fr/planeto/hips/CDS_P_Moon_LROC-WAC-100m';
    const mars='https://alasky.cds.unistra.fr/Planets/Mars_Viking_MDIM21';
    const frame=document.createElement('iframe');
    frame.title=body==='moon'?'LRO WAC imagery from Paris Observatory':'Viking imagery from CDS Strasbourg';
    frame.setAttribute('sandbox','allow-scripts allow-same-origin');
    const lon=Number(site.lon??0),lat=Number(site.lat);
    const url=body==='moon'?moon:mars;
    frame.srcdoc='<!doctype html><html lang="en"><meta charset="utf-8">'+
      '<style>html,body,#map{margin:0;width:100%;height:100%;background:#15191b;color:white}</style>'+
      '<div id="map">Loading alternate imagery…</div>'+
      '<script src="https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js"><'+'/script>'+
      '<script>if(window.A){A.init.then(()=>{const a=A.aladin("#map",{fov:'+fov+
      ',showReticle:true,showLayerBox:false,showSimbadPointerControl:false,showFullscreenControl:false});'+
      'a.setImageSurvey(a.createImageSurvey("surface","Planetary mosaic","'+url+
      '","equatorial",'+(body==='moon'?7:5)+',{imgFormat:"jpeg"}));a.gotoRaDec('+lon+','+lat+
      ');}).catch(()=>{document.getElementById("map").textContent="Alternate imagery unavailable";});}'+
      'else{document.getElementById("map").textContent="Alternate imagery unavailable";}<'+'/script>';
    return frame;
  }
  function imagery(body,site) {
    const config=endpoints[body];
    const make=(tag,text,cls)=>{
      const e=document.createElement(tag);
      if(text)e.textContent=text;
      if(cls)e.className=cls;
      return e;
    };
    let zoom=4;
    const card=make('section',null,'imagery-card');
    const heading=make('div',null,'imagery-head');
    const view=make('div',null,'imagery-viewport');
    const tiles=make('div',null,'imagery-tiles');
    const pin=make('span','⊙','imagery-pin');
    const note=make('p',null,'imagery-note');
    const minus=make('button','−'),plus=make('button','+');
    minus.type=plus.type='button';
    minus.setAttribute('aria-label','Zoom out on '+body);
    plus.setAttribute('aria-label','Zoom in on '+body);
    const link=make('a','Open imagery viewer ↗');
    link.href=config.viewer;link.target='_blank';link.rel='noopener';
    heading.append(make('strong',config.name),minus,plus);
    view.append(tiles,pin);
    card.append(heading,view,note,link);
    let revision=0;
    function draw(){
      const generation=++revision;
      const half=2**zoom,full=half*2;
      const lon=site.lon??0;
      const cx=(lon+180)/360*full;
      const cy=(90-site.lat)/180*half;
      const viewportY=Math.max(.66,Math.min(half-.66,cy));
      const rx=1.25,ry=.66;
      tiles.replaceChildren();
      pin.hidden=false;
      pin.style.top=(50+(cy-viewportY)/(2*ry)*100)+'%';
      minus.disabled=zoom<=2;plus.disabled=zoom>=7;
      note.textContent='Loading satellite imagery…';
      let pending=0,loaded=0,total=0;
      for(let y=Math.max(0,Math.floor(viewportY-ry));y<Math.min(half,Math.ceil(viewportY+ry));y++){
        for(let x=Math.floor(cx-rx);x<Math.ceil(cx+rx);x++){
          const image=make('img');
          image.alt='';
          image.style.left=((x-cx+rx)/(rx*2)*100)+'%';
          image.style.top=((y-viewportY+ry)/(ry*2)*100)+'%';
          image.style.width=(100/(2*rx)+.12)+'%';
          image.style.height=(100/(2*ry)+.12)+'%';
          pending++;total++;
          const settled=(ok)=>{
            if(generation!==revision)return;
            if(ok)loaded++;
            if(--pending===0)note.textContent=loaded
              ? (loaded===total?'Target marked':'Partial imagery · target marked')+' · '+(180/half*rx*2).toFixed(2)+'° across · source zoom '+zoom
              : 'Imagery unavailable. Open the source viewer to check this location.';
            if(pending===0 && !loaded && body!=='earth'){
              tiles.replaceChildren(alternateView(body,site,180/half*rx*2));
              pin.hidden=true;
              note.textContent=body==='moon'?'Alternate source · LRO WAC via Paris Observatory':'Alternate source · Viking MDIM21 via CDS Strasbourg';
            }
          };
          image.onload=()=>settled(true);
          image.onerror=()=>{
            if(body!=='earth' && image.src.endsWith('.jpg')){
              image.src=image.src.replace(/\.jpg$/,'.png');return;
            }
            image.hidden=true;settled(false);
          };
          image.src=tileURL(body,zoom,(x+full)%full,y);
          tiles.append(image);
        }
      }
    }
    minus.onclick=()=>{if(zoom>2){zoom--;draw();}};
    plus.onclick=()=>{if(zoom<7){zoom++;draw();}};
    draw();
    return card;
  }
  Object.assign(window,{atlasImagery:imagery,atlasTileURL:tileURL});
})();
