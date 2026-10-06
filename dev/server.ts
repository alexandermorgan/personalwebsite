// Local development server: runs the worker under Bun.
//   bun run dev            -> http://localhost:8787
// The static files (pages, CSS, JS, feed, sitemap) are made afresh on every
// request, so edits show up on reload; `bun --watch` restarts the server when
// the worker's code changes. Set CV_URL to try /cv.pdf with a real PDF.
// Adding, renaming or editing a post in pages/blog/ updates pages/blog.html.

import { watch } from "node:fs";
import { join } from "node:path";
import { assetsBinding, site, updateBlogIndex } from "../scripts/site";
import worker from "../src/worker";

const updateBlog = () => updateBlogIndex().then((changed) => changed && console.log("updated pages/blog.html"), console.error);
await updateBlog();
watch(join(import.meta.dir, "../pages/blog"), updateBlog);

const PORT = Number(process.env.PORT ?? 8787);
const env = { ASSETS: assetsBinding(() => site()), CV_URL: process.env.CV_URL ?? "" };

Bun.serve({ port: PORT, fetch: (request) => worker.fetch(request, env) });
console.log(`alexandermorgan.dev dev server on http://localhost:${PORT}`);
