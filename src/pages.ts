// What goes into each template's placeholders. No markup here: that's in pages/.

import type { Tile } from "./content";
import { Html } from "./html";
import type { Post } from "./posts";
import { EMPTY, fill, fillEach } from "./templates";

/** The navbar's sections, in the order of pages/layout.html. */
export const SECTIONS = ["projects", "publications", "blog", "recommendations", "cv"] as const;

/**
 * aria-current for a navbar link: "page" on the section's own page, "true"
 * inside it (a blog post under Blog). client/site.js does the same after
 * in-page navigation.
 */
function current(section: string, path: string): Html {
  if (path === `/${section}`) return new Html(' aria-current="page"');
  if (path.startsWith(`/${section}/`)) return new Html(' aria-current="true"');
  return EMPTY;
}

export interface LayoutSlots {
  title: string;
  description: string;
  path: string;
  url: string;
  ogType: "website" | "article";
  assets: { css: string; site: string; fixi: string };
  main: Html;
}

export function layoutPage(s: LayoutSlots): Html {
  const nav = Object.fromEntries(SECTIONS.map((section) => [`current_${section}`, current(section, s.path)]));
  return fill("layout", {
    title: s.title,
    description: s.description,
    url: s.url,
    og_type: s.ogType,
    app_css: s.assets.css,
    site_js: s.assets.site,
    fixi_js: s.assets.fixi,
    year: new Date().getUTCFullYear(),
    ...nav,
    main: s.main,
  });
}

/** The page's <main>, which in-page navigation swaps. It carries the page title for the browser tab. */
export function mainElement(title: string, body: Html): Html {
  return fill("main", { title, main: body });
}

function tiles(items: Tile[]): Html {
  return fillEach("partials/tile", items, (t) => ({
    title: t.title,
    url: t.url,
    tagline: t.tagline,
    description: t.description,
    tone: t.tone,
    art: fill("partials/tile-art", {
      cover: t.art.cover,
      image: t.art.image ? fill("partials/tile-image", { src: t.art.image }) : EMPTY,
    }),
  }));
}

export function tilesPage(name: "projects" | "publications" | "recommendations", items: Tile[]): Html {
  return fill(name, { tiles: tiles(items) });
}

/** "2026-10-03" -> "October 3, 2026" */
export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function blogPage(posts: Post[]): Html {
  const items = posts.length
    ? fillEach("partials/post-item", posts, (p) => ({
        slug: p.slug,
        title: p.title,
        date: p.date,
        date_text: formatDate(p.date),
        summary: p.summary,
      }))
    : fill("partials/posts-empty");
  return fill("blog", { posts: items });
}

export function postPage(post: Post): Html {
  return fill("post", { title: post.title, date: post.date, date_text: formatDate(post.date), body: post.body });
}

export function cvPage(available: boolean): Html {
  return fill("cv", { cv: fill(available ? "partials/cv-ready" : "partials/cv-pending") });
}
