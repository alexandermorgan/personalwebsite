// The site's HTML lives in pages/*.html (page content) and pages/partials/*.html
// (repeated or optional pieces). Each file is plain HTML with {{name}}
// placeholders; fill() substitutes them. Values are HTML-escaped unless they are
// Html, i.e. another filled template. There is no logic in the templates.

import { escape, Html } from "./html";

import layout from "../pages/layout.html" with { type: "text" };
import main from "../pages/main.html" with { type: "text" };
import about from "../pages/about.html" with { type: "text" };
import projects from "../pages/projects.html" with { type: "text" };
import publications from "../pages/publications.html" with { type: "text" };
import recommendations from "../pages/recommendations.html" with { type: "text" };
import blog from "../pages/blog.html" with { type: "text" };
import post from "../pages/post.html" with { type: "text" };
import cv from "../pages/cv.html" with { type: "text" };
import notFound from "../pages/not-found.html" with { type: "text" };

import tile from "../pages/partials/tile.html" with { type: "text" };
import tileImage from "../pages/partials/tile-image.html" with { type: "text" };
import tileCover from "../pages/partials/tile-cover.html" with { type: "text" };
import postItem from "../pages/partials/post-item.html" with { type: "text" };
import postsEmpty from "../pages/partials/posts-empty.html" with { type: "text" };
import cvReady from "../pages/partials/cv-ready.html" with { type: "text" };
import cvPending from "../pages/partials/cv-pending.html" with { type: "text" };

const FILES = {
  layout,
  main,
  about,
  projects,
  publications,
  recommendations,
  blog,
  post,
  cv,
  "not-found": notFound,
  "partials/tile": tile,
  "partials/tile-image": tileImage,
  "partials/tile-cover": tileCover,
  "partials/post-item": postItem,
  "partials/posts-empty": postsEmpty,
  "partials/cv-ready": cvReady,
  "partials/cv-pending": cvPending,
};

// Bun's types describe .html imports as HTML bundles; with { type: "text" } they are strings.
export const TEMPLATES = FILES as unknown as Record<keyof typeof FILES, string>;

export type TemplateName = keyof typeof FILES;

export type SlotValue = Html | string | number;
export type Slots = Record<string, SlotValue>;

const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/** Fill a template's {{placeholders}}. Every placeholder must be given a value. */
export function fill(name: TemplateName, slots: Slots = {}): Html {
  const out = TEMPLATES[name].replace(PLACEHOLDER, (_: string, key: string) => {
    const value = slots[key];
    if (value === undefined) throw new Error(`template ${name}: no value for {{${key}}}`);
    return value instanceof Html ? value.value : escape(String(value));
  });
  return new Html(out.replace(/\n$/, ""));
}

/** Fill a template once per item and join the results. */
export function fillEach<T>(name: TemplateName, items: T[], slots: (item: T) => Slots): Html {
  return new Html(items.map((item) => fill(name, slots(item)).value).join("\n"));
}

/** Nothing: for an optional piece that isn't shown. */
export const EMPTY = new Html("");
