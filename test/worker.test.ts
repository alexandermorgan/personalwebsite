import { describe, expect, test } from "bun:test";
import { SITE } from "../scripts/site";
import { CSP } from "../src/http";
import worker from "../src/worker";
import { call, ENV, PAGES } from "./helpers";

describe("worker", () => {
  test("www redirects to the bare domain", async () => {
    const res = await worker.fetch(new Request("https://www.alexandermorgan.dev/blog?x=1"), ENV);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://alexandermorgan.dev/blog?x=1");
  });

  test("trailing slashes and /index redirect to the canonical URL", async () => {
    for (const [from, to] of [["/blog/", "/blog"], ["/blog/some-post//", "/blog/some-post"], ["/index", "/"]]) {
      const res = await call(from!);
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe(to!);
    }
  });

  test("security headers on every response", async () => {
    for (const path of [...PAGES, "/nope", "/blog/"]) {
      const res = await call(path);
      expect(res.headers.get("content-security-policy")).toBe(CSP);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    }
    expect(CSP).toContain("script-src 'self'");
    expect(CSP).not.toContain("unsafe");
  });

  test("only GET and HEAD", async () => {
    expect((await call("/", { method: "POST" })).status).toBe(405);
    const head = await call("/projects", { method: "HEAD" });
    expect(head.status).toBe(200);
  });

  test("files starting with _ are never URLs", async () => {
    for (const path of ["/_layout", "/_not-found", "/_pages/index.html", "/blog/_x"]) {
      expect((await call(path)).status).toBe(404);
    }
  });

  test("sitemap lists every page", async () => {
    const xml = await (await call("/sitemap.xml")).text();
    expect(xml.match(/<loc>/g)).toHaveLength(PAGES.length);
    for (const path of PAGES) expect(xml).toContain(`<loc>${SITE}${path}</loc>`);
  });
});
