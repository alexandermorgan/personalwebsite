// Build for deployment:
//   dist/public/          static files served by Workers Static Assets (see site.ts),
//                         including the page files the worker reads from /_pages/
//   dist/public/assets/   content-hashed CSS/JS, cached forever (see public/_headers)
//   dist/worker.js        the worker bundle
//
// Cloudflare runs this on every push to main, so the blog index, feed and
// sitemap always match pages/.

import { rm } from "node:fs/promises";
import { join } from "node:path";
import { site } from "./site";

const ROOT = join(import.meta.dir, "..");
const DIST = join(ROOT, "dist");

export async function build(outDir = DIST): Promise<void> {
  await rm(outDir, { recursive: true, force: true });
  for (const [path, file] of await site({ hashed: true })) await Bun.write(join(outDir, "public", path), file.body);

  const result = await Bun.build({
    entrypoints: [join(ROOT, "src/worker.ts")],
    outdir: outDir,
    naming: "worker.js",
    target: "browser",
    format: "esm",
    minify: true,
    sourcemap: "linked",
  });
  if (!result.success) throw new AggregateError(result.logs, "worker build failed");
}

if (import.meta.main) {
  await build();
  console.log("built dist/");
}
