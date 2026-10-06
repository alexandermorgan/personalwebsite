import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "../scripts/build";
import { hashedName, site } from "../scripts/site";

let dir: string;
let bundle: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "site-build-"));
  await build(dir);
  bundle = await Bun.file(join(dir, "worker.js")).text();
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("build", () => {
  test("writes content-hashed assets and points the layout at them", async () => {
    const files = await readdir(join(dir, "public/assets"));
    const layout = await Bun.file(join(dir, "public/_pages/_layout.html")).text();
    const used = [...layout.matchAll(/"\/assets\/([^"]+)"/g)].map((m) => m[1]);
    expect(used.sort()).toEqual(files.sort());
    for (const file of files) expect(file).toMatch(/^[a-z]+\.[0-9a-f]{10}\.(css|js)$/);
  });

  test("writes every page file, so the worker can read them", async () => {
    for (const path of (await site()).keys()) {
      if (path.startsWith("/_pages/")) expect(await Bun.file(join(dir, "public", path)).exists()).toBe(true);
    }
  });

  test("hashes change with content", () => {
    expect(hashedName("app.css", "a")).not.toBe(hashedName("app.css", "b"));
    expect(hashedName("app.css", "a")).toBe(hashedName("app.css", "a"));
  });

  test("copies every public file unchanged", async () => {
    const source = join(import.meta.dir, "../public");
    for (const file of await readdir(source)) {
      expect(await Bun.file(join(dir, "public", file)).text()).toBe(await Bun.file(join(source, file)).text());
    }
  });

  test("the worker bundle ships no test or dev code", () => {
    for (const marker of ["bun:test", "Bun.serve", "PAGES"]) expect(bundle).not.toContain(marker);
  });

  test("the worker module exports only its handler (workerd rejects other exports)", async () => {
    const mod = await import(join(dir, "worker.js"));
    expect(Object.keys(mod)).toEqual(["default"]);
    expect(typeof mod.default.fetch).toBe("function");
  });

  test("app.css is plain CSS, with nothing left of Tailwind", async () => {
    const css = (await site()).get("/assets/app.css")!.body as string;
    expect(css).not.toContain("@apply");
    expect(css).not.toContain("--tw-");
  });
});
