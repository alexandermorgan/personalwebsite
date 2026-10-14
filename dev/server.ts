// Local development server: runs the worker under Bun.
//   bun run dev            -> http://localhost:8787
// The static files (pages, CSS, JS, feed, sitemap) are made afresh on every
// request, so edits show up on reload; `bun --watch` restarts the server when
// the worker's code changes.
// Adding, renaming or editing a post in pages/blog/ updates pages/blog.html.
// Contact form messages are printed rather than emailed.

import { watch } from "node:fs";
import { join } from "node:path";
import { assetsBinding, site, updateBlogIndex } from "../scripts/site";
import worker, { type Env } from "../src/worker";

const updateBlog = () => updateBlogIndex().then((changed) => changed && console.log("updated pages/blog.html"), console.error);
await updateBlog();
watch(join(import.meta.dir, "../pages/blog"), updateBlog);

const PORT = Number(process.env.PORT ?? 8787);
const env: Env = {
  ASSETS: assetsBinding(() => site()),
  // Contact form messages are printed instead of sent. Set TYPESAFE_API_KEY (in .env) to vet them with Jev.
  EMAIL: { send: async (message) => console.log("email", message) },
  EMAIL_FROM: "contact@alexandermorgan.dev",
  CONTACT_EMAIL: "alexanderpmorgan@gmail.com",
  TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY,
};

Bun.serve({ port: PORT, fetch: (request) => worker.fetch(request, env) });
console.log(`alexandermorgan.dev dev server on http://localhost:${PORT}`);
