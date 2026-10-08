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

/**
 * HTML for a page: the full document, or (for in-page navigation) just the page
 * file. Both vary on FX-Request, so a cache never serves one for the other.
 */
export function page(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", vary: "fx-request" },
  });
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
