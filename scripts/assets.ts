// The asset pipeline, shared by the build and the dev server: app.css is the
// tokens, base styles, vendored Basecoat components and site styles concatenated
// in order; fixi.js is the vendored, cut-down fixi; site.js is the small client
// script for the theme and in-page navigation (client/site.js).

import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

export const CSS_FILES = [
  "styles/tokens.css",
  "styles/base.css",
  "vendor/basecoat/button.css",
  "vendor/basecoat/card.css",
  "vendor/basecoat/switch.css",
  "styles/app.css",
];

export interface Asset {
  body: string;
  type: string;
}

export async function loadAssets(): Promise<Record<string, Asset>> {
  const css = await Promise.all(CSS_FILES.map((f) => Bun.file(join(ROOT, f)).text()));
  return {
    "app.css": { body: css.join("\n"), type: "text/css; charset=utf-8" },
    "site.js": {
      body: await Bun.file(join(ROOT, "client/site.js")).text(),
      type: "text/javascript; charset=utf-8",
    },
    "fixi.js": {
      body: await Bun.file(join(ROOT, "vendor/fixi/fixi.js")).text(),
      type: "text/javascript; charset=utf-8",
    },
  };
}

/** "app.css" -> "app.1a2b3c4d5e.css" */
export function hashedName(name: string, body: string): string {
  const hash = new Bun.CryptoHasher("sha256").update(body).digest("hex").slice(0, 10);
  const dot = name.lastIndexOf(".");
  return `${name.slice(0, dot)}.${hash}${name.slice(dot)}`;
}
