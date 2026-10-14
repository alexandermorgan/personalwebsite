# AGENTS.md

Rules for working on this site. `README.md` explains how it works.

## Tooling

- Use `bun` and `bunx` for every command, never npm or npx.
- `bun run check` (typecheck + tests) must pass. After changing how pages are assembled, also check them under
  `bun run preview`: tests run on Bun's `HTMLRewriter`, production on workerd's, and they differ (workerd's
  `element.attributes` throws if an attribute changes mid-loop; `transform(string)` is Bun-only).
- No new packages. Dev dependencies are only `wrangler`, `typescript` and `@types/bun`; there are none at runtime.
  Third-party code that ships is vendored with its license, and only the parts in use.

## HTML

- **Content and markup live only in `pages/*.html`.** TypeScript never builds HTML strings or holds content as
  data. A list of three things is three `<li>`s in the file. The only markup written in code is the feed and
  sitemap XML in `scripts/site.ts`.
- **One file per URL**: `/projects` is `pages/projects.html`, `/blog/<slug>` is `pages/blog/<slug>.html`. There
  is no route list. Files starting with `_` are never URLs (`_layout.html`, `_not-found.html`, `_post-item.html`).
- **A page file starts with `<title>`, then `<meta name="description">`, then its content.** Nothing
  page-specific goes in `_layout.html`. A blog post's content is an `<article>` with the title in `<h1>` and
  `<time datetime="YYYY-MM-DD">`; the blog index, feed and sitemap read those.
- **Don't edit the post list in `pages/blog.html` by hand.** It's regenerated from `pages/blog/` by the
  pre-commit hook and `bun run dev`; edit `pages/_post-item.html` or the posts.
- Use semantic elements (`<article>`, `<section>`, `<nav>`, `<time>`, `<details>`, `<a>` vs `<button>`).
- External links have `target="_blank" rel="noopener"` (tested).
- Code moves HTML around only with `HTMLRewriter`, never string concatenation or regex. Its setters escape
  (except `&` in attribute values); insert markup with `{ html: true }` only when it's a whole file or part of one.

## Behavior

- Every page must work without JavaScript. With it, `client/site.js` and the cut-down fixi load pages in place
  into `<main>`.
- The worker answers GET and HEAD, plus the one form: `POST /contact` (`src/contact.ts`). Forms are real
  `<form method="post">` with full page loads. Error messages are written in the page with `hidden`; the
  worker unhides them.
- **fixi** (`vendor/fixi/fixi.js`) is upstream with code deleted, plus one block between `// [added]` and
  `// [/added]`. A test enforces this. To use a removed feature, restore its lines from `fixi.upstream.js`,
  and update `vendor/fixi/README.md`.
- **Client JS** is fixi plus `client/site.js`. Prefer HTML and CSS; add to `site.js` only when they can't do it.
  No second script and no client build step.
- **CSP** (`src/http.ts`): no inline scripts or styles, no third-party scripts. Don't loosen it.
- **Storage**: none. Bindings are `ASSETS` and `EMAIL` only. Large files live in a public R2 bucket and are
  linked directly.

## CSS

- Plain CSS only, no Tailwind or preprocessors.
- Every shared value is a token in `styles/tokens.css`, defined for both themes. Don't hard-code values.
- Basecoat components are vendored in `vendor/basecoat/` as plain CSS, and only the ones in use. Follow their
  markup conventions. To add one, see `vendor/basecoat/README.md` and add it to `CSS_FILES` in
  `scripts/site.ts`.
- No web fonts and no layout shift: every image and card has a fixed size.
