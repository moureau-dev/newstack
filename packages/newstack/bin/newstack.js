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
  console.log("  build    Build server and client bundles");
  console.log("  start    Start development server");
  console.log("");
  process.exit(1);
}

switch (command) {
  case "build": {
    // SSG build mode
    const configPath = resolve(process.cwd(), "esbuild.config.ts");

    const esbuildArgs = [
      "--bundle",
      "--platform=node",
      "--format=esm",
      "--external:esbuild",
      "--external:@swc/core",
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
      process.exit(code || 0);
    });
    break;
  }

  case "start": {
    const serverPath = resolve(process.cwd(), "dist/server.js");
    const node = spawn("node", [serverPath], {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    node.on("close", (code) => {
      process.exit(code || 0);
    });

    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
