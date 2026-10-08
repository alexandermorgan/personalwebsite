// Response headers (the CSP and other security headers) and the small helpers
// the worker builds its responses with.

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  // Cards show each site's own og:image.
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "frame-src 'none'",
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

const PAGE_HEADERS = { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", vary: "fx-request" };

/**
 * HTML for a page: the full document, or (for in-page navigation) just the page
 * file. Both vary on FX-Request, so a cache never serves one for the other.
 * Browsers revalidate every time (no-cache) with the page's ETag (see etag()).
 */
export function page(body: string, status = 200, etag?: string): Response {
  return new Response(body, { status, headers: etag ? { ...PAGE_HEADERS, etag } : PAGE_HEADERS });
}

/** A page the browser already has: the same build made it. */
export function notModified(etag: string): Response {
  return new Response(null, { status: 304, headers: { ...PAGE_HEADERS, etag } });
}

/**
 * A page's ETag: the build's version (a hash of everything pages are made from,
 * see scripts/site.ts) and which of the two responses it is. Weak, since
 * Cloudflare makes strong ETags weak when it compresses a response.
 */
export function etag(request: Request, version: string): string {
  return `W/"${version}-${isNavigation(request) ? "fx" : "full"}"`;
}

/** Whether the request's If-None-Match lists this ETag, compared weakly as the spec says. */
export function isFresh(request: Request, etag: string): boolean {
  const header = request.headers.get("if-none-match");
  if (header === null) return false;
  const opaque = (tag: string) => tag.trim().replace(/^W\//, "");
  return header.split(",").some((tag) => tag.trim() === "*" || opaque(tag) === opaque(etag));
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
