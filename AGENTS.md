# AGENTS.md

Guidance for coding agents working on this personal website. `README.md` covers features, scripts and deployment;
this file covers how the site is built with HTML and the rules that keep it small.

## The idea

The server sends HTML and the browser shows it. There is no client-side rendering, no framework, no
templating language, and no runtime dependencies. One Cloudflare Worker (`src/worker.ts`) serves every page.
[fixi.js](https://github.com/bigskysoftware/fixi) (vendored and cut down in `vendor/fixi/`) adds in-place
navigation by fetching a page and swapping it into `<main>`. Every page still works as a plain link without
JavaScript.

Before adding anything, check whether HTML, CSS or an existing helper already does it. Usually one does.

## Pages are files

**Content and markup live only in `.html` files.** TypeScript never builds HTML strings, and content is not
kept as data in TypeScript or JSON to be turned into markup. A project card, a publication or a paragraph
about me is written out as HTML in the page that shows it. A list of three things is three `<li>`s in the
file, not a loop.

**The HTML is semantic.** Use the element that says what the content is: `<article>` for a post or card,
`<section>` for a part of one (a post's body is `<section class="prose">`), `<header>`/`<footer>`, `<nav>`,
`<ul>`/`<ol>` for lists, `<time datetime>` for dates, `<details>`/`<summary>` for disclosure, `<a>` for
navigation and `<button>` for actions. Reach for `<div>` or `<span>` only for styling hooks with no meaning
of their own, and use classes for styling, not to stand in for the right element.

**One file per URL.** `/projects` is `pages/projects.html`, `/` is `pages/index.html`, and the post
`/blog/<slug>` is `pages/blog/<slug>.html`. There is no list of pages or routes anywhere: the build puts
the page files in the static assets under `/_pages/`, and the worker reads the one that matches the URL.
Files whose names start with `_` are never URLs (a request for any path with a segment starting with `_` is
a 404); they are only used to put pages together:

- `pages/_layout.html`: the document around every page: `<head>` with what is the same on every page
  (stylesheet, scripts, favicon, feed link), the header and navbar, an empty `<main id="main">`, the footer.
- `pages/_not-found.html`: the 404 page.
- `pages/_post-item.html`: one post in the blog index (see below).

**Each page file starts with its own head metadata**: its `<title>`, then `<meta name="description">`, then
its content:

```html
<title>Projects · Alexander Morgan</title>
<meta name="description" content="Websites, games and libraries I've built or worked on.">
<header class="page-header">
  <h1>Projects</h1>
  …
</header>
<ul class="tiles">
  <li class="card tile tone-green">…</li>
</ul>
```

Anything that differs from page to page goes at the top of the page file, never in `_layout.html`. The
layout's canonical link and Open Graph/Twitter tags are filled from the page's title, description and URL
(`og:type` is `article` under `/blog/`), so page files don't repeat them.

A blog post's file is the same, with its summary as the description and its content an `<article>` with the
title in `<h1>` and the date in `<time datetime="YYYY-MM-DD">`. Those three are what the blog index, the feed
and the sitemap read from it. Footnotes go in a `<footer class="footnotes">` after the post's
`<section class="prose">`, as an `<ol>` linked both ways with `<sup>` numbers in the text (see
`pages/blog/open-letter-to-mayor-mamdani.html`).

## One URL, two responses

Each URL serves both a full document and an in-place update:

- **Direct load** (bookmark, reload, other site, crawler, no JS): the worker assembles the page with
  `HTMLRewriter`: the page's `<title>` and description go into the layout's `<head>` (and its canonical and
  Open Graph tags), the rest of the file into `<main id="main">`, and the navbar link for the page gets
  `aria-current="page"` (`"true"` for a page inside a section, like a post under `/blog`).
- **In-page navigation** (`FX-Request: true` on a GET, see `isNavigation()` in `src/http.ts`): the worker
  sends the page file as is. fixi sets the document's title and description from the file's leading
  `<title>` and `<meta name="description">`, and swaps the rest into `<main>`.

Both have the page's real status (a missing page is `_not-found.html` with a 404 either way) and
`Vary: FX-Request`, so a cache never serves one for the other. A test checks that the in-place response and
the full page agree on the title, description and content.

`<body fx-action="/" fx-trigger="site:navigate" fx-target="#main">` in the layout is the only fixi element. A
click on a same-site link goes through `site.link()` in `client/site.js`, which decides whether to load it in
place (other sites, modifier clicks, `target`, `download`, files like `/cv.pdf` and anchors on the same page
are left to the browser) and then dispatches `site:navigate` on `<body>`. Back/forward does the same. On
`fx:swapped`, `site.js` updates the URL (after any redirect), the navbar's `aria-current`, the scroll
position and focus. A response that doesn't start with `<title>`, or a network error, falls back to a full
page load. Add `data-reload` to a link that must always load the full page.

Redirects work in place too: `fetch` follows them and `site.js` shows the final URL.

The worker answers only GET and HEAD. There are no forms. If one is ever needed, it is a real
`<form method="post" action="…">` that works without JavaScript; handling it in place means restoring fixi's
form support (see below), not writing new client code.

Keep the request counts low: a page load is one HTML response plus three cached assets (`app.css`, `site.js`,
`fixi.js`) and any card images, and an in-page navigation is one request.

## HTMLRewriter does the filling

The only HTML the code touches is moving parts of files into other files, and it does that with
`HTMLRewriter`, never with string concatenation or regular expressions. Set text and attributes with its
setters, which escape; insert markup (`{ html: true }`) only when it is a whole file or a part of one.

**Bun and workerd differ.** Tests run on Bun's `HTMLRewriter` and production on workerd's. For example,
workerd's `element.attributes` is a live iterator that throws if an attribute changes mid-loop, which Bun
allows. After changing how pages are assembled, check them under `bun run preview` too, not just `bun test`.
Don't use Bun-only overloads such as `transform(string)` in `src/`.

## Lists come from folders, at build time

Some things need a list: the blog index, `/feed.xml` (every post, in full, then every project) and
`/sitemap.xml` (every page). `scripts/site.ts` makes them from the files, and `scripts/build.ts`, which
Cloudflare runs on every push to `main` before deploying, writes them out, so adding a post is only adding
`pages/blog/<slug>.html`, and adding a project is only adding its card to `pages/projects.html`. It reads each
post's `<h1>`, description and `<time datetime>`, newest first, and each project card's `.tile-title`,
`.tile-face` link and `.tile-panel` description, in page order, and:

- fills `#posts` in `pages/blog.html` with one `pages/_post-item.html` per post, using `HTMLRewriter`
  (its `data-post` elements get the link, date and summary),
- writes `feed.xml` (each post's `<article>` without its `<header>` or `<section>` wrapper, links made
  absolute, then each project linking to the project itself) and `sitemap.xml` as static files. That XML is
  the only markup written in code.

The blog index is also kept up to date in `pages/blog.html` itself, so the committed file is the real
page with every post listed. `updateBlogIndex()` in `scripts/site.ts` rewrites it when it's out of date,
and runs from two places:

- the git pre-commit hook, `.githooks/pre-commit` (`bun install` sets `core.hooksPath` to `.githooks`), which
  runs `scripts/blog-index.ts` and stages `pages/blog.html` with the post, so every commit is in sync;
- `bun run dev`, whenever a file in `pages/blog/` changes, so the file updates as you write.

A test fails if the committed `pages/blog.html` is out of date, and the build fills the list the same way, so
a deploy is right even if the hook was skipped. Don't edit the list in `pages/blog.html` by hand; edit
`pages/_post-item.html` or the posts. The feed and sitemap aren't committed: `bun run dev` and the tests run
the same `scripts/site.ts`, so they always see the current folders.

## Keeping it minimal

**Dependencies.** None at runtime. Dev dependencies are only `wrangler`, `typescript` and `@types/bun`. Don't
add packages. Use the Workers runtime, Web APIs and Bun's built-ins (`bun:test`, `Bun.CryptoHasher`,
`Bun.Glob`). Third-party code that has to ship is vendored with its license, and only the parts in use.

**fixi.** `vendor/fixi/fixi.js` is `fixi.upstream.js` with code deleted, plus one addition between
`// [added]` and `// [/added]`: the swap that puts a page's `<title>` and description into `<head>` and the
rest into the target. `test/fixi.test.ts` checks, line by line, that everything outside the marked block is
upstream code with characters removed. To use a removed feature (`fx-*` attributes on other elements, form
handling, the MutationObserver for swapped-in `fx-*` elements), restore those lines from
`fixi.upstream.js`. Avoid further additions; if one is unavoidable, mark it the same way. Either way, update
`vendor/fixi/README.md`.

**JavaScript.** The client JS is the cut-down fixi plus `client/site.js` (theme, link interception, history
and scroll), about 160 lines. Reach for HTML and CSS first (a card's description is a `<details>`), then
`fx-*` attributes. Add to `site.js` only when neither will do, and keep the additions small. Don't add a
second script or a build step for client code. The CSP in `src/http.ts` allows scripts and styles only from
the site itself, so there are no inline `<script>` tags, inline styles or third-party scripts. Images may come
from any `https:` origin (the cards show each site's own `og:image`), and only `/cv.pdf` is framed. Don't
loosen it.

**CSS.** Plain CSS, no preprocessor or Tailwind anywhere.

- `styles/tokens.css` holds every shared value (both themes' colors, spacing, type, radii, sizes). Use the
  tokens and don't hard-code values.
- `vendor/basecoat/` contains only the Basecoat components in use (button, card, switch), ported from
  Tailwind `@apply` to plain CSS. Use their markup conventions (`.btn[data-variant]`,
  `.card > header/section/footer`, `.switch`, …). To add one, follow `vendor/basecoat/README.md` and list it
  in `CSS_FILES` in `scripts/site.ts`.
- `styles/base.css` and `styles/app.css` hold everything else.
- Everything is concatenated into one content-hashed `app.css`. No web fonts (system font stacks), and nothing
  that loads late or shifts the layout: every image and card has a fixed size.

**Theme.** `<html data-theme="dark">` by default. `site.js` is loaded render-blocking in `<head>` (it's tiny
and cached forever) so a saved theme applies before first paint. Style both themes through the tokens.

**Links.** External links always open in a new tab (`target="_blank" rel="noopener"`); a test checks every
page. Internal links are plain `<a href>` and must resolve (also tested).

**Build.** `scripts/build.ts` bundles the worker and writes every static file `scripts/site.ts` makes into
`dist/public`: `public/`, the page files, the lists above, and hashed `app.css`, `site.js` and `fixi.js`
(served `immutable`, see `public/_headers`) with the layout pointed at them. Only `src/` ships as code, and it
holds no content. `test/build.test.ts` checks that no `dev/` or `test/` code ends up in the bundle.

**Storage.** None. Content lives in the repo and ships with the worker. The CV PDF lives in R2 and the worker
fetches it from its public URL (`CV_URL` in `wrangler.jsonc`) to serve it at `/cv.pdf`. Don't add D1, KV, R2
bindings, Durable Objects or queues until there's a concrete need.

**Code style.** Small modules with a header comment saying what each one is for, plain functions, and few
abstractions. Prefer deleting code to adding options. Match the comment density and naming of the
surrounding code. Accessibility comes from the HTML: real `<a>`, `<button>`, `<label>`, `<details>`,
`<time>`, the skip link, `aria-current`, and focus moved to `<main>` after in-place navigation.

## Adding things

- **A page:** create `pages/<name>.html`, starting from another page's file. It's live at `/<name>`. To put
  it in the navbar, add a link to `pages/_layout.html`.
- **A blog post:** create `pages/blog/<slug>.html`. `pages/blog.html` lists it as soon as you save it under
  `bun run dev`, or when you commit; the feed and sitemap pick it up on the next build.
- **A project:** add its card to `pages/projects.html`, copying another card. The feed picks it up the same way.

## Checklist for a change

1. Content and markup changes go in `pages/`.
2. The feature works with JavaScript disabled (links do full loads), and in place with it.
3. No new dependency, script, stylesheet, external origin or storage service.
4. New values use tokens in `styles/tokens.css`.
5. `bun run check` passes (typecheck + `bun:test`, under a second). Tests call the worker's `fetch` handler
   directly through `call()` in `test/helpers.ts`, with the site's static files as its `ASSETS` (`fx: true`
   for in-place navigation, `env` for `CV_URL`). Page-wide tests run on every file in `pages/`, so a new page
   is covered without listing it.
6. To see it running: `bun run dev` → http://localhost:8787 (set `CV_URL` to try `/cv.pdf` with a real PDF),
   and `bun run preview` to run the production build on workerd.
