import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(new URL("web/", root), dist, { recursive: true });
await cp(new URL("../planetary-analog-finder/web/", root), new URL("original/", dist), {
  recursive: true,
});
console.log("Cloudflare static assets:", fileURLToPath(dist));
