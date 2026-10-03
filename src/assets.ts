// Static asset URLs. `bun run build` copies the assets to content-hashed file
// names (served with immutable caching) and injects the name mapping here.
// Unbuilt (tests, `bun run dev`) the plain /assets/<name> path is used.

declare const __ASSET_MANIFEST__: Record<string, string>;

const manifest: Record<string, string> = typeof __ASSET_MANIFEST__ === "undefined" ? {} : __ASSET_MANIFEST__;

export function asset(name: string): string {
  return manifest[name] ?? `/assets/${name}`;
}
