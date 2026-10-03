import type { Html } from "./html";

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  // The CV page embeds /cv.pdf.
  "frame-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy": CSP,
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
};

export function withSecurityHeaders(response: Response): Response {
  // Responses from fetch() have immutable headers.
  const res = new Response(response.body, response);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!res.headers.has(k)) res.headers.set(k, v);
  return res;
}

/**
 * HTML for a page route: the full document, or (for in-page navigation) just its
 * <main>. Both vary on FX-Request, so a cache never serves one for the other.
 */
export function page(body: Html, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  if (!headers.has("cache-control")) headers.set("cache-control", "no-cache");
  headers.set("vary", "fx-request");
  return new Response(body.toString(), { ...init, headers });
}

export function redirect(location: string, status = 301): Response {
  return new Response(null, { status, headers: { location } });
}

/**
 * A GET made by the site's own in-page navigation: fixi sends FX-Request. Anything
 * else, including arriving from another site, a bookmark or a reload, gets the
 * full document.
 */
export function isNavigation(request: Request): boolean {
  return request.headers.get("fx-request") === "true" && (request.method === "GET" || request.method === "HEAD");
}
