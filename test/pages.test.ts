import { describe, expect, test } from "bun:test";
import { anchors, attr, call, ORIGIN, PAGES, POSTS, tags } from "./helpers";

/** The <meta> or <link> start tag whose `key` attribute is `value`. */
function headTag(html: string, name: "meta" | "link", key: string, value: string): string {
  const tag = tags(html, name).find((t) => attr(t, key) === value);
  expect({ [key]: value, found: !!tag }).toEqual({ [key]: value, found: true });
  return tag!;
}

describe("pages", () => {
  test("every page is a full document", async () => {
    for (const path of PAGES) {
      const res = await call(path);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(res.headers.get("vary")).toBe("fx-request");
      const body = await res.text();
      expect(body).toStartWith("<!doctype html>");
      expect(tags(body, "main").filter((t) => attr(t, "id") === "main")).toHaveLength(1);
    }
  });

  test("every page has a title, a description and its own canonical URL; posts are articles", async () => {
    for (const path of PAGES) {
      const body = await (await call(path)).text();
      expect(body).toMatch(/<title>[^<]+<\/title>/);
      expect(attr(headTag(body, "meta", "name", "description"), "content")).toBeTruthy();
      expect(attr(headTag(body, "link", "rel", "canonical"), "href")).toBe(ORIGIN + path);
      expect(attr(headTag(body, "meta", "property", "og:type"), "content")).toBe(path.startsWith("/blog/") ? "article" : "website");
    }
  });

  test("the navbar marks the current section", async () => {
    for (const path of PAGES) {
      const nav = (await (await call(path)).text()).match(/<nav[\s\S]*?<\/nav>/)![0];
      for (const a of anchors(nav)) {
        const href = attr(a, "href")!;
        const expected = href === path ? "page" : path.startsWith(`${href}/`) ? "true" : null;
        expect({ path, href, current: attr(a, "aria-current") }).toEqual({ path, href, current: expected });
      }
    }
  });

  test("the blog links to every post, newest first, each with its date", async () => {
    const body = await (await call("/blog")).text();
    const listed = anchors(body).map((a) => attr(a, "href")!).filter((href) => POSTS.includes(href));
    expect([...listed].sort()).toEqual([...POSTS].sort());
    const dates = [];
    for (const path of listed) {
      const date = attr(tags(await (await call(path)).text(), "time")[0]!, "datetime")!;
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(body).toContain(`datetime="${date}"`);
      dates.push(date);
    }
    expect(dates).toEqual([...dates].sort().reverse());
  });

  test("missing pages are a real 404 with the site around them", async () => {
    for (const path of ["/nope", "/blog/nope", "/projects/x"]) {
      const res = await call(path);
      expect(res.status).toBe(404);
      const body = await res.text();
      expect(body).toStartWith("<!doctype html>");
      expect(tags(body, "main").filter((t) => attr(t, "id") === "main")).toHaveLength(1);
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
});
