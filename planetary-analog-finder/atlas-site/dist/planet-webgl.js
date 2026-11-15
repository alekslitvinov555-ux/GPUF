import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const openModels = {
  moon: 'https://svs.gsfc.nasa.gov/vis/a010000/a014900/a014959/moon_small.glb',
  mars: 'https://assets.codepen.io/1443237/Mars_1_6792.glb'
};
const textures = new Map();
const models = new Map();
const direction = (lat,lon) => {
  const a=THREE.MathUtils.degToRad(lat), b=THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(a)*Math.cos(b),Math.sin(a),-Math.cos(a)*Math.sin(b));
};
function textureFor(body,pixels) {
  if (!textures.has(body)) {
    const map=new THREE.DataTexture(new Uint8Array(pixels),1024,512);
    map.colorSpace=THREE.SRGBColorSpace;
    map.flipY=true;
    map.minFilter=THREE.LinearFilter;
    map.magFilter=THREE.LinearFilter;
    map.needsUpdate=true;
    textures.set(body,map);
  }
  return textures.get(body);
}
function modelFor(body) {
  if (!models.has(body)) models.set(body,new GLTFLoader().loadAsync(openModels[body]).catch(()=>null));
  return models.get(body);
}
window.upgradeAtlasGlobe = function (globe) {
  const canvas=globe.canvas;
  let renderer;
  try { renderer=new THREE.WebGLRenderer({alpha:true,antialias:true}); }
  catch { return; }
  renderer.domElement.className='planet-webgl';
  renderer.domElement.setAttribute('aria-hidden','true');
  canvas.before(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(1,96,64),new THREE.MeshStandardMaterial({roughness:1}));
  scene.add(sphere);
  const light=new THREE.DirectionalLight(0xffffff,2.0);
  scene.add(light,new THREE.AmbientLight(0xffffff,.8));
  let observedBody, model=null, generation=0;
  const hero=Boolean(canvas.closest('#home'));
  const observed=new ResizeObserver(()=>globe.schedule());
  observed.observe(canvas);
  renderer.domElement.addEventListener('webglcontextlost',()=>{
    globe.webglDraw=null;
    renderer.domElement.remove();
    observed.disconnect();
    globe.schedule();
  });
  globe.webglDraw = function () {
    const size=Math.round(canvas.getBoundingClientRect().width);
    if(!size) return false;
    if(observedBody!==globe.body) {
      observedBody=globe.body;
      const revision=++generation;
      if(model) scene.remove(model);
      model=null;
      if(hero && openModels[globe.body]) modelFor(globe.body).then(asset=>{
        if (!asset || revision!==generation) return;
        const object=asset.scene.clone(true);
        const bounds=new THREE.Box3().setFromObject(object);
        const center=bounds.getCenter(new THREE.Vector3());
        const extent=bounds.getSize(new THREE.Vector3());
        const radius=Math.max(extent.x,extent.y,extent.z)/2;
        if (!(radius>0)) return;
        const holder=new THREE.Group();
        object.position.sub(center);
        holder.add(object);
        holder.scale.setScalar(1/radius);
        scene.add(holder);
        model=holder;
        globe.schedule();
      });
    }
    if(!model && !globe.pixels) { renderer.domElement.hidden=true; return false; }
    renderer.domElement.hidden=false;
    sphere.visible=!model;
    if(!model){
      const map=textureFor(globe.body,globe.pixels);
      if(sphere.material.map!==map){sphere.material.map=map;sphere.material.needsUpdate=true;}
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    if(renderer.domElement.width!==Math.floor(size*renderer.getPixelRatio())) renderer.setSize(size,size,false);
    const facing=direction(globe.lat,globe.lon);
    const scale=1/(.75*globe.zoom);
    camera.left=-scale;camera.right=scale;camera.top=scale;camera.bottom=-scale;
    camera.position.copy(facing).multiplyScalar(4);
    camera.lookAt(0,0,0);
    camera.updateProjectionMatrix();
    light.position.copy(facing).addScaledVector(direction(0,globe.lon-60),.8).add(new THREE.Vector3(0,.6,0));
    renderer.render(scene,camera);
    return true;
  };
  globe.schedule();
};
for(const globe of window.atlasGlobes || []) window.upgradeAtlasGlobe(globe);
