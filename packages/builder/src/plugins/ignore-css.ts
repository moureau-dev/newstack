import type { PluginBuild } from "esbuild";

/**
 * @description
 * Ignores CSS imports during the build process.
 * This is used in server builds to prevent CSS files from being bundled,
 * as CSS is only needed in the client bundle.
 *
 * When a CSS import is encountered:
 * - The import is resolved to a virtual "ignored-css" namespace
 * - An empty module is returned, effectively removing the CSS from the bundle
 *
 * @example
 * // In server.ts
 * import "./styles.css"; // This import will be ignored in server build
 *
 * @param build The esbuild plugin build object
 */
export function IgnoreCss(build: PluginBuild): void {
  build.onResolve({ filter: /\.css$/ }, () => ({
    path: "ignored-css",
    namespace: "ignore-css",
  }));

  build.onLoad({ filter: /.*/, namespace: "ignore-css" }, () => ({
    contents: "",
  }));
}
