declare const __NEWSTACK_SETTINGS__: Record<string, string | number | boolean>;

/* ---------- Internal ---------- */
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";

/* ---------- External ---------- */
import { serve } from "@hono/node-server";
import { Hono } from "hono/tiny";

/* ---------- Framework ---------- */
import type {
  Newstack,
  NewstackClientContext,
  NewstackServerContext,
} from "./core";
import { Renderer } from "./renderer";
import { proxifyContext } from "./context";
import { HmrManager } from "./hmr";
import { BuildManager } from "./build";
import type { BuildOpts } from "./build";

/* ---------- Constants ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const files = new Map<PublicFile, string>();
const hash = randomUUID();

const SKIP_STATE_KEYS = new Set([
  "prepared",
  "hydrated",
  "__ctx",
  "__preparing",
  "__hydrating",
  "__node",
  "__hash",
]);

function serializeState(component: object): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(component)) {
    if (
      SKIP_STATE_KEYS.has(key) ||
      key.startsWith("__") ||
      typeof value === "function"
    )
      continue;
    result[key] = value;
  }
  return result;
}

const mimeTypes: Record<string, string> = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
};

function parseEnvFile(path: string): Record<string, string> {
  try {
    const result: Record<string, string> = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      )
        value = value.slice(1, -1);
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function loadFromEnv(prefix: string): Record<string, string> {
  const env = {
    ...parseEnvFile(resolve(process.cwd(), ".env")),
    ...parseEnvFile(resolve(process.cwd(), ".env.local")),
    ...process.env,
  };
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(prefix) || value === undefined) continue;
    const camel = key
      .slice(prefix.length)
      .toLowerCase()
      .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    result[camel] = value;
  }
  return result;
}

const context = proxifyContext({
  environment: "server",
  params: {},
  instances: new Proxy({} as Record<string, any>, {
    get: (t, k) => (k in t ? t[k as string] : {}),
  }),
  page: {} as NewstackClientContext["page"],
  project: {
    ...loadFromEnv("NEWSTACK_PROJECT_"),
    icons: {},
  } as NewstackClientContext["project"],
  router: {} as NewstackClientContext["router"],
  fingerprint: hash,
}) as NewstackServerContext & NewstackClientContext;

const loaders = {
  "client.js": async () => {
    const file = resolve(__dirname, "client.js");
    const content = await readFile(file, "utf-8");
    files.set("client.js", content);
  },
  "client.css": async () => {
    const file = resolve(__dirname, "client.css");
    const content = await readFile(file, "utf-8");
    files.set("client.css", content);
  },
};

/* ---------- Server ---------- */
/**
 * @description
 * NewstackServer is a class that serves a Newstack application using Hono.
 * It sets up routes for handling API requests and serving the initial HTML page.
 * The server handles server-side rendering of Newstack components and provides
 * a way to execute server functions defined in the components.
 */
export class NewstackServer {
  /**
   * @description
   * The Hono application instance that serves the Newstack server.
   */
  server: Hono;

  /**
   * @description
   * The Newstack application instance that is being served.
   */
  app: Newstack<unknown>;

  /**
   * @description
   * The renderer instance that handles rendering Newstack components to HTML.
   */
  private renderer: Renderer;

  private hmrManager: HmrManager;
  private buildManager: BuildManager;

  constructor() {
    this.server = new Hono();
    context.deps = {};
    context.secrets = loadFromEnv("NEWSTACK_SECRETS_");
    context.settings = __NEWSTACK_SETTINGS__ ?? {};

    this.renderer = new Renderer(context as NewstackClientContext);
    this.setupRoutes();

    this.hmrManager = new HmrManager(this.server, resolve(__dirname));
    this.buildManager = new BuildManager({
      renderer: this.renderer,
      context: context as NewstackServerContext & NewstackClientContext,
      distDir: __dirname,
      fingerprint: hash,
      template: () => this.template(),
      templateStatic: () => this.templateStatic(),
    });
  }

  /**
   * @description
   * Prepares the components for rendering in the server-side.
   */
  private async prepare() {
    await this.app.prepare?.(context);

    for (const [hash, { component }] of this.renderer.components) {
      if (!this.renderer.visibleHashes.has(hash)) continue;

      await component.prepare?.(context);
    }
  }

