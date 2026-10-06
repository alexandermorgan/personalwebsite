import { afterEach, describe, expect, spyOn, test } from "bun:test";
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

describe("/cv.pdf", () => {
  let fetchSpy: ReturnType<typeof spyOn> | undefined;
  afterEach(() => fetchSpy?.mockRestore());

  test("is missing until CV_URL is set", async () => {
    expect((await call("/cv.pdf")).status).toBe(404);
  });

  test("streams the PDF from CV_URL, embeddable only by this site", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response("%PDF-1.7", { headers: { "content-type": "binary/octet-stream" } }));
    const res = await call("/cv.pdf", { env: { CV_URL: "https://example.r2.dev/cv.pdf" } });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.r2.dev/cv.pdf");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-security-policy")).toBe("frame-ancestors 'self'");
    expect(await res.text()).toBe("%PDF-1.7");
  });

  test("a failing upstream is a 502", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response("no", { status: 404 }));
    const errors = spyOn(console, "error").mockImplementation(() => {});
    const res = await call("/cv.pdf", { env: { CV_URL: "https://example.r2.dev/cv.pdf" } });
    errors.mockRestore();
    expect(res.status).toBe(502);
  });
});
