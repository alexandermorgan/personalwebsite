import { assetsBinding, site } from "../scripts/site";
import worker, { type Env } from "../src/worker";

export const ORIGIN = "https://alexandermorgan.test";

/** The static files, as the build makes them, and the worker's bindings serving them. */
export const FILES = await site();
export const ENV: Env = { ASSETS: assetsBinding(async () => FILES) };

export interface CallOptions {
  method?: string;
  /** Send FX-Request, as fixi does for in-page navigation. */
  fx?: boolean;
  ifNoneMatch?: string;
}

/** Send a request through the worker. */
export function call(path: string, opts: CallOptions = {}): Promise<Response> {
  const headers = new Headers();
  if (opts.fx) headers.set("fx-request", "true");
  if (opts.ifNoneMatch) headers.set("if-none-match", opts.ifNoneMatch);
  return worker.fetch(new Request(ORIGIN + path, { method: opts.method ?? "GET", headers }), ENV);
}

/** Every page's URL, from the page files: /_pages/blog/x.html is /blog/x, index.html is /. */
export const PAGES = [...FILES.keys()]
  .filter((path) => path.startsWith("/_pages/") && !path.includes("/_", "/_pages".length))
  .map((path) => path.slice("/_pages".length, -".html".length))
  .map((path) => (path === "/index" ? "/" : path));

/** The blog posts' URLs. */
export const POSTS = PAGES.filter((path) => path.startsWith("/blog/"));

export function decode(s: string): string {
  return s.replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

/** Every <a ...> start tag in some HTML. */
export function anchors(html: string): string[] {
  return tags(html, "a");
}

/** Every start tag with this name in some HTML. */
export function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\s[^>]*>`, "g")) ?? [];
}

export function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? decode(m[1]!) : null;
}
