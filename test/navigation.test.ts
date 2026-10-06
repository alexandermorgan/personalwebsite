import { describe, expect, test } from "bun:test";
import { call, decode, PAGES } from "./helpers";

/** A page's <title>, description and the content of its <main>, as one full load shows them. */
async function fullPage(path: string) {
  const html = await (await call(path)).text();
  return {
    title: decode(html.match(/<title>(.*?)<\/title>/)![1]!),
    description: decode(html.match(/<meta name="description" content="([^"]*)">/)![1]!),
    main: html.match(/<main id="main"[^>]*>\s*([\s\S]*?)\s*<\/main>/)![1]!,
  };
}

/** An in-place navigation response, split the way fixi splits it. */
function split(body: string) {
  const [, title, description, main] = body.match(/^<title>(.*?)<\/title>\s*<meta name="description" content="([^"]*)">\s*([\s\S]*?)\s*$/)!;
  return { title: decode(title!), description: decode(description!), main: main! };
}

describe("in-page navigation (fixi sends FX-Request)", () => {
  test("returns the page's title, description and content, not the document around them", async () => {
    for (const path of PAGES) {
      const res = await call(path, { fx: true });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(res.headers.get("vary")).toBe("fx-request");
      const body = await res.text();
      expect(body).toStartWith("<title>");
      expect(body).not.toMatch(/<(html|head|body|main|script)[\s>]/);
    }
  });

  test("they are exactly the full page's title, description and <main> content", async () => {
    for (const path of PAGES) {
      const fragment = split(await (await call(path, { fx: true })).text());
      expect(fragment).toEqual(await fullPage(path));
    }
  });

  test("missing pages come back in place with their real status", async () => {
    const res = await call("/nope", { fx: true });
    expect(res.status).toBe(404);
    expect(await res.text()).toStartWith("<title>");
  });
});
