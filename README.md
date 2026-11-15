# Global Planetary Analog Finder

The original PANEM_U atlas is in `planetary-analog-finder/web`. It uses its own climate data and scoring. The companion `planetary-analog-terranova` project serves the terrain API and incorporates TerraNova’s 3D globe, God’s Eye and route planner, with original attribution in its [README](planetary-analog-terranova/README.md) and [license](planetary-analog-terranova/LICENSE).

## Cloudflare deployment

Use **Workers & Pages → Create → Import a Git repository**. Connect this repository and select:

| Field | Value |
|---|---|
| Worker name | `gpuf` |
| Production branch | `main` |
| Root directory | `planetary-analog-terranova` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

Cloudflare Containers needs Workers Paid. The build bundles both frontends. The Worker opens the original atlas at `/original/#globe` and forwards `/api/*` to the FastAPI container. The 3D viewer is at `/terrain.html`. After deployment, confirm `/api/health` returns `ok: true` and open a site’s **God’s Eye** view from the globe.

For local server instructions, see the [companion README](planetary-analog-terranova/README.md).
