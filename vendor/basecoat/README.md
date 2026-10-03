# Vendored Basecoat components

Only the [Basecoat](https://basecoatui.com) (v1.0.2, MIT, see LICENSE.md) components this site uses are
vendored here, ported from Tailwind `@apply` rules to plain CSS on the variables in `styles/tokens.css`
(the same ports hypermediajobs.com uses):

| File | Used for |
| --- | --- |
| `switch.css` | The theme switch in the header. |
| `button.css` | The CV page's buttons and the not-found page. |
| `card.css` | The base look of the project, publication and recommendation cards, and the blog list. |

Markup and class/attribute conventions match Basecoat's docs (`.btn[data-variant]`, `.card`,
`input.switch[role=switch]`). To add a component, port its rules from
`basecoat-css/dist/components/<name>.css`, then add the file to `CSS_FILES` in `scripts/assets.ts`.
