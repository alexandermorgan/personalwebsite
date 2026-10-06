// The site's static files, keyed by the path they're served at. The build
// writes them to dist/public; the dev server and the tests serve them from
// memory as the worker's ASSETS binding.
//
//   /_pages/...               the page files from pages/, read by the worker: the
//                             layout points at the assets, the blog index lists the posts
//   /assets/...               app.css (tokens, base styles, vendored Basecoat
//                             components and site styles, in order), site.js, fixi.js
//   /feed.xml, /sitemap.xml   made from pages/ (the feed has the posts and the project cards)
//   everything in public/
//
// Lists come from the folders: adding pages/blog/<slug>.html adds the post to
// the blog index, the feed and the sitemap.

import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const PAGES = join(ROOT, "pages");
const PUBLIC = join(ROOT, "public");

/** The site's address, for the feed and sitemap (pages use the request's). */
export const SITE = "https://alexandermorgan.dev";

export const CSS_FILES = [
  "styles/tokens.css",
  "styles/base.css",
  "vendor/basecoat/button.css",
  "vendor/basecoat/card.css",
  "vendor/basecoat/switch.css",
  "styles/app.css",
];

export interface File {
  body: string | Uint8Array<ArrayBuffer>;
  type: string;
}

/** A project card on /projects, as written in the HTML (so still escaped). */
interface Project {
  title: string;
  url: string;
  description: string;
}

interface Post {
  slug: string;
  /** As written in the file, so still HTML-escaped. */
  title: string;
  summary: string;
  /** YYYY-MM-DD, from <time datetime>. */
  date: string;
  dateText: string;
  /** The post's <article> without its header, for the feed. */
  body: string;
}

/** Every static file. `hashed` gives the assets content-hashed names, for the build. */
export async function site({ hashed = false } = {}): Promise<Map<string, File>> {
  const files = new Map<string, File>();
  for (const path of new Bun.Glob("**/*").scanSync({ cwd: PUBLIC, dot: true })) {
    const file = Bun.file(join(PUBLIC, path));
    files.set(`/${path}`, { body: await file.bytes(), type: file.type });
  }

  const urls: Record<string, string> = {};
  for (const [name, asset] of Object.entries(await assets())) {
    const url = `/assets/${hashed ? hashedName(name, asset.body as string) : name}`;
    urls[`/assets/${name}`] = url;
    files.set(url, asset);
  }

  const pages = new Map<string, string>();
  for (const path of [...new Bun.Glob("**/*.html").scanSync({ cwd: PAGES })].sort()) {
    pages.set(path.slice(0, -".html".length), await Bun.file(join(PAGES, path)).text());
  }
  const posts = await readPosts(pages);
  pages.set("_layout", await pointAtAssets(pages.get("_layout")!, urls));
  pages.set("blog", await listPosts(pages.get("blog")!, pages.get("_post-item")!, posts));
  for (const [name, html] of pages) files.set(`/_pages/${name}.html`, { body: html, type: "text/html; charset=utf-8" });

  const paths = [...pages.keys()].filter((name) => !name.split("/").some((part) => part.startsWith("_")));
  files.set("/feed.xml", { body: await feed(posts, await readProjects(pages.get("projects")!)), type: "application/rss+xml; charset=utf-8" });
  files.set("/sitemap.xml", { body: sitemap(paths.map((name) => (name === "home" ? "/" : `/${name}`))), type: "application/xml; charset=utf-8" });
  return files;
}

async function assets(): Promise<Record<string, File>> {
  const css = await Promise.all(CSS_FILES.map((f) => Bun.file(join(ROOT, f)).text()));
  const js = "text/javascript; charset=utf-8";
  return {
    "app.css": { body: css.join("\n"), type: "text/css; charset=utf-8" },
    "site.js": { body: await Bun.file(join(ROOT, "client/site.js")).text(), type: js },
    "fixi.js": { body: await Bun.file(join(ROOT, "vendor/fixi/fixi.js")).text(), type: js },
  };
}

/** "app.css" -> "app.1a2b3c4d5e.css" */
export function hashedName(name: string, body: string): string {
  const hash = new Bun.CryptoHasher("sha256").update(body).digest("hex").slice(0, 10);
  const dot = name.lastIndexOf(".");
  return `${name.slice(0, dot)}.${hash}${name.slice(dot)}`;
}

function rewrite(html: string, rewriter: HTMLRewriter): Promise<string> {
  return rewriter.transform(new Response(html)).text();
}

/** The layout's stylesheet and scripts, pointed at the (hashed) asset URLs. */
function pointAtAssets(layout: string, urls: Record<string, string>): Promise<string> {
  const point = (attribute: string) => ({
    element(element: HTMLRewriterTypes.Element) {
      const url = urls[element.getAttribute(attribute) ?? ""];
      if (url) element.setAttribute(attribute, url);
    },
  });
  return rewrite(layout, new HTMLRewriter().on("link[href]", point("href")).on("script[src]", point("src")));
}

