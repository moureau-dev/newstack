#!/usr/bin/env node

import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const projectName = args.find((a) => !a.startsWith("-")) || "my-newstack-app";
const withTailwind = args.includes("--tailwind") || args.includes("-tw");

console.log(`Creating a new Newstack app in ./${projectName}...`);
if (withTailwind) console.log("Including Tailwind CSS...");

async function createApp() {
  const projectPath = join(process.cwd(), projectName);

  // Create project directories
  await mkdir(projectPath, { recursive: true });
  await mkdir(join(projectPath, "src"), { recursive: true });
  await mkdir(join(projectPath, "public"), { recursive: true });

  // Create package.json
  const packageJson = {
    name: projectName,
    version: "0.0.1",
    type: "module",
    scripts: {
      start: "newstack start",
      build: "newstack build",
    },
    dependencies: {
      newstack: "^0.0.1",
      esbuild: "^0.25.5",
      "@swc/core": "^1.15.2",
      ...(withTailwind && {
        tailwindcss: "^4",
        "esbuild-plugin-tailwindcss": "^2",
      }),
    },
  };

  await writeFile(
    join(projectPath, "package.json"),
    JSON.stringify(packageJson, null, 2),
  );

  // Create tsconfig.json
  const tsconfig = {
    compilerOptions: {
      lib: ["es2017", "DOM"],
      strict: false,
      noImplicitAny: false,
      jsx: "preserve",
      skipLibCheck: true,
      downlevelIteration: true,
      module: "ESNext",
      moduleResolution: "bundler",
      esModuleInterop: true,
      typeRoots: ["./node_modules/@types", "./src/@types"],
    },
    exclude: ["node_modules"],
  };

  await writeFile(
    join(projectPath, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2),
  );

  // Create .env
  await writeFile(join(projectPath, ".env"), "# Environment variables\n");

  // Create README.md
  const readme = `# ${projectName}

A new Newstack application.

## Getting Started

Install dependencies:

\`\`\`bash
npm install
\`\`\`

Run the development server:

\`\`\`bash
npm start
\`\`\`

Build for production:

\`\`\`bash
npm run build
\`\`\`

## Learn More

Visit [Newstack documentation](https://github.com/moureau-dev/newstack) to learn more.
`;

  await writeFile(join(projectPath, "README.md"), readme);

  // Create .gitignore
  const gitignore = `node_modules/
dist/
.env.local
.DS_Store
`;

  await writeFile(join(projectPath, ".gitignore"), gitignore);

  // Create server.ts
  const serverTs = `/* ---------- External ---------- */
import { NewstackServer } from "newstack/server";

/* ---------- Entrypoint ---------- */
import { Application } from "./src/Application";

const app = new Application();
const server = new NewstackServer();
server.start(app);
`;

  await writeFile(join(projectPath, "server.ts"), serverTs);

  // Create client.ts
  const clientTs = `/* ---------- External ---------- */
import { NewstackClient } from "newstack";

/* ---------- Entrypoint ---------- */
import { Application } from "./src/Application";

const app = new Application();
new NewstackClient().start(app);
`;

  await writeFile(join(projectPath, "client.ts"), clientTs);

  // Create esbuild.config.ts
  const esbuildConfig = `/* ---------- External ---------- */
import { builder } from "newstack/builder";
${withTailwind ? `import tailwindPlugin from "esbuild-plugin-tailwindcss";\n` : ""}
export default {
  server: {
    ...builder.server,
  },
  client: {
    ...builder.client,${withTailwind ? "\n    plugins: [...builder.client.plugins, tailwindPlugin()]," : ""}
  },
};
`;

  await writeFile(join(projectPath, "esbuild.config.ts"), esbuildConfig);

  // Create src/Application.tsx
  const applicationTsx = `/* ---------- External ---------- */
import Newstack from "newstack";

/* ---------- Pages ---------- */
import { Home } from "./Home";

/* ---------- Styles ---------- */
import "./styles.css";

export class Application extends Newstack {
  render() {
    return (
      <div>
        <Home route="/" />
      </div>
    );
  }
}
`;

  await writeFile(join(projectPath, "src", "Application.tsx"), applicationTsx);

  // Create src/Home.tsx
  const homeTsx = `/* ---------- External ---------- */
import Newstack from "newstack";

/**
 * @description
 * This is the Home page of the Newstack example application.
 * It demonstrates a simple interactive component with a counter.
 */
export class Home extends Newstack {
  /* ---------- Proxies ---------- */
  count = 0;

  render() {
    return (
      <div class="home">
        <h1>Welcome to Newstack!</h1>
        <p>Get started by editing <code>src/Home.tsx</code></p>

        <button onclick={() => this.count++}>
          Count: {this.count}
        </button>
      </div>
    );
  }
}
`;

  await writeFile(join(projectPath, "src", "Home.tsx"), homeTsx);

  // Create src/styles.css
  const stylesCss = `${withTailwind ? `@import "tailwindcss";\n\n` : ""}body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen",
    "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue",
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, "Courier New",
    monospace;
  background: oklch(17.1% 0 0);
  padding: 2px 6px;
  border-radius: 3px;
}

.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
}

button {
  padding: 12px 24px;
  font-size: 16px;
  background: #0070f3;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  margin-top: 20px;
}

button:hover {
  background: #0051cc;
}
`;

  await writeFile(join(projectPath, "src", "styles.css"), stylesCss);

  console.log(`\n✅ Success! Created ${projectName} at ${projectPath}`);
  console.log("\nNext steps:");
  console.log(`  cd ${projectName}`);
  console.log("  bun install");
  console.log("  bun run start");
  console.log("\nHappy coding! 🚀");
}

createApp().catch((err) => {
  console.error("Error creating app:", err);
  process.exit(1);
});
