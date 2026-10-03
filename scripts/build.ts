// Build for deployment:
//   dist/public/          static files served by Workers Static Assets
//   dist/public/assets/   content-hashed CSS/JS, cached forever (see public/_headers)
//   dist/worker.js        the worker bundle, with the hashed asset names baked in

import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { hashedName, loadAssets } from "./assets";

const ROOT = join(import.meta.dir, "..");
const DIST = join(ROOT, "dist");

export async function build(outDir = DIST): Promise<Record<string, string>> {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, "public/assets"), { recursive: true });
  await cp(join(ROOT, "public"), join(outDir, "public"), { recursive: true });

  const manifest: Record<string, string> = {};
  for (const [name, asset] of Object.entries(await loadAssets())) {
    const file = hashedName(name, asset.body);
    await Bun.write(join(outDir, "public/assets", file), asset.body);
    manifest[name] = `/assets/${file}`;
  }

  const result = await Bun.build({
    entrypoints: [join(ROOT, "src/worker.ts")],
    outdir: outDir,
    naming: "worker.js",
    target: "browser",
    format: "esm",
    minify: true,
    sourcemap: "linked",
    define: { __ASSET_MANIFEST__: JSON.stringify(manifest) },
  });
  if (!result.success) throw new AggregateError(result.logs, "worker build failed");
  return manifest;
}

if (import.meta.main) {
  const manifest = await build();
  console.log("built dist/worker.js with assets:", manifest);
}
