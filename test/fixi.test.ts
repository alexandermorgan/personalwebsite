import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const dir = join(import.meta.dir, "../vendor/fixi");
const upstream = await Bun.file(join(dir, "fixi.upstream.js")).text();
const vendored = await Bun.file(join(dir, "fixi.js")).text();
/** The code added for this site, between "// [added]" and "// [/added]". */
const ADDED = /^\t*\/\/ \[added\][^]*?^\t*\/\/ \[\/added\]\n/gm;
/** fixi.js without the site's additions: what must be upstream with code deleted. */
const trimmed = vendored.replace(ADDED, "");

/** Whether `small` can be made from `big` by deleting characters. */
function isSubsequence(small: string, big: string): boolean {
  let i = 0;
  for (const c of small) {
    i = big.indexOf(c, i);
    if (i < 0) return false;
    i++;
  }
  return true;
}

describe("vendored fixi", () => {
  test("apart from the marked additions, is upstream fixi with code only deleted: each line is an upstream line, in order, with characters removed", () => {
    const up = upstream.split("\n");
    let next = 0;
    for (const line of trimmed.split("\n")) {
      const at = up.findIndex((u, i) => i >= next && isSubsequence(line.trim(), u.trim()) && (line.trim() === "" || u.trim() !== ""));
      expect({ line, found: at >= 0 }).toEqual({ line, found: true });
      next = at + 1;
    }
  });

  test("keeps what the site uses", () => {
    for (const kept of ['"fx-action"', '"fx-target"', '"fx-trigger"', '"config"', '"after"', '"error"', '"swapped"', '"FX-Request":"true"', "abort"]) {
      expect(vendored).toContain(kept);
    }
  });
});
