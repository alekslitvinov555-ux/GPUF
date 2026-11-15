/* Original Atlas integration for the TerraNova globe (DaRK_MATTER, Apache-2.0). */
import { Globe } from "./globe.js";

export async function mountAtlasGlobe(afx, origin) {
  const host = document.getElementById("globe");
  const globe = new Globe(host, {baseUrl: origin, onPick: (lat, lon) => afx.openCard(lat, lon)});
  host.dataset.renderer = "terranova";
  const texture = origin + "/assets/earth.jpg";
  try {
    await globe.setEarth(texture, texture);
  } catch (error) {
    globe.visible = false;
    globe.renderer.setAnimationLoop(null);
    globe.renderer.domElement.remove();
    throw error;
  }
  document.getElementById("gload").hidden = true;
  const raster = Object.assign(document.createElement("canvas"), {width:720, height:360});
  const ctx = raster.getContext("2d", {willReadFrequently:true});
  const markers = document.createElement("div");
  host.append(markers);
  let selected;
  function draw() {
    ctx.clearRect(0,0,720,360);
    if (afx.LAYERS.heat) ctx.drawImage(afx.HEAT,0,0,720,360);
    globe.setOverlay(ctx.getImageData(0,0,720,360));
    const projected = [];
    const add = (lat, lon, kind, text, extra) => {
      const button = document.createElement(kind === "selection" ? "span" : "button");
      button.className = "afx-marker";
      button.dataset.kind = kind;
      button.textContent = text;
      if (kind === "selection") button.setAttribute("aria-hidden","true");
      else {
        button.type = "button";
        button.title = extra.title || extra.kind;
        button.setAttribute("aria-label", button.title);
        button.addEventListener("click", () => {
          afx.openCard(lat, lon, extra);
          globe.flyTo(lat, lon, 2.4);
        });
      }
      projected.push({lat, lon, el: button});
    };
    if (afx.LAYERS.known) for (const item of afx.CFG.known_analogs)
      add(item.lat, item.lon, "known", "·", {title:item.name, kind:"Well-known analog site"});
    if (afx.LAYERS.case) for (const item of afx.CFG.case_studies)
      add(item.lat, item.lon, "case", "◇", {title:item.name, kind:item.type+" · "+item.analog_of, text:item.text});
    if (afx.LAYERS.gems) afx.gems.forEach((i, rank) =>
      add(afx.LAT[i], afx.LON[i], "gem", String(rank+1), {kind:"Hidden gem #"+(rank+1)}));
    if (selected) add(selected.lat, selected.lon, "selection", "");
    markers.replaceChildren(...projected.map(marker => marker.el));
    globe.setMarkers(projected);
  }
  function switchBasemap(layer) {
    const args = new URLSearchParams({SERVICE:"WMS",REQUEST:"GetMap",VERSION:"1.3.0",
      LAYERS:layer,STYLES:"",FORMAT:"image/jpeg",CRS:"EPSG:4326",BBOX:"-90,-180,90,180",WIDTH:"2048",HEIGHT:"1024"});
    globe.setEarth("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?"+args,texture)
      .catch(error => console.info("Atlas basemap unavailable:",error.message));
  }
  afx.onUpdate(draw);
  window.addEventListener("af-heat",draw);
  window.addEventListener("af-select",event=>{selected=event.detail;draw();});
  window.addEventListener("af-fly",event=>globe.flyTo(event.detail.lat,event.detail.lon,2.4));
  window.addEventListener("af-basemap",event=>switchBasemap(event.detail));
  new MutationObserver(()=>{globe.visible=document.body.classList.contains("view-globe");})
    .observe(document.body,{attributes:true,attributeFilter:["class"]});
  draw();
}
