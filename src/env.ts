// The bindings and variables this worker uses (see wrangler.jsonc). Declaring
// only what we call keeps the code runnable and testable under Bun without
// @cloudflare/workers-types.

export interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS?: AssetFetcher;
  /** Where the CV PDF lives (e.g. a public R2 URL). Served at /cv.pdf. Empty until it's uploaded. */
  CV_URL?: string;
}
