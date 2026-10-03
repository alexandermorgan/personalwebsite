import { describe, expect, test } from "bun:test";
import { projects } from "../src/content";
import { posts } from "../src/posts";
import { call, ORIGIN } from "./helpers";

describe("/feed.xml", () => {
  test("is RSS with every blog post and project", async () => {
    const res = await call("/feed.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/rss+xml; charset=utf-8");
    const xml = await res.text();
    expect(xml).toStartWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"');
    expect(xml).toContain(`<atom:link href="${ORIGIN}/feed.xml" rel="self" type="application/rss+xml"/>`);
    expect(xml.match(/<item>/g)).toHaveLength(posts.length + projects.length);
    for (const p of posts) expect(xml).toContain(`<guid isPermaLink="true">${ORIGIN}/blog/${p.slug}</guid>`);
    for (const p of projects) expect(xml).toContain(`<guid isPermaLink="true">${p.url}</guid>`);
  });

  test("posts are in full, with links made absolute", async () => {
    const xml = await (await call("/feed.xml")).text();
    expect(xml).toContain("<content:encoded><![CDATA[");
    expect(xml).toContain(`<a href="${ORIGIN}/projects">`);
    expect(xml).not.toMatch(/href="\/[^/]/);
  });

  test("every page links to it for feed readers to find", async () => {
    const body = await (await call("/")).text();
    expect(body).toContain('<link rel="alternate" type="application/rss+xml" title="Alexander Morgan" href="/feed.xml">');
    expect(body).toContain('<a href="/feed.xml" type="application/rss+xml">RSS</a>');
  });
});
