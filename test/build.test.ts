import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "../scripts/build";
import { CSS_FILES, hashedName, loadAssets } from "../scripts/assets";

let dir: string;
let manifest: Record<string, string>;
let bundle: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "site-build-"));
  manifest = await build(dir);
  bundle = await Bun.file(join(dir, "worker.js")).text();
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("build", () => {
  test("writes content-hashed assets and bakes their URLs into the worker", async () => {
    expect(Object.keys(manifest).sort()).toEqual(["app.css", "fixi.js", "site.js"]);
    const files = await readdir(join(dir, "public/assets"));
    for (const url of Object.values(manifest)) {
      expect(url).toMatch(/^\/assets\/[a-z]+\.[0-9a-f]{10}\.(css|js)$/);
      expect(files).toContain(url.slice("/assets/".length));
      expect(bundle).toContain(url);
    }
  });

  test("hashes change with content", () => {
    expect(hashedName("app.css", "a")).not.toBe(hashedName("app.css", "b"));
    expect(hashedName("app.css", "a")).toBe(hashedName("app.css", "a"));
  });

  test("copies public files, including cache headers for hashed assets and images", async () => {
    const headers = await Bun.file(join(dir, "public/_headers")).text();
    expect(headers).toContain("/assets/*");
    expect(headers).toContain("immutable");
    expect(await Bun.file(join(dir, "public/images/projects/hypermedia-jobs.webp")).exists()).toBe(true);
  });

  test("ships the cut-down fixi, not the upstream copy", async () => {
    const fixi = await Bun.file(join(dir, "public", manifest["fixi.js"]!)).text();
    expect(fixi).toBe(await Bun.file(join(import.meta.dir, "../vendor/fixi/fixi.js")).text());
    expect(await readdir(join(dir, "public/assets"))).not.toContain("fixi.upstream.js");
  });

  test("the worker bundle ships no test or dev code", () => {
    for (const marker of ["bun:test", "Bun.serve", "PAGES"]) expect(bundle).not.toContain(marker);
  });

  test("the worker module exports only its handler (workerd rejects other exports)", async () => {
    const mod = await import(join(dir, "worker.js"));
    expect(Object.keys(mod)).toEqual(["default"]);
    expect(typeof mod.default.fetch).toBe("function");
  });

  test("app.css is plain CSS from the vendored components we list", async () => {
    const css = (await loadAssets())["app.css"]!.body;
    for (const file of CSS_FILES) expect(await Bun.file(join(import.meta.dir, "..", file)).exists()).toBe(true);
    for (const cls of [".switch", ".btn", ".card", ".tile"]) expect(css).toContain(cls);
    expect(css).not.toContain("@apply");
    expect(css).not.toContain("--tw-");
  });
});
