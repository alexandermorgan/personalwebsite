// The RSS feed at /feed.xml: blog posts (in full) and projects.

import { projects } from "./content";
import { escape } from "./html";
import { posts } from "./posts";

const TITLE = "Alexander Morgan";
const DESCRIPTION = "Blog posts and projects from Alexander Morgan.";

/** "2026-10-03" -> "Sat, 03 Oct 2026 00:00:00 GMT" */
function rfc822(date: string): string {
  return new Date(`${date}T00:00:00Z`).toUTCString();
}

/** Post bodies link within the site with root-relative URLs; feed readers need absolute ones. */
function absolute(html: string, origin: string): string {
  return html.replace(/\s(href|src)="\/(?!\/)/g, ` $1="${origin}/`);
}

function cdata(text: string): string {
  return `<![CDATA[${text.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

export function feed(origin: string): string {
  const postItems = posts.map(
    (p) => `    <item>
      <title>${escape(p.title)}</title>
      <link>${origin}/blog/${p.slug}</link>
      <guid isPermaLink="true">${origin}/blog/${p.slug}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <category>Blog</category>
      <description>${escape(p.summary)}</description>
      <content:encoded>${cdata(absolute(p.body.value, origin))}</content:encoded>
    </item>`,
  );
  const projectItems = projects.map(
    (p) => `    <item>
      <title>${escape(p.title)}</title>
      <link>${escape(p.url)}</link>
      <guid isPermaLink="true">${escape(p.url)}</guid>${p.added ? `\n      <pubDate>${rfc822(p.added)}</pubDate>` : ""}
      <category>Projects</category>
      <description>${escape(p.description)}</description>
    </item>`,
  );
  const latest = [...posts.map((p) => p.date), ...projects.flatMap((p) => (p.added ? [p.added] : []))].sort().at(-1);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${TITLE}</title>
    <link>${origin}/</link>
    <description>${DESCRIPTION}</description>
    <language>en</language>${latest ? `\n    <lastBuildDate>${rfc822(latest)}</lastBuildDate>` : ""}
    <atom:link href="${origin}/feed.xml" rel="self" type="application/rss+xml"/>
${[...postItems, ...projectItems].join("\n")}
  </channel>
</rss>
`;
}