  /**
   * @description
   * Executes a server function based on the provided hash and method name.
   * It finds the component by its hash and calls the method by its name with
   * the provided arguments.
   *
   * @param {string} hash - The hash of the component (Generated in the build process).
   * @param {string} method - The name of the method to execute (Component class method name).
   * @param {unknown} args - The arguments to pass to the method (Arguments passed in the server function).
   *
   * @returns {Promise<ServerFunctionResponse>} - The result of the method execution and any error that occurred.
   */
  private async executeServerFunction(
    hash: string,
    method: string,
    args: Record<string, unknown>,
  ): Promise<ServerFunctionResponse> {
    const component = this.renderer.findComponentByHash(hash);
    if (!component) {
      return { result: null, error: `Component with hash ${hash} not found` };
    }

    try {
      const result = await component.constructor[method]({
        ...args,
        ...context,
      });

      return { result, error: null };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Unknown server error",
      };
    }
  }

  /**
   * @description
   * Handles the request for static files.
   * It reads the file from the public directory and returns its content.
   * If the file is not found, it returns an empty string.
   *
   * @param {string} name - The name of the file to handle (e.g., "favicon.ico", "style.css").
   * @returns {Promise<string>} - The content of the file as a string.
   */
  private async handleFile(name: string): Promise<string> {
    const dynamic = ["favico.ico", "style.css"].includes(name);
    if (dynamic) {
      return "";
    }

    const isPublic = !name.startsWith("client-") && !name.startsWith("server-");

    const filePath = join(__dirname, isPublic ? "../public/" : "", name);
    const file = await readFile(filePath, "utf-8").catch(() => "");
    return file;
  }

  /**
   * @description
   * Sets up the routes that render the pages on the first visit.
   * This is where the initial HTML is served to the client.
   * The client will then take over and handle the routing.
   */
  private setupRoutes() {
    this.server
      .post("/api/newstack/:hash/:method", async (c) => {
        const { hash, method } = c.req.param();
        const args = await c.req.json();

        const response = await this.executeServerFunction(hash, method, args);

        return c.json({
          result: response.result,
          error: response.error,
        });
      })
      .get("/client.js", async (c) => {
        await loaders["client.js"]();

        const dev = process.env.NEWSTACK_WATCH === "true";
        c.header("Content-Type", "application/javascript");
        c.header(
          "Cache-Control",
          dev ? "no-store" : "public, max-age=87600, immutable",
        );
        if (!dev) c.header("X-Newstack-Fingerprint", hash);

        return c.body(files.get("client.js"));
      })
      .get("/client.css", async (c) => {
        await loaders["client.css"]();

        const dev = process.env.NEWSTACK_WATCH === "true";
        c.header("Content-Type", "text/css");
        c.header(
          "Cache-Control",
          dev ? "no-store" : "public, max-age=87600, immutable",
        );
        if (!dev) c.header("X-Newstack-Fingerprint", hash);

        return c.body(files.get("client.css"));
      });
  }

  /**
   * @description
   * Serves the application by handling all incoming requests.
   * It serves static files and renders the initial HTML page for the application.
   */
  private serveAppRoutes() {
    this.server.get("*", async (c) => {
      c.header("X-Newstack-Fingerprint", hash);
      c.header("Content-Encoding", "application/gzip");

      const { path } = c.req;
      // Handle files
      if (path.includes(".")) {
        const result = await this.handleFile(path.slice(1));
        if (!result) return c.notFound();

        const end = path.split(".").pop() || "";
        c.header("Content-Type", mimeTypes[`.${end}`] || "text/plain");

        return c.body(result);
      }

      context.path = path;
      context.router.path = path;
      const page = await this.template();

      return c.html(page);
    });
  }

  /**
   * @description
   * Generates the HTML template for the initial page.
   * It renders the application and prepares the components for server-side rendering.
   *
   * @returns {Promise<string>} - The HTML template as a string.
   */
  private async template(): Promise<string> {
    this.renderer.visibleHashes.clear();
    this.renderer.head.reset();
    const element = this.app.render(context as NewstackClientContext);
    this.renderer.html(element);
    await this.prepare();
    this.renderer.head.reset();
    const page = this.renderer.html(element);

    const hmrScript = this.hmrManager.clientInjection();
    const headInjections = this.renderer.head.serverHtml();

    const pageUrl = new URL(
      context.path ?? "/",
      context.project.domain ? `https://${context.project.domain}` : "http://localhost",
    ).href;

    const resolveHref = (href: string) =>
      context.project.cdn ? new URL(href, context.project.cdn).href : href;

    const iconLinks = Object.entries(context.project.icons ?? {})
      .map(([size, href]) => {
        const resolved = resolveHref(href);
        const dimension = `${size}x${size}`;
        return `<link rel="apple-touch-icon" sizes="${dimension}" href="${resolved}">
            <link rel="icon" type="image/png" sizes="${dimension}" href="${resolved}">`;
      })
      .join("\n            ");

    const faviconHref = resolveHref(context.project.favicon);

    const registrySnapshot = JSON.stringify({
      __project: context.project,
      ...Object.fromEntries(
        Array.from(this.renderer.components.entries())
          .filter(([hash]) => this.renderer.visibleHashes.has(hash))
          .map(([hash, { component }]) => [
            hash,
            { state: serializeState(component) },
          ]),
      ),
    });

    return `
      <!DOCTYPE html>
      <html lang="${context.page.locale || "en"}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <title>${context.page.title}</title>
            <meta property="og:title" content="${context.page.title}">
            <meta name="twitter:title" content="${context.page.title}">

            <meta name="description" content="${context.page.description || ""}">
            <meta property="og:description" content="${context.page.description || ""}">
            <meta name="twitter:description" content="${context.page.description || ""}">

            ${context.page.image ? `<meta property="og:image" content="${context.page.image}">
            <meta name="twitter:image" content="${context.page.image}">` : ""}
            <meta name="twitter:card" content="${context.page.image ? "summary_large_image" : "summary"}">

            <meta property="og:site_name" content="${context.project.name}">
            <meta property="og:type" content="website">
            <meta property="og:url" content="${pageUrl}">
            <link rel="canonical" href="${pageUrl}">

            <meta name="apple-mobile-web-app-title" content="${context.project.name}">
            <meta name="apple-mobile-web-app-capable" content="yes">
            <meta name="mobile-web-app-capable" content="yes">

            <link rel="shortcut icon" href="${faviconHref}" type="image/png">
            ${iconLinks}

      	    <script type="module" src="/client.js${process.env.NEWSTACK_WATCH === "true" ? "" : `?fingerprint=${hash}`}"></script>
            <link rel="stylesheet" href="/client.css${process.env.NEWSTACK_WATCH === "true" ? "" : `?fingerprint=${hash}`}"></link>
            <script id="__NEWSTACK_STATE__" type="application/json">${registrySnapshot}</script>
            ${headInjections}
            ${hmrScript}
        </head>

        <body>
          <div id="app">
              ${page}
          </div>
        </body>
      </html>`;
  }

  /**
   * @description
   * Generates a static HTML template for SSG build mode.
   * Unlike the regular template, this does not include client.js or state hydration,
   * as the pages are fully static. Server functions are executed during build time.
   *
   * @returns {Promise<string>} - The HTML template as a string.
   */
  private async templateStatic(): Promise<string> {
    this.renderer.visibleHashes.clear();
    const element = this.app.render(context as NewstackClientContext);
    this.renderer.html(element);
    await this.prepare();
    const page = this.renderer.html(element);

    const pageUrl = new URL(
      context.path ?? "/",
      context.project.domain ? `https://${context.project.domain}` : "http://localhost",
    ).href;

    const resolveHref = (href: string) =>
      context.project.cdn ? new URL(href, context.project.cdn).href : href;

    const iconLinks = Object.entries(context.project.icons ?? {})
      .map(([size, href]) => {
        const resolved = resolveHref(href);
        const dimension = `${size}x${size}`;
        return `<link rel="apple-touch-icon" sizes="${dimension}" href="${resolved}">
            <link rel="icon" type="image/png" sizes="${dimension}" href="${resolved}">`;
      })
      .join("\n            ");

    const faviconHref = resolveHref(context.project.favicon);

    return `
      <!DOCTYPE html>
      <html lang="${context.page.locale || "en"}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <title>${context.page.title}</title>
            <meta property="og:title" content="${context.page.title}">
            <meta name="twitter:title" content="${context.page.title}">

            <meta name="description" content="${context.page.description || ""}">
            <meta property="og:description" content="${context.page.description || ""}">
            <meta name="twitter:description" content="${context.page.description || ""}">

            ${context.page.image ? `<meta property="og:image" content="${context.page.image}">
            <meta name="twitter:image" content="${context.page.image}">` : ""}
            <meta name="twitter:card" content="${context.page.image ? "summary_large_image" : "summary"}">

            <meta property="og:site_name" content="${context.project.name}">
            <meta property="og:type" content="website">
            <meta property="og:url" content="${pageUrl}">
            <link rel="canonical" href="${pageUrl}">

            <meta name="apple-mobile-web-app-title" content="${context.project.name}">
            <meta name="apple-mobile-web-app-capable" content="yes">
            <meta name="mobile-web-app-capable" content="yes">

            <link rel="shortcut icon" href="${faviconHref}" type="image/png">
            ${iconLinks}
        </head>

        <body>
          <div id="app">
              ${page}
          </div>
        </body>
      </html>`;
  }

  /**
   * @description
   * Starts the Newstack server and listens for incoming requests.
   *
   * @returns {Hono}
   */
  start(app: Newstack, opts?: { deps: Record<string, any> }): Hono {
    this.app = app;
    context.deps = opts?.deps ?? {};

    if (process.env.NEWSTACK_SSG === "true") {
      this.build(app, opts)
        .then(() => process.exit(0))
        .catch((err) => {
          console.error(err);
          process.exit(1);
        });
      return this.server;
    }

    if (process.env.NEWSTACK_SPA === "true") {
      this.buildManager
        .buildSpa(opts)
        .then(() => process.exit(0))
        .catch((err) => {
          console.error(err);
          process.exit(1);
        });
      return this.server;
    }

    const port = process.env.NEWSTACK_PORT
      ? Number(process.env.NEWSTACK_PORT)
      : undefined;

    if (process.env.NEWSTACK_SPA_DEV === "true") {
      this.setupSpaRoutes();
      serve({ fetch: this.server.fetch, port }, ({ port }) => {
        console.log(
          `Newstack SPA server is running on http://localhost:${port} 🚀`,
        );
      });
      return this.server;
    }

    if (process.env.NEWSTACK_WATCH === "true") this.hmrManager.setup();

    this.serveAppRoutes();
    this.renderer.setupAllComponents(this.app);

    serve({ fetch: this.server.fetch, port }, ({ port }) => {
      console.log(`Newstack server is running on http://localhost:${port} 🚀`);
    });

    return this.server;
  }

  async build(app: Newstack, opts?: BuildOpts): Promise<void> {
    return this.buildManager.build(app, opts);
  }

  private setupSpaRoutes(): void {
    this.server.get("*", async (c) => {
      const { path } = c.req;

      if (path.includes(".")) {
        const result = await this.handleFile(path.slice(1));
        if (!result) return c.notFound();
        const end = path.split(".").pop() || "";
        c.header("Content-Type", mimeTypes[`.${end}`] || "text/plain");
        return c.body(result);
      }

      if (!files.has("client.js")) await loaders["client.js"]();

      let cssLink = "";
      if (!files.has("client.css")) {
        try {
          await loaders["client.css"]();
        } catch {
          /* no css */
        }
      }
      if (files.has("client.css")) {
        cssLink = `<link rel="stylesheet" href="/client.css?fingerprint=${hash}">`;
      }

      return c.html(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script type="module" src="/client.js?fingerprint=${hash}"></script>
    ${cssLink}
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`);
    });
  }
}

/* ---------- Types ---------- */
type PublicFile = "client.js" | "client.css";

type ServerFunctionResponse = {
  /**
   * @description
   * The result of the server function execution.
   * This can be any type of data returned by the server function.
   * It is marked as `unknown` to allow flexibility in the return type.
   */
  result: unknown;

  /**
   * @description
   * An error message if the server function execution failed.
   * It can be `null` if there was no error.
   */
  error?: string | null;
};
