import { describe, expect, test } from "bun:test";
import { projects, publications, recommendations } from "../src/content";
import { posts } from "../src/posts";
import { anchors, attr, call, ORIGIN, PAGES } from "./helpers";

describe("pages", () => {
  test("every page is a full document with the header, theme switch, fixi and footer", async () => {
    for (const path of PAGES) {
      const res = await call(path);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(res.headers.get("vary")).toBe("fx-request");
      const body = await res.text();
      expect(body).toStartWith("<!doctype html>");
      expect(body).toContain('<html lang="en" data-theme="dark">');
      expect(body).toContain('<body fx-action="/" fx-trigger="site:navigate" fx-target="#main">');
      expect(body).toContain('<header class="site-header">');
      expect(body).toContain('role="switch"');
      expect(body).toContain('<script src="/assets/site.js"></script>');
      expect(body).toContain('<script src="/assets/fixi.js" defer></script>');
      expect(body).toContain('<main id="main" class="container" tabindex="-1" data-title="');
      expect(body).toContain('<footer class="site-footer">');
      expect(body.match(/<h1[ >]/g)).toHaveLength(1);
    }
  });

  test("titles, descriptions and canonical URLs", async () => {
    const home = await (await call("/")).text();
    expect(home).toContain("<title>Alexander Morgan</title>");
    expect(home).toContain(`<link rel="canonical" href="${ORIGIN}/">`);
    const post = await (await call(`/blog/${posts[0]!.slug}`)).text();
    expect(post).toContain(`<title>${posts[0]!.title} · Alexander Morgan</title>`);
    expect(post).toContain('<meta property="og:type" content="article">');
    expect(post).toContain(`<meta name="description" content="${posts[0]!.summary}">`);
  });

  test("the navbar marks the current section", async () => {
    const projects = await (await call("/projects")).text();
    expect(projects).toContain('<a href="/projects" aria-current="page">Projects</a>');
    expect(projects).toContain('<a href="/blog">Blog</a>');
    const post = await (await call(`/blog/${posts[0]!.slug}`)).text();
    expect(post).toContain('<a href="/blog" aria-current="true">Blog</a>');
    const home = await (await call("/")).text();
    expect(home).not.toContain("aria-current");
  });

  test("a card for every project, publication and recommendation, in order", async () => {
    for (const [path, items] of [["/projects", projects], ["/publications", publications], ["/recommendations", recommendations]] as const) {
      const body = await (await call(path)).text();
      const titles = [...body.matchAll(/<h2 class="tile-title">(.*?)<\/h2>/g)].map((m) => m[1]);
      expect(titles).toEqual(items.map((t) => t.title.replaceAll("'", "&#39;")));
      expect(body.match(/<details class="tile-details">/g)).toHaveLength(items.length);
      expect(body.match(/<summary class="tile-tab">Description<\/summary>/g)).toHaveLength(items.length);
    }
  });

  test("cards link to the project from the face and the Link tab", async () => {
    const body = await (await call("/projects")).text();
    for (const p of projects) {
      const links = anchors(body).filter((a) => attr(a, "href") === p.url);
      expect(links.map((a) => attr(a, "class"))).toEqual(["tile-face", "tile-tab tile-link"]);
    }
  });

  test("card images exist and have fixed dimensions", async () => {
    for (const t of [...projects, ...recommendations, ...publications]) {
      if (!("image" in t.art)) continue;
      expect(await Bun.file(`public${t.art.image}`).exists()).toBe(true);
    }
    const body = await (await call("/projects")).text();
    for (const img of body.match(/<img [^>]*>/g) ?? []) {
      expect(img).toContain('width="640" height="400"');
      expect(img).toContain('alt=""');
    }
  });

  test("the blog lists every post, newest first, with links to them", async () => {
    const body = await (await call("/blog")).text();
    const slugs = [...body.matchAll(/<h2><a href="\/blog\/([a-z0-9-]+)">/g)].map((m) => m[1]);
    expect(slugs).toEqual(posts.map((p) => p.slug));
    const dates = posts.map((p) => p.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(body).toContain(`<time datetime="${posts[0]!.date}">`);
  });

  test("posts have unique, URL-safe slugs and valid dates", () => {
    expect(new Set(posts.map((p) => p.slug)).size).toBe(posts.length);
    for (const p of posts) {
      expect(p.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(p.date))).toBe(false);
      expect(p.body.value).not.toContain("<h1");
    }
  });

  test("the CV page waits for CV_URL, then embeds /cv.pdf", async () => {
    expect(await (await call("/cv")).text()).toContain("My CV will be posted here soon.");
    expect((await call("/cv.pdf")).status).toBe(404);
    const body = await (await call("/cv", { env: { CV_URL: "https://example.r2.dev/cv.pdf" } })).text();
    expect(body).toContain('<iframe class="cv-frame" src="/cv.pdf"');
    expect(body).toContain('download="Alexander-Morgan-CV.pdf"');
  });

  test("missing pages are a real 404 with the site around them", async () => {
    for (const path of ["/nope", "/blog/nope", "/projects/x"]) {
      const res = await call(path);
      expect(res.status).toBe(404);
      expect(await res.text()).toContain("<h1>Not found</h1>");
    }
  });
});

describe("links", () => {
  test("every external link opens in a new tab", async () => {
    for (const path of [...PAGES, "/nope"]) {
      const body = await (await call(path)).text();
      for (const a of anchors(body)) {
        const href = attr(a, "href")!;
        const url = new URL(href, ORIGIN);
        if (url.origin === ORIGIN) continue;
        expect({ path, a, target: attr(a, "target"), rel: attr(a, "rel") }).toEqual({ path, a, target: "_blank", rel: "noopener" });
      }
    }
  });

  test("internal links open in place and lead somewhere", async () => {
    for (const path of [...PAGES, "/nope"]) {
      const body = await (await call(path)).text();
      for (const a of anchors(body)) {
        const url = new URL(attr(a, "href")!, ORIGIN);
        if (url.origin !== ORIGIN || url.pathname === "/cv.pdf") continue;
        expect({ a, target: attr(a, "target") }).toEqual({ a, target: null });
        const status = url.hash && url.pathname === "/" ? 200 : (await call(url.pathname)).status;
        expect({ path, href: url.pathname, status }).toEqual({ path, href: url.pathname, status: 200 });
      }
    }
  });
});

describe("HTML hygiene", () => {
  test("no inline styles or scripts (the CSP allows neither)", async () => {
    for (const path of [...PAGES, "/nope"]) {
      const body = await (await call(path)).text();
      expect(body).not.toMatch(/\sstyle="/);
      expect(body).not.toMatch(/<style[\s>]/);
      expect(body).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/);
      expect(body).not.toMatch(/\son[a-z]+="/);
    }
  });

  test("no unfilled placeholders", async () => {
    for (const path of [...PAGES, "/nope"]) {
      expect(await (await call(path)).text()).not.toContain("{{");
    }
  });
});
