// Every page is one file in pages/: /projects is pages/projects.html, / is
// index.html and /blog/<slug> is blog/<slug>.html. Each starts with its <title>
// and <meta name="description">, then its content. The build puts the files in
// the static assets under /_pages/, where the worker reads them.
//
// In-page navigation (fixi sends FX-Request) gets the file as is: fixi puts its
// title and description into <head> and the rest into <main>. Everything else
// gets the whole document, assembled around the file by assemble().
//
// Names starting with _ are never URLs: _layout.html and _not-found.html are
// only used by the worker itself.

import { etag, isFresh, isNavigation, notModified, page, redirect, withSecurityHeaders } from "./http";

/** The bindings and variables this worker uses (see wrangler.jsonc). */
export interface Env {
  ASSETS: { fetch(input: Request | URL | string): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // www is an alias: send it to the bare domain, keeping the path and query.
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.href, 301);
    }
    const path = url.pathname;
    // One URL per page: /blog/ and /blog both work, but /blog is the real one.
    if (path.length > 1 && path.endsWith("/")) return withSecurityHeaders(redirect(path.replace(/\/+$/, "") + url.search));
    if (path === "/index") return withSecurityHeaders(redirect("/" + url.search));
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return withSecurityHeaders(new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } }));
      }
      if (path.split("/").some((segment) => segment.startsWith("_"))) return withSecurityHeaders(await notFound(request, env));
      // A page the browser got from this build is unchanged, so there's nothing to
      // read or assemble. Only pages get these ETags, so it's one this URL had.
      const tag = etag(request, await readVersion(env, url));
      if (isFresh(request, tag)) return withSecurityHeaders(notModified(tag));
      const file = await readPage(env, url, path === "/" ? "index" : path.slice(1));
      if (file !== null) return withSecurityHeaders(await respond(request, env, file, 200, tag));
      // Any other static file (feed.xml, robots.txt, ...). On Cloudflare these are
      // served before the worker runs; under Bun (dev, tests) they come through here.
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) return withSecurityHeaders(asset);
      return withSecurityHeaders(await notFound(request, env));
    } catch (err) {
      console.error(err);
      return withSecurityHeaders(new Response("Something went wrong.", { status: 500 }));
    }
  },
};

/** A page's file, or null if there's no such page. */
async function readPage(env: Env, url: URL, name: string): Promise<string | null> {
  // Paths with a file extension are static files, not pages.
  if (name.split("/").pop()!.includes(".")) return null;
  const response = await env.ASSETS.fetch(new URL(`/_pages/${name}.html`, url));
  return response.ok ? response.text() : null;
}

/** A file the worker uses itself, such as _layout; it must exist. */
async function readOwnPage(env: Env, url: URL, name: string): Promise<string> {
  const file = await readPage(env, url, name);
  if (file === null) throw new Error(`missing pages/${name}.html`);
  return file;
}

/** The build's version, from /_pages/_version.txt (see scripts/site.ts). */
async function readVersion(env: Env, url: URL): Promise<string> {
  const response = await env.ASSETS.fetch(new URL("/_pages/_version.txt", url));
  if (!response.ok) throw new Error("missing /_pages/_version.txt");
  return (await response.text()).trim();
}

async function notFound(request: Request, env: Env): Promise<Response> {
  return respond(request, env, await readOwnPage(env, new URL(request.url), "_not-found"), 404);
}

/** The page file for in-page navigation, otherwise the whole document. The status is the real one either way. */
async function respond(request: Request, env: Env, file: string, status = 200, etag?: string): Promise<Response> {
  return page(isNavigation(request) ? file : await assemble(env, new URL(request.url), file), status, etag);
}

/**
 * The whole document: pages/_layout.html with the page's title and description
 * in <head> (and in its canonical and Open Graph tags), the rest of the page
 * file in <main>, and the navbar link to the current section marked with
 * aria-current.
 */
async function assemble(env: Env, url: URL, file: string): Promise<string> {
  // The page's own <title> and description are the first ones in the file; any
  // later <title> (in an inline SVG, say) is content.
  let title: string | undefined;
  let description: string | undefined;
  let readingTitle = false;
  const content = await rewrite(
    file,
    new HTMLRewriter()
      .on("title", {
        element(element) {
          if (title !== undefined) return;
          title = "";
          readingTitle = true;
          element.remove();
        },
        text(text) {
          if (!readingTitle) return;
          title += text.text;
          if (text.lastInTextNode) readingTitle = false;
        },
      })
      .on('meta[name="description"]', {
        element(element) {
          if (description !== undefined) return;
          description = element.getAttribute("content") ?? "";
          element.remove();
        },
      }),
  );

  // HTMLRewriter gives text and attribute values as written (still escaped), and
  // setAttribute escapes only quotes, so they go back in unchanged.
  const path = url.pathname;
  const canonical = url.origin + path;
  const set = (name: string, value: string) => ({ element: (element: HTMLRewriterTypes.Element) => void element.setAttribute(name, value) });
  return rewrite(
    await readOwnPage(env, url, "_layout"),
    new HTMLRewriter()
      .on("title", { element: (element) => void element.setInnerContent(title ?? "", { html: true }) })
      .on('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', set("content", description ?? ""))
      .on('meta[property="og:title"], meta[name="twitter:title"]', set("content", title ?? ""))
      .on('link[rel="canonical"]', set("href", canonical))
      .on('meta[property="og:url"]', set("content", canonical))
      .on('meta[property="og:type"]', set("content", path.startsWith("/blog/") ? "article" : "website"))
      .on(".site-nav a[href]", {
        element(link) {
          const href = link.getAttribute("href")!;
          if (href === path) link.setAttribute("aria-current", "page");
          else if (path.startsWith(`${href}/`)) link.setAttribute("aria-current", "true");
        },
      })
      .on("main#main", { element: (element) => void element.setInnerContent(`\n${content.trim()}\n`, { html: true }) }),
  );
}

function rewrite(html: string, rewriter: HTMLRewriter): Promise<string> {
  return rewriter.transform(new Response(html)).text();
}
