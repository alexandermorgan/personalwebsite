// Brings the list of posts in pages/blog.html up to date with pages/blog/.
// Run by the pre-commit hook (.githooks/pre-commit); the dev server does the
// same whenever pages/blog/ changes.
//   bun scripts/blog-index.ts

import { updateBlogIndex } from "./site";

if (await updateBlogIndex()) console.log("updated pages/blog.html");
