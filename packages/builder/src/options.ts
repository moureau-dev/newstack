import type { BuildOptions } from "esbuild";

import { SplitBundle, NewstackPlugin } from "./plugins";

/**
 * @description
 * Build options for the server-side application.
 * It bundles the application, sets the entry point, output directory,
 *
 * @type {BuildOptions}
 */
export const server: BuildOptions = {
  bundle: true,
  entryPoints: ["server.ts"],
  outdir: "dist",
  plugins: [NewstackPlugin("server")],
  platform: "node",
  format: "esm",
  target: "node12",
  jsxFactory: "h",
  inject: ["@newstack/jsx"],
};

/**
 * Build options for the client-side application.
 * This configuration is tailored for browser environments and includes plugins for splitting bundles and applying Newstack-specific transformations.
 *
 * @type {BuildOptions}
 */
export const client: BuildOptions = {
  bundle: true,
  entryPoints: ["client.ts"],
  chunkNames: "client-[name]-[hash]",
  outdir: "dist",
  plugins: [SplitBundle(), NewstackPlugin("client")],
  platform: "browser",
  target: "esnext",
  format: "esm",
  jsxFactory: "h",
  inject: ["@newstack/jsx"],
};
