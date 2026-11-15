import { Container, getContainer } from "@cloudflare/containers";

export class AtlasContainer extends Container {
  defaultPort = 8000;
  sleepAfter = "10m";
  enableInternet = true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") return Response.redirect(new URL("/original/#globe", url), 302);
    if (url.pathname.startsWith("/api/")) {
      return getContainer(env.ATLAS_API).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
