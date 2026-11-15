/* Reuses the TerraNova God’s Eye component with a point from the original atlas. */
import { GodsEye } from "./godseye.js";
import { formatCoord } from "./format.js";

const params = new URLSearchParams(location.search);
const lat = Number(params.get("lat"));
const lon = Number(params.get("lon"));
const error = document.getElementById("terrain-error");
if (!params.get("lat") || !params.get("lon") || !Number.isFinite(lat) || !Number.isFinite(lon) ||
    Math.abs(lat)>84 || Math.abs(lon)>180) {
  error.textContent = "Choose a location within 84° latitude on the original atlas.";
} else {
  try {
    const view = new GodsEye(document.getElementById("godseye"));
    view.onClose = () => { location.href="/original/#globe"; };
    const query = new URLSearchParams({lat:String(lat),lon:String(lon)});
    const response = await fetch("/api/cell?"+query);
    const cell = response.ok ? await response.json() : {};
    const locationLabel = formatCoord(lat,lon,3);
    const site = {lat,lon,label:cell.label || {text:locationLabel}};
    error.textContent = "Terrain viewer closed.";
    await view.show(site,{subtitle:locationLabel, values:cell.values || {},
      dossier:{title:site.label.text, coordinates:locationLabel}});
  } catch (failure) {
    error.textContent = "Unable to open God’s Eye: "+failure.message;
  }
}
