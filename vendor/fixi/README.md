# Vendored fixi.js

[fixi.js](https://github.com/bigskysoftware/fixi) v0.9.4 (0BSD, see LICENSE.md), cut down to the
features this site uses, plus one addition. `fixi.upstream.js` is the unmodified release, kept for reference
and for the test that checks the cut. It is not shipped.

`fixi.js` was made by **deleting code** from `fixi.upstream.js`, and adding one block marked
`// [added]` … `// [/added]` (see below). Outside that block nothing was added, reordered or rewritten.
`test/fixi.test.ts` checks this: with the marked block taken out, every line of `fixi.js` must be the
matching upstream line with characters removed, in the same order.

## What was added

The swap. Upstream sets the target's `outerHTML` (or another `fx-swap` strategy) to the response. Here the
response is a page file, which starts with its `<title>` and `<meta name="description">`: fixi parses it in a
`<template>`, sets `document.title` and the document's description from those two (only top-level ones, so an
SVG `<title>` in the content is left alone), and replaces the target's children with the rest.

## What the site uses

One element, `<body>` in `pages/_layout.html`:

```html
<body fx-action="/" fx-trigger="site:navigate" fx-target="#main">
```

`client/site.js` dispatches `site:navigate` on `<body>` for same-site link clicks and back/forward, and listens
for `fx:config` (to set the URL and replace any navigation in flight), `fx:after` (to fall back to a full page
load when the response isn't a page), `fx:error` (likewise, for network errors) and `fx:swapped` (to update the
history, navbar, scroll position and focus).

## What was removed

| Upstream feature | Why it isn't needed |
| --- | --- |
| `MutationObserver` (`document.__fixi_mo`) and the `fx:process` event | Only `<body>` has `fx-action`, and it's there at `DOMContentLoaded`. Swapped-in content has no `fx-*` attributes. |
| Processing descendants of the processed element | Same: only `<body>` is processed. |
| `fx-ignore` | Nothing to ignore. |
| `fx-method`, form data and query-string building | Every request is a plain `GET` with no parameters (`fetch`'s default method). |
| `fx-swap`, `cfg.swap` and every swap strategy (`outerHTML`, `innerHTML`, `beforebegin`/`afterend`…, swap functions, `none`) | Replaced by the added page swap: `<main>`'s content is always replaced whole. |
| Default `fx-trigger` per element type | The trigger is always given. |
| Default target (the element itself) | The target is always given. |
| `window.fixiCfg` defaults (swap, transition, headers) | Not used. |
| View Transitions around swaps | Navigation swaps instantly, like hypermediajobs.com. (The theme switch uses the View Transitions API directly in `client/site.js`.) |
| `cfg.confirm`, `cfg.preventTrigger`, `cfg.fetch` (mocking) | Not used. |
| `fx:init`, `fx:inited`, `fx:before`, `fx:finally` events, and `swapped` on `document` | No listeners. |
| `composed` events (crossing shadow DOM) | No shadow DOM. |
| Re-initialisation guard (`elt.__fixi` already set) | Initialisation runs once. |

To use `fx-*` attributes anywhere else, restore the corresponding pieces from `fixi.upstream.js`.
