import type { Env } from "../src/env";
import worker from "../src/worker";

export const ORIGIN = "https://alexandermorgan.test";

export interface CallOptions {
  method?: string;
  /** Send FX-Request, as fixi does for in-page navigation. */
  fx?: boolean;
  env?: Env;
}

/** Send a request through the worker. */
export function call(path: string, opts: CallOptions = {}): Promise<Response> {
  const headers = new Headers();
  if (opts.fx) headers.set("fx-request", "true");
  return worker.fetch(new Request(ORIGIN + path, { method: opts.method ?? "GET", headers }), opts.env ?? {});
}

/** Every page route, for tests that should hold on all of them. */
export const PAGES = [
  "/",
  "/projects",
  "/publications",
  "/recommendations",
  "/blog",
  "/blog/building-this-site-with-fixi",
  "/blog/teaching-computers-to-find-cadences",
  "/cv",
];

export function decode(s: string): string {
  return s.replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

/** Every <a ...> start tag in some HTML. */
export function anchors(html: string): string[] {
  return html.match(/<a\s[^>]*>/g) ?? [];
}

export function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? decode(m[1]!) : null;
}
