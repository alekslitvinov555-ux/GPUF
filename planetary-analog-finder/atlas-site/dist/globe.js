(function () {
  const R = Math.PI / 180;
  const SIZE = 192;
  const cache = {};
  const trek = {
    moon: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/2/',
    mars: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/2/'
  };
  const earth = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_NextGeneration&STYLES=&FORMAT=image/jpeg&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=1024&HEIGHT=512';
  function texture(body) {
    if (cache[body]) return cache[body];
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const tiles = body === 'earth' ? [[earth,0,0,1024,512]] : Array.from({ length: 32 }, (_, i) => {
      const x = i % 8, y = Math.floor(i / 8);
      return [trek[body] + y + '/' + x + '.jpg', x * 128, y * 128, 128, 128];
    });
    return cache[body] = Promise.all(tiles.map(([url,x,y,w,h]) => new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { ctx.drawImage(img,x,y,w,h); resolve(true); };
      img.onerror = () => {
        if(body==='earth' && !img.dataset.retry){
          img.dataset.retry='yes';
          img.src='https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.png';
          return;
        }
        resolve(false);
      };
      img.src = url;
    }))).then(status => status.filter(Boolean).length >= tiles.length / 2
      ? ctx.getImageData(0,0,1024,512).data : null).catch(() => null);
  }
  function fallback(body, lat, lon) {
    const a = lat * R, b = lon * R;
    const n = Math.sin(b*7 + Math.sin(a*9))*Math.cos(a*8) + .5*Math.cos(b*17 + a*11) + .18*Math.sin(b*51 - a*41);
    if (body === 'moon') return [145+n*32,146+n*31,153+n*30];
    if (body === 'mars') return [180+n*39,90+n*35,52+n*28];
    const continents = Math.sin(b*2.1 + Math.sin(a*5)) + .68*Math.cos(b*4.2 - a*3.4) + n*.28;
    if (Math.abs(lat) > 74 + n*3) return [197,211,222];
    if (continents > .42 && lat > -58) return [97+n*24,117+n*25,85+n*10];
    return [29+n*10,77+n*18,136+n*17];
  }
  class AtlasGlobe {
    constructor(canvas, onPick) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.canvas.width = this.canvas.height = SIZE;
      this.image = this.ctx.createImageData(SIZE,SIZE);
      (window.atlasGlobes ??= []).push(this);
      window.upgradeAtlasGlobe?.(this);
      this.onPick = onPick;
      this.setBody(canvas.dataset.body);
      let pointer;
      canvas.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        this.flight = null;
        pointer = { id: e.pointerId, x:e.clientX,y:e.clientY, movement:0 };
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', e => {
        if (!pointer || pointer.id !== e.pointerId) return;
        const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
        pointer.movement += Math.abs(dx)+Math.abs(dy);
        pointer.x = e.clientX; pointer.y = e.clientY;
        this.lon -= dx*.55; this.lat = Math.max(-89,Math.min(89,this.lat+dy*.55));
        this.schedule();
      });
      canvas.addEventListener('pointerup', e => {
        if (!pointer || pointer.id !== e.pointerId) return;
        if (pointer.movement < 6 && this.onPick) {
          const rect = canvas.getBoundingClientRect();
          const x = (e.clientX-rect.left)*SIZE/rect.width, y = (e.clientY-rect.top)*SIZE/rect.height;
          const chosen = this.projected.find(point => Math.hypot(point.x-x,point.y-y) < 11);
          if (chosen) this.onPick(chosen.marker);
        }
        pointer = null;
      });
      canvas.addEventListener('pointercancel', () => { pointer = null; });
    }
    setBody(body) {
      this.body = body; this.pixels = null; this.markers = []; this.projected = [];
      this.lat = body === 'earth' ? 17 : 5; this.lon = body === 'earth' ? -26 : 30; this.zoom = 1;
      this.flight = null; this.schedule();
      texture(body).then(pixels => { if (this.body === body) { this.pixels = pixels; this.schedule(); } });
    }
    setMarkers(markers) { this.markers = markers; this.schedule(); }
    fly(lat,lon,zoom=1.26) {
      const delta = ((lon-this.lon)%360+540)%360-180;
      const flight = this.flight = {};
      const from = [this.lat,this.lon,this.zoom];
      const start = performance.now();
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const tick = now => {
        if (this.flight !== flight) return;
        const t = reduced ? 1 : Math.min(1,(now-start)/720);
        const k = t*t*(3-2*t);
        this.lat = from[0]+(lat-from[0])*k; this.lon = from[1]+delta*k;
        this.zoom = from[2]+(zoom-from[2])*k; this.draw();
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    schedule() {
      if (this.pending) return;
      this.pending = requestAnimationFrame(() => { this.pending = null; this.draw(); });
    }
    draw() {
      const radius = SIZE*.375*this.zoom, mid = SIZE/2;
      const a = this.lat*R, sin = Math.sin(a), cos = Math.cos(a);
      const data = this.image.data;
      for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) {
        const px=(x-mid)/radius, py=(mid-y)/radius, r2=px*px+py*py;
        const i=(y*SIZE+x)*4;
        if (r2>1) {
          data[i]=this.body==='earth'?39:52; data[i+1]=54; data[i+2]=this.body==='earth'?96:67;
          data[i+3]=Math.max(0,62-(Math.sqrt(r2)-1)*520); continue;
        }
        const z=Math.sqrt(1-r2);
        const lat=Math.asin(Math.max(-1,Math.min(1,py*cos+z*sin)))/R;
        const lon=this.lon+Math.atan2(px,z*cos-py*sin)/R;
        const light=.23+.77*Math.max(0,-.44*px+.33*py+.83*z);
        const j=(Math.min(511,Math.floor((90-lat)*512/180))*1024+Math.floor(((lon+180)%360+360)%360*1024/360))*4;
        const colour=this.pixels?.[j+3] ? this.pixels.subarray(j,j+3) : fallback(this.body,lat,lon);
        for(let k=0;k<3;k++) data[i+k]=colour[k]*light;
        data[i+3]=Math.min(255,(1-Math.sqrt(r2))*radius*255);
      }
      if(this.webglDraw?.()) this.ctx.clearRect(0,0,SIZE,SIZE);
      else this.ctx.putImageData(this.image,0,0);
      this.projected=[];
      for(const marker of this.markers) {
        const lat=marker.lat*R, lon=(marker.lon-this.lon)*R;
        const h=Math.cos(lat), v=Math.sin(lat);
        if (v*sin+h*Math.cos(lon)*cos<0) continue;
        const x=mid+radius*h*Math.sin(lon), y=mid-radius*(v*cos-h*Math.cos(lon)*sin);
        this.projected.push({x,y,marker});
        this.ctx.beginPath(); this.ctx.arc(x,y,marker.active?5:3.5,0,2*Math.PI);
        this.ctx.fillStyle=marker.active?'#c9f48a':'#f5f7ef'; this.ctx.fill();
        this.ctx.strokeStyle='#12171d'; this.ctx.lineWidth=1.3; this.ctx.stroke();
      }
    }
  }
  window.AtlasGlobe = AtlasGlobe;
})();
