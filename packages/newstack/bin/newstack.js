#!/usr/bin/env node

import { spawn } from "child_process";
import { resolve } from "path";

const args = process.argv.slice(2);
const command = args[0];

// Parse flags
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
  console.log("  start             Start development server");
  console.log("  start --mode=spa  Start SPA dev server (no SSR)");
  console.log("");
  process.exit(1);
}

switch (command) {
  case "build": {
    const mode = flags.mode || "ssr";
    const onComplete = mode === "ssg" ? runSsg : mode === "spa" ? runSpa : null;
    build(onComplete);
    break;
  }

  case "start": {
    const mode = flags.mode || "ssr";
    if (mode === "spa") build(runSpaDev);
    else buildWatch(runWatch);
    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}

function build(onComplete) {
  const configPath = resolve(process.cwd(), "esbuild.config.ts");

  const esbuildArgs = [
    "--bundle",
    "--platform=node",
    "--format=esm",
    "--packages=external",
    configPath,
  ];

  const esbuild = spawn("esbuild", esbuildArgs, {
    stdio: ["inherit", "pipe", "inherit"],
    cwd: process.cwd(),
  });

  const node = spawn("node", [], {
    stdio: ["pipe", "inherit", "inherit"],
    cwd: process.cwd(),
  });

  esbuild.stdout.pipe(node.stdin);

  esbuild.on("error", (err) => {
    console.error("Failed to start esbuild:", err);
    process.exit(1);
  });

  node.on("error", (err) => {
    console.error("Failed to start node:", err);
    process.exit(1);
  });

  node.on("close", (code) => {
    if (code !== 0) process.exit(code);
    if (onComplete) onComplete();
    else process.exit(0);
  });
}

/**
 * Runs esbuild.config.ts in watch mode (NEWSTACK_WATCH=true).
 * Waits for the sentinel "__NEWSTACK_WATCH_READY__" on stdout before
 * calling onReady(), which starts the dev server. Installs SIGINT/SIGTERM
 * handlers so both the config runner and server process are cleaned up.
 */
function buildWatch(onReady) {
  const configPath = resolve(process.cwd(), "esbuild.config.ts");

  const esbuild = spawn(
    "esbuild",
    ["--bundle", "--platform=node", "--format=esm", "--packages=external", configPath],
    { stdio: ["inherit", "pipe", "inherit"], cwd: process.cwd() },
  );

  const configRunner = spawn("node", [], {
    stdio: ["pipe", "pipe", "inherit"],
    cwd: process.cwd(),
    env: { ...process.env, NEWSTACK_WATCH: "true" },
  });

  esbuild.stdout.pipe(configRunner.stdin);

  let serverProcess = null;
  let started = false;

  configRunner.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    // Forward everything except the internal sentinel line
    const visible = text.replace("__NEWSTACK_WATCH_READY__\n", "");
    if (visible) process.stdout.write(visible);

    if (!started && text.includes("__NEWSTACK_WATCH_READY__")) {
      started = true;
      serverProcess = onReady();
    }
  });

  const cleanup = () => {
    configRunner.kill("SIGTERM");
    if (serverProcess) serverProcess.kill("SIGTERM");
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  configRunner.on("exit", (code) => {
    if (code && code !== 0) {
      if (serverProcess) serverProcess.kill("SIGTERM");
      process.exit(code);
    }
  });

  esbuild.on("error", (err) => {
    console.error("Failed to start esbuild:", err);
    process.exit(1);
  });
}

function runWatch() {
  const serverPath = resolve(process.cwd(), "dist/server.js");
  const node = spawn("node", [serverPath], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env, NEWSTACK_WATCH: "true" },
  });
  // Don't exit the CLI when the server exits in watch mode — let cleanup() handle it
  return node;
}

function runSsg() {
  const serverPath = resolve(process.cwd(), "dist/server.js");
  const node = spawn("node", [serverPath], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env, NEWSTACK_SSG: "true" },
  });

  node.on("close", (code) => {
    process.exit(code || 0);
  });
}

function runSpa() {
  const serverPath = resolve(process.cwd(), "dist/server.js");
  const node = spawn("node", [serverPath], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env, NEWSTACK_SPA: "true" },
  });

  node.on("close", (code) => {
    process.exit(code || 0);
  });
}

function runSpaDev() {
  const serverPath = resolve(process.cwd(), "dist/server.js");
  const node = spawn("node", [serverPath], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env, NEWSTACK_SPA_DEV: "true" },
  });

  node.on("close", (code) => {
    process.exit(code || 0);
  });
}
