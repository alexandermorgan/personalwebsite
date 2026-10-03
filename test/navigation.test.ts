import { describe, expect, test } from "bun:test";
import { call, decode, PAGES } from "./helpers";

/** The <title> of the same page loaded in full, which in-place navigation must match. */
async function fullTitle(path: string) {
  return decode((await (await call(path)).text()).match(/<title>(.*?)<\/title>/)![1]!);
}

describe("in-page navigation (fixi sends FX-Request)", () => {
  test("returns only the page's <main>, never the header or footer", async () => {
    for (const path of PAGES) {
      const res = await call(path, { fx: true });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(res.headers.get("vary")).toBe("fx-request");
      const body = await res.text();
      expect(body).toStartWith('<main id="main" class="container" tabindex="-1" data-title="');
      expect(body.trimEnd()).toEndWith("</main>");
      for (const marker of ["<html", "<head>", "<header class=\"site-header\"", "<footer", "<script"]) expect(body).not.toContain(marker);
      const title = decode(body.match(/data-title="([^"]*)"/)![1]!);
      expect(title).toBe(await fullTitle(path));
    }
  });

  test("its <main> is exactly the full page's <main>", async () => {
    for (const path of PAGES) {
      const fragment = await (await call(path, { fx: true })).text();
      const full = await (await call(path)).text();
      expect(full).toContain(fragment);
    }
  });

  test("missing pages come back in place with their real status", async () => {
    const res = await call("/nope", { fx: true });
    expect(res.status).toBe(404);
    expect(await res.text()).toStartWith('<main id="main"');
  });
});
