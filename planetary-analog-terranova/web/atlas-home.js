import * as THREE from "three";
import { imageryHtml, drawTargetCrop } from "./atlas-imagery.js";
import { calculationHtml } from "./atlas-calculation.js";
import { formatCoord } from "./format.js";

const $ = id => document.getElementById(id);
const defaultCountries = ["Australia","Canada","Chile","Iceland","Japan","New Zealand","Ukraine","United States of America"];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const labels = {moon:"Moon",earth:"Earth",mars:"Mars"};
const initial = {moon:[8,8],earth:[22,10],mars:[17,65]};
const rad = value => value * Math.PI / 180;
const direction = (lat, lon) => new THREE.Vector3(Math.cos(rad(lat))*Math.cos(rad(lon)),Math.sin(rad(lat)),-Math.cos(rad(lat))*Math.sin(rad(lon)));
const globes = new Map();

class World {
  constructor(host, body) {
    this.host = host;
    [this.lat,this.lon] = initial[body];
    this.zoom = 1;
    this.renderer = new THREE.WebGLRenderer({alpha:true,antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.domElement.setAttribute("aria-hidden","true");
    host.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1.3,1.3,1.3,-1.3,.1,15);
    const material = new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(1,96,64),material),new THREE.AmbientLight(0xffffff,.68));
    this.sun = new THREE.DirectionalLight(0xffffff,2.1);
    this.scene.add(this.sun);
    this.marker = new THREE.Mesh(new THREE.SphereGeometry(.028,12,8),new THREE.MeshBasicMaterial({color:0xd6f3aa}));
    this.marker.visible=false;
    this.scene.add(this.marker);
    new THREE.TextureLoader().load("assets/"+body+".jpg", map=>{
      map.colorSpace=THREE.SRGBColorSpace;
      material.map=map;
      material.needsUpdate=true;
      this.draw();
    },undefined,()=>this.notice("Surface texture unavailable"));
    new ResizeObserver(()=>this.resize()).observe(host);
    let drag;
    host.addEventListener("pointerdown",e=>{
      if(e.button!==0)return;
      drag={id:e.pointerId,x:e.clientX,y:e.clientY};
      this.flight=null;
      host.setPointerCapture(e.pointerId);
    });
    host.addEventListener("pointermove",e=>{
      if(drag?.id!==e.pointerId)return;
      this.lon-=(e.clientX-drag.x)*.65;
      this.lat=Math.max(-89,Math.min(89,this.lat+(e.clientY-drag.y)*.65));
      drag.x=e.clientX;
      drag.y=e.clientY;
      this.draw();
    });
    const stop=()=>{drag=null;};
    host.addEventListener("pointerup",stop);
    host.addEventListener("pointercancel",stop);
  }
  notice(text) {
    const note=document.createElement("span");
    note.textContent=text;
    this.host.append(note);
  }
  resize() {
    const size=Math.round(this.host.clientWidth);
    if(!size)return;
    this.renderer.setSize(size,size,false);
    this.draw();
  }
  draw() {
    if(!this.host.clientWidth)return;
    const facing=direction(this.lat,this.lon);
    this.camera.position.copy(facing).multiplyScalar(5);
    this.camera.zoom=this.zoom;
    this.camera.lookAt(0,0,0);
    this.camera.updateProjectionMatrix();
    this.sun.position.copy(facing).addScaledVector(direction(24,this.lon-70),1.45);
    this.renderer.render(this.scene,this.camera);
  }
  focus(lat,lon) {
    if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
    this.marker.position.copy(direction(lat,lon)).multiplyScalar(1.006);
    this.marker.visible=true;
    const flight=this.flight={};
    const start=performance.now(),from=[this.lat,this.lon,this.zoom];
    const delta=((lon-from[1])%360+540)%360-180;
    const step=now=>{
      if(this.flight!==flight)return;
      const t=reduced?1:Math.min(1,(now-start)/850);
      const e=t*t*(3-2*t);
      this.lat=from[0]+(Math.max(-89,Math.min(89,lat))-from[0])*e;
      this.lon=from[1]+delta*e;
      this.zoom=from[2]+(.98-from[2])*e;
      this.draw();
      if(t<1)requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  clear() {
    this.flight=null;
    this.marker.visible=false;
    this.draw();
  }
}
for(const host of document.querySelectorAll("[data-globe]")){
  try{globes.set(host.dataset.globe,new World(host,host.dataset.globe));}
  catch{const note=document.createElement("span");note.textContent="3D requires WebGL";host.replaceChildren(note);}
}

let catalog, body, selected, results, pending, weights={};
const el=(tag,text)=>{const out=document.createElement(tag);out.textContent=text;return out;};
const action=(text,fn)=>{
  const button=el("button",text);
  button.type="button";
  button.onclick=fn;
  return button;
};
async function api(path,options){
  const response=await fetch(path,options);
  if(!response.ok)throw new Error("Could not load "+path+" ("+response.status+").");
  return response.json();
}
async function start(next){
  pending?.abort();const step=pending=new AbortController();
  body=next;selected=null;results=null;weights={};
  $("worlds").classList.add("paired");
  for(const article of document.querySelectorAll("[data-world]"))
    article.hidden=!["earth",body].includes(article.dataset.world);
  for(const globe of globes.values())globe.clear();
  $("work").hidden=false;$("output").hidden=true;$("targets").hidden=true;$("criteria").hidden=true;$("edit").disabled=true;
  $("hint").textContent=labels[body]+" → Earth. Choose what should match.";
  $("status").textContent="Loading criteria…";
  try{
    catalog??=await Promise.all([api("/api/targets"),api("/api/criteria")]);
    if(step.signal.aborted)return;
    $("status").textContent="";
    openCriteria();
  }catch(error){if(!step.signal.aborted)$("status").textContent=error.message+" Open Advanced Finder to retry.";}
}
function openCriteria(){
  if(!catalog||!body)return;
  $("criteria").hidden=false;$("targets").hidden=true;$("edit").disabled=false;
  const criteria=catalog[1].criteria;
  $("weights").replaceChildren(...criteria.map(criterion=>{
    const label=el("label",criterion.label);
    const output=el("output",Object.hasOwn(weights,criterion.key)?weights[criterion.key]:"Auto");
    const input=el("input","");
    Object.assign(input,{type:"range",min:"0",max:"5",step:"1",value:String(weights[criterion.key]??2),name:criterion.key});
    input.oninput=()=>{weights[criterion.key]=Number(input.value);output.value=input.value;};
    label.append(output,input);
    return label;
  }));
}
function chooseTarget(){
  $("criteria").hidden=true;$("targets").hidden=false;$("output").hidden=true;
  $("hint").textContent="Choose a "+labels[body]+" site to start the search.";
  $("status").textContent="";
  const targets=catalog[0].targets.filter(target=>target.body.toLowerCase()===body);
  $("targets").replaceChildren(...targets.map(target=>action(target.short_name || target.name,()=>score(target))));
}
async function score(target){
  pending?.abort();const step=pending=new AbortController();
  selected=target;
  globes.get(body)?.focus(target.latitude,target.longitude);
  $("status").textContent="Ranking Earth candidates…";$("output").hidden=true;
  try{
    results=await api("/api/score",{method:"POST",signal:step.signal,headers:{"Content-Type":"application/json"},
      body:JSON.stringify({target_id:target.id,weights,allowed_countries:defaultCountries,top_k:3,min_distance_km:200})});
    if(step.signal.aborted)return;
    $("status").textContent=results.results.length?target.name:results.shortfall || "No candidate matches this search.";
    $("hint").textContent=labels[body]+" → Earth. Explore the ranked matches.";
    $("advanced").href="finder.html#target="+encodeURIComponent(target.id);
    $("candidates").replaceChildren(...results.results.map((site,index)=>action(
      "#"+(index+1)+" "+(site.label.country || formatCoord(site.lat,site.lon))+" · "+(site.score*100).toFixed(1)+"%",()=>show(site,index))));
    $("output").hidden=false;
    if(results.results.length)show(results.results[0],0);else $("evidence").replaceChildren();
  }catch(error){if(!step.signal.aborted)$("status").textContent=error.message;}
}
function show(site,index){
  globes.get("earth")?.focus(site.lat,site.lon);
  Array.from($("candidates").children).forEach((button,i)=>button.setAttribute("aria-pressed",String(i===index)));
  $("evidence").innerHTML=imageryHtml(selected,site)+calculationHtml(site,results,catalog[1].criteria);
  drawTargetCrop($("evidence"),selected);
  $("advanced").href="finder.html#target="+encodeURIComponent(selected.id);
}
for(const link of document.querySelectorAll("[data-pair]")){
  link.addEventListener("click",e=>{
    if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
    e.preventDefault();
    start(link.dataset.pair);
  });
}
$("criteria").onsubmit=e=>{e.preventDefault();chooseTarget();};
$("edit").onclick=openCriteria;
$("reset").onclick=()=>{
  pending?.abort();body=null;
  $("worlds").classList.remove("paired");
  for(const article of document.querySelectorAll("[data-world]"))article.hidden=false;
  for(const globe of globes.values())globe.clear();
  $("work").hidden=true;
  $("hint").textContent="Choose the Moon or Mars to compare a mission site with Earth.";
};
