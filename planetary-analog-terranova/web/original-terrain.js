/* Reuses the TerraNova Terrain Lab component with a point from the original atlas. */
import { GodsEye } from "./godseye.js";
import { formatCoord } from "./format.js";

const params = new URLSearchParams(location.search);
const embedded = params.get("embedded") === "1" && window.parent !== window;
const parentOrigin = params.get("parentOrigin");
if (embedded) document.body.classList.add("lab-embedded");

function closeViewer() {
  if (embedded) {
    if (parentOrigin === "null" || parentOrigin === location.origin) {
      window.parent.postMessage("atlas:close-terrain", parentOrigin === "null" ? "*" : parentOrigin);
    }
    return;
  }
  location.href = "/original/#globe";
}

let view;
if (embedded) {
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    if (view?.open) view.close();
    else closeViewer();
  });
}

const lat = Number(params.get("lat"));
const lon = Number(params.get("lon"));
const error = document.getElementById("terrain-error");
if (!params.get("lat") || !params.get("lon") || !Number.isFinite(lat) || !Number.isFinite(lon) ||
    Math.abs(lat)>84 || Math.abs(lon)>180) {
  error.textContent = "Choose a location within 84° latitude on the original atlas.";
} else {
  try {
    view = new GodsEye(document.getElementById("godseye"));
    view.onClose = closeViewer;
    const query = new URLSearchParams({lat:String(lat),lon:String(lon)});
    const response = await fetch("/api/cell?"+query);
    const cell = response.ok ? await response.json() : {};
    const locationLabel = formatCoord(lat,lon,3);
    const site = {lat,lon,label:cell.label || {text:locationLabel}};
    error.textContent = "Terrain viewer closed.";
    await view.show(site,{subtitle:locationLabel, values:cell.values || {},
      dossier:{title:site.label.text, coordinates:locationLabel}});
  } catch (failure) {
    error.textContent = "Unable to open Terrain Lab: "+failure.message;
  }
}
