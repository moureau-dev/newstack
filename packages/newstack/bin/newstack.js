#!/usr/bin/env node

import { spawn } from "child_process";
import { resolve } from "path";
import { mkdir } from "fs/promises";
import { pathToFileURL } from "url";
import { context as esbuildContext, build as esbuildBuild } from "esbuild";

const args = process.argv.slice(2);
const command = args[0];

const flags = {};
for (let i = 1; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--")) {
    const [key, value] = arg.slice(2).split("=");
    flags[key] = value || true;
  }
}

if (!command) {
  console.log("Usage: newstack <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  build             Build server and client bundles");
  console.log("  build --mode=ssg  Build and generate static HTML pages");
  console.log("  build --mode=spa  Build a client-only SPA");
  console.log("  start             Start development server with HMR");
  console.log("  start --mode=spa  Start SPA dev server (no SSR)");
  console.log("");
  process.exit(1);
}

switch (command) {
  case "build": {
    const mode = flags.mode || "ssr";
    await runBuild(mode);
    break;
  }

  case "start": {
    const mode = flags.mode || "ssr";
    if (mode === "spa") {
      await runBuild("spa-dev");
    } else {
      await runWatch();
    }
    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}

/**
 * Bundles the user's esbuild.config.ts to a temp .mjs file and imports it.
 * The config should export a default object with { server, client } build options.
 * Using packages:external so native add-ons (e.g. Tailwind's oxide) are never
 * bundled — they're loaded from node_modules at runtime by Node itself.
 */
async function loadConfig() {
  const configPath = resolve(process.cwd(), "esbuild.config.ts");
  const outFile = resolve(process.cwd(), "dist", ".newstack-config.mjs");

  await mkdir(resolve(process.cwd(), "dist"), { recursive: true });

  await esbuildBuild({
    entryPoints: [configPath],
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    outfile: outFile,
    write: true,
    logLevel: "silent",
  });

  const { default: config } = await import(pathToFileURL(outFile).href);
  return config;
}

/**
 * One-shot build: load config, create contexts, rebuild, dispose.
 */
async function buildOnce() {
  const config = await loadConfig();

  console.time("Time taken");
  console.log("Building server...");
  const serverCtx = await esbuildContext(config.server);
  await serverCtx.rebuild();
  await serverCtx.dispose();

  console.log("Building client...");
  const clientCtx = await esbuildContext(config.client);
  await clientCtx.rebuild();
  await clientCtx.dispose();

  console.log("Build completed successfully!");
  console.timeEnd("Time taken");
}

async function runBuild(mode) {
  await buildOnce();

  if (mode === "ssg") {
    spawnServer({ NEWSTACK_SSG: "true" });
  } else if (mode === "spa") {
    spawnServer({ NEWSTACK_SPA: "true" });
  } else if (mode === "spa-dev") {
    spawnServer({ NEWSTACK_SPA_DEV: "true" });
  } else {
    process.exit(0);
  }
}

/**
 * Watch mode: load config once, create contexts, start watching (which also
 * does the initial build), then spawn the dev server.
 *
 * The server context gets an onEnd plugin that restarts the server process
 * whenever dist/server.js is successfully rebuilt — keeping server and client
 * code in sync. The browser detects the dropped SSE connection and reloads.
 *
 * SIGINT/SIGTERM dispose both contexts and kill the server — no orphan watchers.
 */
async function runWatch() {
  const config = await loadConfig();

  let serverProcess = null;
  let initialized = false;

  const restartServer = () => {
    if (serverProcess) serverProcess.kill("SIGTERM");
    serverProcess = spawnServer({ NEWSTACK_WATCH: "true" }, false);
  };

  const serverCtx = await esbuildContext({
    ...config.server,
    plugins: [
      ...(config.server.plugins ?? []),
      {
        name: "newstack-server-restart",
        setup(build) {
          build.onEnd((result) => {
            // Skip the initial build (server not started yet) and failed builds.
            if (!initialized || result.errors.length > 0) return;
            console.log("↺  Server rebuilt, restarting...");
            restartServer();
          });
        },
      },
    ],
  });

  const clientCtx = await esbuildContext(config.client);

  // watch() resolves after the initial build completes, then keeps watching.
  await Promise.all([serverCtx.watch(), clientCtx.watch()]);

  initialized = true;
  restartServer();

  const cleanup = async () => {
    await Promise.all([serverCtx.dispose(), clientCtx.dispose()]);
    if (serverProcess) serverProcess.kill("SIGTERM");
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

/**
 * @param {Record<string, string>} env  Extra env vars passed to the server process.
 * @param {boolean} exitOnClose  If true, the CLI exits when the server process exits.
 *                               Set false in watch mode so restarts don't kill the CLI.
 */
function spawnServer(env = {}, exitOnClose = true) {
  const serverPath = resolve(process.cwd(), "dist/server.js");
  const proc = spawn("node", [serverPath], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env, ...env },
  });

  proc.on("error", (err) => {
    console.error("Failed to start server:", err);
    if (exitOnClose) process.exit(1);
  });

  proc.on("close", (code) => {
    if (exitOnClose) process.exit(code || 0);
  });

  return proc;
}
