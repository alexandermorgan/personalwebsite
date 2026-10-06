# AGENTS.md

Guidance for coding agents working on this personal website. `README.md` covers features, scripts and deployment;
this file covers how the site is built with HTML and the rules that keep it small.

## The idea

The server sends HTML and the browser shows it. There is no client-side rendering, no framework, no
templating language, and no runtime dependencies. One Cloudflare Worker (`src/worker.ts`) renders every page.
[fixi.js](https://github.com/bigskysoftware/fixi) (vendored and cut down in `vendor/fixi/`) adds in-place
navigation by fetching a page's `<main>` from the server and swapping it in. Every page still works as a
plain link without JavaScript.

Before adding anything, check whether HTML, CSS or an existing helper already does it. Usually one does.

## How HTML is produced

**Content and markup live only in `.html` files.** TypeScript never builds HTML strings, and content is not
kept as data in TypeScript or JSON to be turned into markup. A project card, a publication or a paragraph
about me is written as HTML in the page that shows it.

- `pages/*.html`: one file per page (`home.html`, `projects.html`, `publications.html`, …), with everything
  that page shows. There are no partials.
- `posts/<slug>.html`: the body of each blog post. `src/posts.ts` lists the posts (slug, title, date,
  summary), because the blog index, the post page, the RSS feed and the sitemap all need that list.
- `pages/layout.html`: the document around every page: `<head>`, header, footer. `pages/main.html` is the
  `<main id="main" data-title="…">` that in-place navigation returns; it carries the page title, since only
  `<main>` is swapped.

TypeScript only supplies values that vary per request (the path, the year, asset URLs, whether the CV is
available) or that come from a list used in more than one place (the posts).

**Templates are plain HTML, filled by HTMLRewriter.** There are no conditionals, loops or filters in
expressions, and no template language. The first time a response uses a template, `HTMLRewriter` reads it
once and marks where values go; from then on, filling it is only joining strings, with no parser calls.
What gets filled:

| In the template | Gets |
| --- | --- |
| `<time data-fill="date">` | its content set to the value |
| `<slot name="page"></slot>` | replaced by the value: text, `Html`, or a part (the page inside the layout) |
| `<p data-if="summary">` | kept only when the value is truthy; what's inside needs no values otherwise |
| `<li data-each="posts">` | repeated once per item of the list, each filled from that item's values |
| `href="/blog/{{slug}}"` | the value inside the attribute; a whole-value `{{x}}` is left out when `false`, empty when `true` |
| `.nav-links a` | `aria-current="page"` when its `href` is the page's `path`, `"true"` when the path is inside it (a post under `/blog`) |

Indentation in templates is for reading them and isn't sent (so never indent inside `<pre>` or `<textarea>`).

The TypeScript decides *which* template to use and *what* values go in:

- `src/pages.ts`: one function per page that needs values, returning a `part(template, values)`. Lists are
  arrays of values for `data-each`. It contains no markup and renders nothing.
- `src/templates.ts`: compiles templates when first used, and provides `part()` and `fill()`. Each response
  calls `fill()` once.
- `src/html.ts`: `escape()` and the `Html` wrapper.

Rules that filling enforces:

- Every value a rendered element uses must be given; a missing one throws instead of rendering blank. Each
  `data-each` item sees only its own values.
- Strings and numbers are always HTML-escaped, in text and attributes. Only `Html` values (a post body, a
  filled part) are inserted as is. Don't build an `Html` from a string by hand to get around escaping.

**Bun and workerd differ.** Tests run on Bun's `HTMLRewriter` and production on workerd's. For example,
workerd's `element.attributes` is a live iterator that throws if an attribute changes mid-loop, which Bun
allows. After changing how templates are compiled, check pages under `bun run preview` too, not just
`bun test`. Don't use Bun-only overloads such as `transform(string)` in `src/`.

**Adding a page:** create the `.html` file, add its import and its entry in `src/templates.ts`, add the route
in `src/worker.ts` (and to the sitemap there), and add the path to `PAGES` in `test/helpers.ts` so the
page-wide tests cover it. A page in the navbar also needs its link in `pages/layout.html`. Pages with fixed
content (home, projects, publications, recommendations, not-found) have nothing to fill.

## One route, two responses

Each URL serves both a full document and an in-place update, from the same handler:

- **Direct load** (bookmark, reload, other site, no JS): `render()` in `src/worker.ts` wraps the body in
  `layout.html` and returns the full document.
- **In-page navigation** (`FX-Request: true` on a GET, see `isNavigation()` in `src/http.ts`): `render()`
  returns only the filled `main.html`, which fixi swaps in for `<main id="main">`. It must be exactly the
  full page's `<main>` (a test checks this).

Both have the page's real status (a missing page is a 404 either way) and `Vary: FX-Request`, so a cache
never serves one for the other.

`<body fx-action="/" fx-trigger="site:navigate" fx-target="#main">` in `pages/layout.html` is the only fixi
element. A click on a same-site link goes through `site.link()` in `client/site.js`, which decides whether to
load it in place (other sites, modifier clicks, `target`, `download`, files like `/cv.pdf` and anchors on the
same page are left to the browser) and then dispatches `site:navigate` on `<body>`. Back/forward does the
same. On `fx:swapped`, `site.js` updates the URL (after any redirect), the title from `data-title`, the
navbar's `aria-current`, the scroll position and focus. A response that isn't a `<main id="main"`, or a
network error, falls back to a full page load. Add `data-reload` to a link that must always load the full
page.

Handlers call `render()` (or `redirect()`) and don't check request headers themselves. Redirects work in
place too: `fetch` follows them and `site.js` shows the final URL.

The worker answers only GET and HEAD. There are no forms. If one is ever needed, it is a real
`<form method="post" action="…">` that works without JavaScript; handling it in place means restoring fixi's
form support (see below), not writing new client code.

Keep the request counts low: a page load is one HTML response plus three cached assets (`app.css`, `site.js`,
`fixi.js`) and any card images, and an in-page navigation is one request.

## Keeping it minimal

**Dependencies.** None at runtime. Dev dependencies are only `wrangler`, `typescript` and `@types/bun`. Don't
add packages. Use the Workers runtime, Web APIs and Bun's built-ins (`bun:test`, `Bun.CryptoHasher`).
Third-party code that has to ship is vendored with its license, and only the parts in use.

**fixi.** `vendor/fixi/fixi.js` is `fixi.upstream.js` with code only deleted: nothing added, reordered or
rewritten. `test/fixi.test.ts` checks this, line by line. To use a removed feature (`fx-*` attributes on other
elements, form handling, other swap strategies, the MutationObserver for swapped-in `fx-*` elements), restore
those lines from `fixi.upstream.js` and update the table in `vendor/fixi/README.md`. Never edit `fixi.js`
otherwise.

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
  in `CSS_FILES` in `scripts/assets.ts`.
- `styles/base.css` and `styles/app.css` hold everything else.
- Everything is concatenated into one content-hashed `app.css`. No web fonts (system font stacks), and nothing
  that loads late or shifts the layout: every image and card has a fixed size.

**Theme.** `<html data-theme="dark">` by default. `site.js` is loaded render-blocking in `<head>` (it's tiny
and cached forever) so a saved theme applies before first paint. Style both themes through the tokens.

**Links.** External links always open in a new tab (`target="_blank" rel="noopener"`); a test checks every
page. Internal links are plain `<a href>` and must resolve (also tested).

**Build.** `scripts/build.ts` bundles the worker and writes hashed `app.css`, `site.js` and `fixi.js`,
served `immutable` (`public/_headers`). Only `src/` ships. `test/build.test.ts` checks that no `dev/` or
`test/` code ends up in the bundle and that the cut-down fixi ships, not the upstream copy.

**Storage.** None. Content lives in the repo and ships with the worker. The CV PDF lives in R2 and the worker
fetches it from its public URL (`CV_URL` in `wrangler.jsonc`) to serve it at `/cv.pdf`. Don't add D1, KV, R2
bindings, Durable Objects or queues until there's a concrete need.

**Code style.** Small modules with a header comment saying what each one is for, plain functions, and few
abstractions. Prefer deleting code to adding options. Match the comment density and naming of the
surrounding code. Accessibility comes from the HTML: real `<a>`, `<button>`, `<label>`, `<details>`,
`<time>`, the skip link, `aria-current`, and focus moved to `<main>` after in-place navigation.

## Where the code doesn't match this yet

The site predates these rules in places. When working near these, move toward the rules rather than
extending the old pattern:

- Cards on `/projects`, `/publications` and `/recommendations` are data in `src/content.ts`, filled into
  `pages/partials/*.html`. They belong as HTML in their pages. `src/feed.ts` also reads the projects from
  `src/content.ts`, so the feed will need another source.
- `src/templates.ts` fills `{{name}}` placeholders by string replacement, with partials and `fillEach()`,
  instead of compiling `data-fill`/`slot`/`data-if`/`data-each` templates with HTMLRewriter.
- The navbar's `aria-current` is passed in as `current_*` values from `src/pages.ts`.

## Checklist for a change

1. Content and markup changes go in `pages/` (or `posts/`), with any values from `src/pages.ts`.
2. The feature works with JavaScript disabled (links do full loads), and in place with it.
3. No new dependency, script, stylesheet, external origin or storage service.
4. New values use tokens in `styles/tokens.css`.
5. `bun run check` passes (typecheck + `bun:test`, under a second). Tests call the worker's `fetch` handler
   directly through `call()` in `test/helpers.ts` (`fx: true` for in-place navigation, `env` for `CV_URL`),
   so add a test in `test/` for new routes or templates.
6. To see it running: `bun run dev` → http://localhost:8787 (set `CV_URL` to try the CV page with a real PDF),
   and `bun run preview` to run the production build on workerd.
