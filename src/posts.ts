// Blog posts, newest first. Each post's body is plain HTML in posts/<slug>.html
// (no <h1>: the title comes from here), served at /blog/<slug>.
// To add a post: write posts/<slug>.html, import it below and add an entry.

import { Html } from "./html";

import buildingThisSite from "../posts/building-this-site-with-fixi.html" with { type: "text" };
import findingCadences from "../posts/teaching-computers-to-find-cadences.html" with { type: "text" };

export interface Post {
  slug: string;
  title: string;
  /** Publication date, YYYY-MM-DD. */
  date: string;
  /** One or two sentences for the blog index and link previews. */
  summary: string;
  body: Html;
}

// Bun's types describe .html imports as HTML bundles; with { type: "text" } they are strings.
const text = (source: unknown) => new Html(String(source));

export const posts: Post[] = [
  {
    slug: "building-this-site-with-fixi",
    title: "Building this site with fixi.js",
    date: "2026-10-03",
    summary: "Placeholder post: how this site is put together with server-rendered HTML, a cut-down fixi.js and one Cloudflare Worker.",
    body: text(buildingThisSite),
  },
  {
    slug: "teaching-computers-to-find-cadences",
    title: "Teaching computers to find cadences",
    date: "2026-09-26",
    summary: "Placeholder post: what it takes to detect Renaissance cadences automatically.",
    body: text(findingCadences),
  },
];

export function findPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}
