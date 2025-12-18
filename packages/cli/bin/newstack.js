#!/usr/bin/env node

import { spawn } from "child_process";
import { resolve } from "path";

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log("Usage: newstack <command>");
  console.log("");
  console.log("Commands:");
  console.log("  build    Build server and client bundles");
  console.log("  start    Start the production server");
  console.log("  dev      Start development server (coming soon)");
  process.exit(1);
}

switch (command) {
  case "build": {
    const configPath = resolve(process.cwd(), "esbuild.config.ts");

    const esbuildArgs = [
      "--bundle",
      "--platform=node",
      "--format=cjs",
      "--external:esbuild",
      "--external:@swc/*",
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
