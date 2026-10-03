// HTML-safe strings. Markup itself lives in pages/*.html (see templates.ts);
// Html marks text that is already HTML so it isn't escaped again.

export class Html {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}
