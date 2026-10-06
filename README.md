# alexandermorgan.dev

Alexander Morgan's personal website: an about page, projects, publications, a blog, recommendations, a CV and
an RSS feed.

One Cloudflare Worker serves everything, set up like [hypermediajobs.com](https://hypermediajobs.com):

| Piece | Used for |
| --- | --- |
| Worker `fetch` handler (`src/worker.ts`) | Server-rendered HTML and routing. No framework. |
| [fixi.js](https://github.com/bigskysoftware/fixi) v0.9.4 (vendored, cut down) | In-page navigation: swapping each page into `<main>`, with its title and description. |
| [Basecoat](https://basecoatui.com) (vendored components only) | The theme switch, buttons and cards, as plain CSS. |
| Static Assets | Hashed CSS/JS (cached forever), favicon, robots.txt. |
| R2 | The CV PDF, served at `/cv.pdf` through the worker. |

There are no runtime dependencies. Dev dependencies: `wrangler` (preview and deploy), `typescript` (typecheck)
and `@types/bun`.

## How it works

**Pages and navigation.** Every URL returns a complete server-rendered page when it is loaded directly:
arriving from another site, a bookmark, a reload, or a browser without JavaScript. Once a page has loaded,
clicks on same-site links load in place instead, so the header, navbar and footer never change:

- `<body fx-action="/" fx-trigger="site:navigate" fx-target="#main">` is the only fixi element.
  `client/site.js` decides whether a click is a plain same-site link (other sites, new-tab/modifier clicks,
  `target`, `download`, files like `/cv.pdf`, in-page anchors and links marked `data-reload` are left to the
  browser), cancels the browser navigation and dispatches `site:navigate` on `<body>`. Back/forward does the
  same.
- fixi fetches the page with its `FX-Request: true` header. The worker (`src/worker.ts`) then answers with
  the page's file as is: its `<title>`, `<meta name="description">` and content. fixi puts the first two into
  `<head>` and the content into `<main>`. The same URLs serve both, with the real status (a missing page is a
  404 either way) and `Vary: FX-Request`.
- On `fx:swapped`, `site.js` updates the URL (after any redirect), the
  navbar's `aria-current`, the scroll position (top, an `#anchor`, or where you were for back/forward) and moves
  focus to `<main>`. A response that isn't a page, or a network error, falls back to a full page load. A newer
  click cancels a navigation still in flight.

CSS and JS are content-hashed and served with `Cache-Control: immutable`; nothing renders late, no web font
loads, and every image and card has a fixed size, so there is no layout shift.

**fixi.** `vendor/fixi/fixi.js` is fixi with everything this site doesn't use deleted: no MutationObserver,
`fx:process`, `fx-ignore`, `fx-method`/form handling, swap strategies, `window.fixiCfg`, View Transitions, or the
events nobody listens to. The one addition, in a marked block, is the swap that puts a page's title and
description into `<head>` and the rest into `<main>`. See [`vendor/fixi/README.md`](vendor/fixi/README.md);
`test/fixi.test.ts` checks that everything outside the marked block is deletions only.

**Theme.** The switch and both color schemes are hypermediajobs.com's, with green (the wordmark) and brown
(the current page in the navbar) as accents: dark by default
(`<html data-theme="dark">`), sand in light mode. The switch stores the choice in `localStorage`; `site.js`, a
tiny script loaded before the page renders, applies it before first paint. Switching sweeps the new theme
across the page from the switch with a View Transition. The switch's look follows `data-theme`, so a saved
light theme shows correctly from the first paint.

**Cards.** `/projects`, `/publications` and `/recommendations` are lists of cards, written out in their page
files. A card's face
and its Link tab open the site in a new tab; its Description tab is a `<details>` whose description fills a
panel below the tabs, making the card exactly twice as tall (same width) and scrolling if the text is longer.
The open card lies over the cards below instead of pushing them down (a negative bottom margin keeps its grid
row the same height). Card sizes are variables on `.tiles` in `styles/app.css`; each card's color is a
`.tone-*` class.

Project and recommendation cards have a lettered cover in their color, and optionally an image over it: the
site's own `og:image` (or GitHub's card for a repository), linked from the site rather than copied here. It's
shown whole within the cover's fixed box, so it can't shift the layout, and if it fails to load the cover shows
instead. Publication cards instead show the title, then the venue and the original publication date
(`YYYY-MM-DD`, `YYYY-MM` or `YYYY`); their Description starts with the authors.

**Blog.** A post is a file, `pages/blog/<slug>.html`, served at `/blog/<slug>`: its `<title>` and
description (the summary), then an `<article>` with the title in `<h1>` and the date in
`<time datetime="YYYY-MM-DD">`. The build reads those to list the posts, newest first, on `/blog` (one
`pages/_post-item.html` each), in the feed and in the sitemap.

**CV.** Set `CV_URL` in `wrangler.jsonc` to the PDF's URL (e.g. its public R2 URL), and the worker serves it
at `/cv.pdf`. `/cv` (`pages/cv.html`) says the CV is coming soon; once it's uploaded, change the page to link
to and embed `/cv.pdf`.

**RSS.** `/feed.xml` has every blog post, in full, and every project card on `/projects` (its title, link and
description); `/sitemap.xml` has every page. Both are static files made by the build. Every page links to the
feed in `<head>` for autodiscovery and in the footer.

**Links.** External links always open in a new tab (`target="_blank" rel="noopener"`); a test checks every
page. The footer links to Twitter, GitHub, LinkedIn, Google Scholar and the RSS feed.

**Styling.** `styles/tokens.css` holds every shared value (both themes' colors, spacing, type, radii, sizes).
Only the Basecoat components in use are vendored into `vendor/basecoat/`, as plain CSS on those tokens.
`scripts/site.ts` concatenates everything into one `app.css`.

**HTML.** Every page is an `.html` file in `pages/`, at the path of its URL (`/` is `home.html`), with all of
its content written out. `pages/_layout.html` is the document around them; files starting with `_` are never
URLs. The worker puts a page into the layout with `HTMLRewriter` (its title, description and canonical and
Open Graph tags in `<head>`, its content in `<main>`, `aria-current` on the navbar), and there is no
client-side rendering. The CSP allows no inline scripts or styles (images may come from any https: site, for
the cards).

## Develop

```sh
bun install
bun run dev        # http://localhost:8787, runs the worker under Bun
```

To run the production build on workerd (Cloudflare's runtime), with Node.js 22 or newer (`nvm use`):

```sh
bun run preview    # builds and runs wrangler dev
```

## Editing content

| To change | Edit |
| --- | --- |
| The home page | `pages/home.html` |
| Projects, publications, recommendations | `pages/projects.html`, `pages/publications.html`, `pages/recommendations.html` |
| Blog posts | Add or edit `pages/blog/<slug>.html` |
| A new page | Add `pages/<name>.html` (and a navbar link in `pages/_layout.html`) |
| The CV | Upload the PDF to R2, set `CV_URL` in `wrangler.jsonc`, and update `pages/cv.html` |
| Header, footer (and its links) | `pages/_layout.html` |

## Scripts

| Script | What it does |
| --- | --- |
| `dev` | Develop locally on http://localhost:8787 under Bun. Restarts on code changes; pages, CSS and JS reload on refresh. |
| `preview` | Build and run the real Worker locally on workerd. |
| `test` | Run the tests in [`test/`](test). |
| `typecheck` | Check the TypeScript types. |
| `check` | Typecheck and test; GitHub CI runs the same on every push. |
| `build` | Build the Worker into `dist/` ([`scripts/build.ts`](scripts/build.ts)). `preview` and `deploy` build for you. |
| `deploy` | Deploy by hand. Usually not needed: Cloudflare deploys `main` on every push. |

## Test

```sh
bun test           # well under a second
bun run check      # typecheck + tests
```

The tests use only `bun:test` and call the worker's `fetch` handler directly, with the build's static files as
its assets: every page in `pages/` renders in full and in place, every internal link resolves, every external
link opens in a new tab, there are no inline scripts/styles, the blog, feed and sitemap list every post, the feed every project, the
cut-down fixi is deletions only (apart from its marked addition), and the build ships hashed assets.

## Deploy

One-time setup, in the Cloudflare dashboard:

1. Add `alexandermorgan.dev` to the Cloudflare account (buy or transfer it there).
2. Workers & Pages → Create → Import a repository → this repo. Production branch `main`, build command empty,
   deploy command `npx wrangler deploy` (it runs `bun scripts/build.ts` itself). From then on every push to
   `main` builds and deploys, like hypermediajobs.com.
3. Upload the CV PDF to an R2 bucket with public access and put its URL in `CV_URL`.

`wrangler.jsonc` routes `alexandermorgan.dev` and `www.alexandermorgan.dev` (redirected to the bare domain) to
the worker as custom domains, so the domain must be on the account before the first deploy.

## Layout

```
src/            the worker (the only code that ships)
  worker.ts     serves the page file for a URL, or the whole page assembled around it
  http.ts       security headers and response helpers
pages/          the site's HTML and content: one file per URL, blog/ for posts, _*.html to put them together
styles/         tokens, base and site CSS
vendor/         the cut-down fixi.js and the Basecoat components in use
public/         static files (_headers, favicon, robots.txt)
client/         site.js: theme and in-place navigation (shipped as a hashed asset)
scripts/        the static files (site.ts: pages, assets, blog index, feed, sitemap) and the build
dev/            the Bun dev server (not shipped)
test/           bun:test suites (not shipped)
```
