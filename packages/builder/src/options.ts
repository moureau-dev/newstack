import type { BuildOptions } from "esbuild";
import { existsSync } from "fs";

import { SplitBundle, NewstackPlugin } from "./plugins";

const serverEntry = existsSync("server.ts") ? "server.ts" : "server.js";
const clientEntry = existsSync("client.ts") ? "client.ts" : "client.js";
const cssEntry = existsSync("src/styles.css") ? "src/styles.css" : null;

/**
 * @description
 * Build options for the server-side application.
 * It bundles the application, sets the entry point, output directory,
 *
 * @type {BuildOptions}
 */
export const server: BuildOptions = {
  bundle: true,
  entryPoints: [serverEntry],
  outdir: "dist",
  plugins: [NewstackPlugin("server")],
  platform: "node",
  format: "esm",
  target: "es2020",
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
  entryPoints: [clientEntry, cssEntry].filter(Boolean),
  entryNames: "client",
  chunkNames: "client-[name]-[hash]",
  outdir: "dist",
  plugins: [SplitBundle(), NewstackPlugin("client")],
  platform: "browser",
  target: "esnext",
  format: "esm",
  jsxFactory: "h",
  inject: ["@newstack/jsx"],
};
