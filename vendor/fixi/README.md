# Vendored fixi.js

[fixi.js](https://github.com/bigskysoftware/fixi) v0.9.4 (0BSD, see LICENSE.md), cut down to the
features this site uses. `fixi.upstream.js` is the unmodified release, kept for reference and for the test
that checks the cut. It is not shipped.

`fixi.js` was made **only by deleting code** from `fixi.upstream.js`: nothing was added, reordered or
rewritten. `test/fixi.test.ts` checks this: every line of `fixi.js` must be the matching upstream line with
characters removed, in the same order.

## What the site uses

One element, `<body>` in `pages/layout.html`:

```html
<body fx-action="/" fx-trigger="site:navigate" fx-target="#main">
```

`client/site.js` dispatches `site:navigate` on `<body>` for same-site link clicks and back/forward, and listens
for `fx:config` (to set the URL and replace any navigation in flight), `fx:after` (to fall back to a full page
load on a server error), `fx:error` (likewise, for network errors) and `fx:swapped` (to update the history,
title and navbar).

## What was removed

| Upstream feature | Why it isn't needed |
| --- | --- |
| `MutationObserver` (`document.__fixi_mo`) and the `fx:process` event | Only `<body>` has `fx-action`, and it's there at `DOMContentLoaded`. Swapped-in content has no `fx-*` attributes. |
| Processing descendants of the processed element | Same: only `<body>` is processed. |
| `fx-ignore` | Nothing to ignore. |
| `fx-method`, form data and query-string building | Every request is a plain `GET` with no parameters (`fetch`'s default method). |
| `fx-swap` and swap strategies other than `outerHTML` (`innerHTML`, `beforebegin`/`afterend`…, swap functions, `none`) | `<main>` is always replaced whole. |
| Default `fx-trigger` per element type | The trigger is always given. |
| Default target (the element itself) | The target is always given. |
| `window.fixiCfg` defaults (swap, transition, headers) | Not used. |
| View Transitions around swaps | Navigation swaps instantly, like hypermediajobs.com. (The theme switch uses the View Transitions API directly in `client/site.js`.) |
| `cfg.confirm`, `cfg.preventTrigger`, `cfg.fetch` (mocking) | Not used. |
| `fx:init`, `fx:inited`, `fx:before`, `fx:finally` events, and `swapped` on `document` | No listeners. |
| `composed` events (crossing shadow DOM) | No shadow DOM. |
| Re-initialisation guard (`elt.__fixi` already set) | Initialisation runs once. |

To use `fx-*` attributes anywhere else, restore the corresponding pieces from `fixi.upstream.js`.
