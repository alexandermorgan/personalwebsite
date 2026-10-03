import { asset } from "./assets";
import { projects, publications, recommendations } from "./content";
import type { Env } from "./env";
import type { Html } from "./html";
import { isNavigation, page, redirect, withSecurityHeaders } from "./http";
import { blogPage, cvPage, layoutPage, mainElement, postPage, tilesPage } from "./pages";
import { findPost, posts } from "./posts";
import { fill } from "./templates";

const SITE_NAME = "Alexander Morgan";
const DESCRIPTION =
  "Alexander Morgan's website: projects, publications, writing and recommendations, on music theory, computational musicology, machine learning and the web.";

function pageTitle(title?: string): string {
  return title ? `${title} · ${SITE_NAME}` : SITE_NAME;
}

interface Ctx {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}

type Handler = (ctx: Ctx) => Promise<Response> | Response;

const routes: [pattern: RegExp, handler: Handler][] = [
  [/^\/$/, about],
  [/^\/projects$/, (ctx) => render(ctx, tilesPage("projects", projects), { title: "Projects" })],
  [/^\/publications$/, (ctx) => render(ctx, tilesPage("publications", publications), { title: "Publications" })],
  [
    /^\/recommendations$/,
    (ctx) => render(ctx, tilesPage("recommendations", recommendations), { title: "Recommendations" }),
  ],
  [/^\/blog$/, (ctx) => render(ctx, blogPage(posts), { title: "Blog" })],
  [/^\/blog\/(?<slug>[a-z0-9-]+)$/, post],
  [/^\/cv$/, (ctx) => render(ctx, cvPage(!!ctx.env.CV_URL), { title: "CV" })],
  [/^\/cv\.pdf$/, cvPdf],
  [/^\/sitemap\.xml$/, sitemap],
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // www is an alias: send it to the bare domain, keeping the path and query.
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.href, 301);
    }
    // One URL per page: /blog/ and /blog both work, but /blog is the real one.
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      return withSecurityHeaders(redirect(url.pathname.replace(/\/+$/, "") + url.search));
    }
    const ctx: Ctx = { request, env, url, params: {} };
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return withSecurityHeaders(new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } }));
      }
      for (const [pattern, handler] of routes) {
        const match = pattern.exec(url.pathname);
        if (match) return withSecurityHeaders(await handler({ ...ctx, params: match.groups ?? {} }));
      }
      return withSecurityHeaders(notFound(ctx));
    } catch (err) {
      console.error(err);
      return withSecurityHeaders(new Response("Something went wrong.", { status: 500 }));
    }
  },
};

interface RenderOptions {
  title?: string;
  description?: string;
  status?: number;
  ogType?: "website" | "article";
}

/**
 * A page: the whole document, or for in-page navigation only its <main> (which
 * fixi swaps in), leaving the header and footer alone. The status is the real one
 * either way, since fixi swaps whatever comes back.
 */
function render(ctx: Ctx, body: Html, opts: RenderOptions = {}): Response {
  const title = pageTitle(opts.title);
  const main = mainElement(title, body);
  if (isNavigation(ctx.request)) return page(main, { status: opts.status });
  const document = layoutPage({
    title,
    description: opts.description ?? DESCRIPTION,
    path: ctx.url.pathname,
    url: ctx.url.origin + ctx.url.pathname,
    ogType: opts.ogType ?? "website",
    assets: { css: asset("app.css"), site: asset("site.js"), fixi: asset("fixi.js") },
    main,
  });
  return page(document, { status: opts.status });
}

function notFound(ctx: Ctx): Response {
  return render(ctx, fill("not-found"), { title: "Not found", status: 404 });
}

function about(ctx: Ctx) {
  return render(ctx, fill("about"));
}

function post(ctx: Ctx) {
  const found = findPost(ctx.params.slug!);
  if (!found) return notFound(ctx);
  return render(ctx, postPage(found), { title: found.title, description: found.summary, ogType: "article" });
}

/** The CV PDF, fetched from CV_URL (in R2) so it's served from this site's own domain. */
async function cvPdf(ctx: Ctx) {
  if (!ctx.env.CV_URL) return notFound(ctx);
  const upstream = await fetch(ctx.env.CV_URL);
  if (!upstream.ok) {
    console.error(`CV_URL answered ${upstream.status}`);
    return new Response("The CV is unavailable right now.", { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="Alexander-Morgan-CV.pdf"',
      "cache-control": "public, max-age=3600",
      // Only framing matters for a PDF (the CV page embeds it); a page CSP can break browsers' PDF viewers.
      "content-security-policy": "frame-ancestors 'self'",
    },
  });
}

function sitemap(ctx: Ctx) {
  const paths = ["/", "/projects", "/publications", "/blog", ...posts.map((p) => `/blog/${p.slug}`), "/recommendations", "/cv"];
  const urls = paths.map((p) => `  <url><loc>${ctx.url.origin}${p}</loc></url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
