// Local development server: runs the worker under Bun.
//   bun run dev            -> http://localhost:8787
// Assets are rebuilt on every request, so CSS and JS edits show up on reload;
// `bun --watch` restarts the server when the worker's code or pages change.
// Set CV_URL to try the CV page with a real PDF.

import { join } from "node:path";
import { loadAssets } from "../scripts/assets";
import worker from "../src/worker";

const ROOT = join(import.meta.dir, "..");
const PORT = Number(process.env.PORT ?? 8787);
const env = { CV_URL: process.env.CV_URL ?? "" };

Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/assets/")) {
      const asset = (await loadAssets())[url.pathname.slice("/assets/".length)];
      if (asset) return new Response(asset.body, { headers: { "content-type": asset.type, "cache-control": "no-cache" } });
    }
    const file = Bun.file(join(ROOT, "public", url.pathname));
    if (url.pathname !== "/" && !url.pathname.includes("..") && (await file.exists())) {
      return new Response(file);
    }
    return worker.fetch(request, env);
  },
});

console.log(`alexandermorgan.dev dev server on http://localhost:${PORT}`);
