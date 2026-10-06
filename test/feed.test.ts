import { describe, expect, test } from "bun:test";
import { SITE } from "../scripts/site";
import { anchors, attr, call, FILES, PAGES, POSTS, tags } from "./helpers";

/** The projects: the sites the cards on /projects link to (each card links twice). */
const PROJECTS = [...new Set(anchors(FILES.get("/_pages/projects.html")!.body as string).map((a) => attr(a, "href")!))];

describe("/feed.xml", () => {
  test("is RSS with every blog post, in full, and every project", async () => {
    const res = await call("/feed.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/rss+xml; charset=utf-8");
    const xml = await res.text();
    expect(xml).toStartWith("<?xml");
    expect(xml).toContain("<rss");
    expect(PROJECTS.length).toBeGreaterThan(0);
    expect(xml.match(/<item>/g)).toHaveLength(POSTS.length + PROJECTS.length);
    expect(xml.match(/<content:encoded>/g)).toHaveLength(POSTS.length);
    for (const path of POSTS) expect(xml).toContain(`<guid isPermaLink="true">${SITE}${path}</guid>`);
    for (const url of PROJECTS) expect(xml).toContain(`<guid isPermaLink="true">${url}</guid>`);
  });

  test("links in posts are made absolute", async () => {
    expect(await (await call("/feed.xml")).text()).not.toMatch(/(href|src)="\/(?!\/)/);
  });

  test("every page links to it, for feed readers in <head> and for people in the page", async () => {
    for (const path of PAGES) {
      const body = await (await call(path)).text();
      const alternate = tags(body, "link").find((t) => attr(t, "rel") === "alternate" && attr(t, "type") === "application/rss+xml");
      expect(alternate && attr(alternate, "href")).toBe("/feed.xml");
      expect(anchors(body).some((a) => attr(a, "href") === "/feed.xml")).toBe(true);
    }
  });
});