/** Every post in pages/blog/, newest first, read from its <h1>, description and <time datetime>. */
async function readPosts(pages: Map<string, string>): Promise<Post[]> {
  const posts: Post[] = [];
  for (const [name, html] of pages) {
    if (!name.startsWith("blog/")) continue;
    const post: Post = { slug: name.slice("blog/".length), title: "", summary: "", date: "", dateText: "", body: "" };
    let inDate = false;
    post.body = await rewrite(
      html,
      new HTMLRewriter()
        .on("h1", { text: (t) => void (post.title += t.text) })
        .on('meta[name="description"]', { element: (e) => void (post.summary ||= e.getAttribute("content") ?? "") })
        .on("time[datetime]", {
          element(e) {
            if (post.date) return;
            post.date = e.getAttribute("datetime")!;
            inDate = true;
          },
          text(t) {
            if (!inDate) return;
            post.dateText += t.text;
            if (t.lastInTextNode) inDate = false;
          },
        })
        // The feed gets the article without the page's head or the post's header.
        .on("title, meta, article > header", { element: (e) => void e.remove() })
        .on("article, article > div", { element: (e) => void e.removeAndKeepContent() }),
    );
    if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date)) throw new Error(`pages/${name}.html: no <time datetime="YYYY-MM-DD">`);
    posts.push({ ...post, body: post.body.trim() });
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

/** The blog index, with one pages/_post-item.html per post in #posts. */
async function listPosts(blog: string, item: string, posts: Post[]): Promise<string> {
  if (!posts.length) return blog;
  const items = await Promise.all(
    posts.map((post) => {
      const fill = (apply: (element: HTMLRewriterTypes.Element) => void) => ({
        element(element: HTMLRewriterTypes.Element) {
          apply(element);
          element.removeAttribute("data-post");
        },
      });
      return rewrite(
        item,
        new HTMLRewriter()
          .on('[data-post="link"]', fill((e) => e.setAttribute("href", `/blog/${post.slug}`).setInnerContent(post.title, { html: true })))
          .on('[data-post="date"]', fill((e) => e.setAttribute("datetime", post.date).setInnerContent(post.dateText, { html: true })))
          .on('[data-post="summary"]', fill((e) => e.setInnerContent(post.summary, { html: true }))),
      );
    }),
  );
  return rewrite(blog, new HTMLRewriter().on("#posts", { element: (e) => void e.setInnerContent(`\n${items.join("")}`, { html: true }) }));
}

/** The cards in pages/projects.html: each .tile's .tile-title, .tile-face link and .tile-panel text. */
async function readProjects(html: string): Promise<Project[]> {
  const projects: Project[] = [];
  const card = () => projects.at(-1)!;
  await rewrite(
    html,
    new HTMLRewriter()
      .on(".tile", { element: () => void projects.push({ title: "", url: "", description: "" }) })
      .on(".tile-face", { element: (e) => void (card().url = e.getAttribute("href") ?? "") })
      .on(".tile-title", { text: (t) => void (card().title += t.text) })
      .on(".tile-panel", { text: (t) => void (card().description += t.text) }),
  );
  return projects.map((p) => ({ ...p, description: p.description.replace(/\s+/g, " ").trim() }));
}

/** "2026-10-03" -> "Sat, 03 Oct 2026 00:00:00 GMT" */
function rfc822(date: string): string {
  return new Date(`${date}T00:00:00Z`).toUTCString();
}

function cdata(text: string): string {
  return `<![CDATA[${text.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

/** Post bodies link within the site with root-relative URLs; feed readers need absolute ones. */
function absolute(html: string): Promise<string> {
  const absolutize = (attribute: string) => ({
    element(element: HTMLRewriterTypes.Element) {
      const url = element.getAttribute(attribute)!;
      if (url.startsWith("/") && !url.startsWith("//")) element.setAttribute(attribute, SITE + url);
    },
  });
  return rewrite(html, new HTMLRewriter().on("[href]", absolutize("href")).on("[src]", absolutize("src")));
}

/** A post in the feed. Its title and summary are already escaped, as written in the HTML. */
async function feedItem(post: Post): Promise<string> {
  const url = `${SITE}/blog/${post.slug}`;
  return `    <item>
      <title>${post.title}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rfc822(post.date)}</pubDate>
      <category>Blog</category>
      <description>${post.summary}</description>
      <content:encoded>${cdata(await absolute(post.body))}</content:encoded>
    </item>`;
}

/** A project in the feed, linking to the project itself. */
function projectItem(project: Project): string {
  return `    <item>
      <title>${project.title}</title>
      <link>${project.url}</link>
      <guid isPermaLink="true">${project.url}</guid>
      <category>Projects</category>
      <description>${project.description}</description>
    </item>`;
}

/** The RSS feed: every blog post, in full, then every project. */
async function feed(posts: Post[], projects: Project[]): Promise<string> {
  const items = [...(await Promise.all(posts.map(feedItem))), ...projects.map(projectItem)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Alexander Morgan</title>
    <link>${SITE}/</link>
    <description>Blog posts and projects from Alexander Morgan.</description>
    <language>en</language>${posts[0] ? `\n    <lastBuildDate>${rfc822(posts[0].date)}</lastBuildDate>` : ""}
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${items.join("\n")}
  </channel>
</rss>
`;
}

function sitemap(paths: string[]): string {
  const urls = paths.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** An ASSETS binding that serves these files like Workers Static Assets, for the dev server and the tests. */
export function assetsBinding(load: () => Promise<Map<string, File>>) {
  return {
    async fetch(input: Request | URL | string): Promise<Response> {
      const file = (await load()).get(new URL(input instanceof Request ? input.url : input).pathname);
      if (!file) return new Response("Not found", { status: 404 });
      return new Response(file.body, { headers: { "content-type": file.type, "cache-control": "no-cache" } });
    },
  };
}
