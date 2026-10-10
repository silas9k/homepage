import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let loginAssets;

// Dashboard bundles contain private host labels. Publish only the build's login
// dependencies, including fonts referenced by its shared stylesheet.
export function publicLoginAsset(path) {
  if (!path.startsWith("/_next/static/")) return false;
  if (process.env.NODE_ENV !== "production") return true;
  if (!loginAssets) {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), ".next/build-manifest.json"), "utf8"));
    const files = [
      ...(manifest.pages["/_app"] || []),
      ...(manifest.pages["/auth/signin"] || []),
      ...(manifest.pages["/_error"] || []),
      ...(manifest.polyfillFiles || []),
      ...(manifest.lowPriorityFiles || []),
    ];
    const assets = new Set(files.map((file) => `/_next/${file}`));
    for (const file of files.filter((name) => name.endsWith(".css"))) {
      const css = readFileSync(resolve(process.cwd(), ".next", file), "utf8");
      for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        const url = new URL(match[1], `http://localhost/_next/${file}`);
        if (url.origin === "http://localhost" && url.pathname.startsWith("/_next/static/media/")) assets.add(url.pathname);
      }
    }
    loginAssets = assets;
  }
  return loginAssets.has(path);
}
