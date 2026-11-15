import { escapeHtml as esc, formatCoord } from "./format.js";

export function imageryHtml(target, site) {
  if (![target.latitude, target.longitude].every(Number.isFinite)) return "";
  const body = target.body.toLowerCase();
  if (body !== "moon" && body !== "mars") return "";
  const bodyURL = body === "moon" ? "https://trek.nasa.gov/moon/" : "https://trek.nasa.gov/mars/";
  const earthURL = "https://worldview.earthdata.nasa.gov/?v=" +
    [site.lon - 1, site.lat - 1, site.lon + 1, site.lat + 1].join(",");
  return `<details class="atlas-calculation" open><summary>Compare orbital imagery</summary>
    <div class="atlas-imagery">
      <figure><div class="atlas-image"><canvas id="atlasTargetCrop" width="300" height="180" role="img" aria-label="Orbital mosaic of the target region"></canvas><span id="atlasTargetImageStatus">Loading mosaic…</span></div>
      <figcaption>${esc(target.name)} · ${esc(formatCoord(target.latitude,target.longitude))}
      <br><a href="${bodyURL}" target="_blank" rel="noopener">NASA ${esc(target.body)} Trek ↗</a></figcaption></figure>
      <figure><div class="atlas-image"><img src="/api/thumb?lat=${site.lat}&amp;lon=${site.lon}" alt="NASA GIBS imagery of the Earth candidate" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>Open the NASA source for imagery.</span></div>
      <figcaption>Earth · ${esc(formatCoord(site.lat,site.lon))}
      <br><a href="${esc(earthURL)}" target="_blank" rel="noopener">NASA Worldview ↗</a></figcaption></figure>
    </div><p>Regional mosaic and terrestrial satellite image. Image scales and resolutions differ.</p></details>`;
}

export function drawTargetCrop(root, target) {
  const canvas = root.querySelector("#atlasTargetCrop");
  const status = root.querySelector("#atlasTargetImageStatus");
  if (!canvas || !status) return;
  const image = new Image();
  image.onload = () => {
    const x = ((target.longitude + 180) % 360 + 360) % 360 / 360 * image.width;
    const y = (90 - target.latitude) / 180 * image.height;
    const width = image.width * 24 / 360;
    const height = width * canvas.height / canvas.width;
    const top = Math.min(image.height - height, Math.max(0, y - height / 2));
    const left = x - width / 2;
    const ctx = canvas.getContext("2d");
    for (const offset of [-image.width, 0, image.width]) {
      ctx.drawImage(image, (offset - left) * canvas.width / width, -top * canvas.height / height,
        image.width * canvas.width / width, image.height * canvas.height / height);
    }
    ctx.fillStyle = "#d5f3a1";
    ctx.beginPath();
    ctx.arc(canvas.width / 2, Math.max(4, Math.min(canvas.height - 4, (y - top) * canvas.height / height)), 4, 0, 2 * Math.PI);
    ctx.fill();
    status.hidden = true;
  };
  image.onerror = () => { status.textContent = "Open NASA Trek for imagery."; };
  image.src = `assets/${target.body.toLowerCase()}_sm.jpg`;
}
