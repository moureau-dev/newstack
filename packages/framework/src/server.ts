declare const __NEWSTACK_SETTINGS__: Record<string, string | number | boolean>;

/* ---------- Internal ---------- */
import { randomUUID } from "crypto";
import { watch as watchFs, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { readFile, writeFile, mkdir, cp, access, readdir } from "fs/promises";

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

/* ---------- Constants ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const files = new Map<PublicFile, string>();
const hash = randomUUID();

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
  page: {} as NewstackClientContext["page"],
  router: {} as NewstackClientContext["router"],
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

  /**
   * @description
   * SSE send functions for connected HMR clients (dev mode only).
   */
  private hmrClients = new Set<(data: string) => void>();

  constructor() {
    this.server = new Hono();
    context.deps = {};
    context.secrets = loadFromEnv("NEWSTACK_SECRETS_");
    context.settings = __NEWSTACK_SETTINGS__ ?? {};

    this.renderer = new Renderer(context as NewstackClientContext);
    this.setupRoutes();
  }

  /**
   * @description
   * Broadcasts an HMR event to all connected browser clients.
   */
  private notifyHmr(data: object) {
    const msg = JSON.stringify(data);
    for (const send of this.hmrClients) {
      try {
        send(msg);
      } catch {
        this.hmrClients.delete(send);
      }
    }
  }

  /**
   * @description
   * Sets up the SSE /hmr route and watches dist/ for client file changes.
   * Only called when NEWSTACK_WATCH=true.
   */
  private setupHmr() {
    const self = this;

    this.server.get("/hmr", (_c) => {
      const encoder = new TextEncoder();
      let clientSend: ((data: string) => void) | null = null;

      const body = new ReadableStream({
        start(controller) {
          clientSend = (data: string) => {
            try {
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } catch {
              // connection already closed
            }
          };
          self.hmrClients.add(clientSend);
        },
        cancel() {
          if (clientSend) self.hmrClients.delete(clientSend);
        },
      });

      return new Response(body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    });

    // Debounced fs.watch on the dist directory
    const distDir = resolve(__dirname);
    const pending = new Set<string>();
    let debounce: ReturnType<typeof setTimeout> | null = null;

    watchFs(distDir, (_, filename) => {
      if (!filename) return;
      if (filename === "client.css") pending.add("css");
      else if (filename.startsWith("client") && filename.endsWith(".js"))
        pending.add("js");
      else return;

      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        for (const type of pending) self.notifyHmr({ type });
        pending.clear();
        debounce = null;
      }, 100);
    });
  }

  /**
   * @description
   * Prepares the components for rendering in the server-side.
   */
  private async prepare() {
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
    const element = this.app.render(context as NewstackClientContext);
    this.renderer.html(element);
    await this.prepare();
    const page = this.renderer.html(element);

    const hmrScript =
      process.env.NEWSTACK_WATCH === "true"
        ? `<script type="module">
    function connectHmr() {
      const es = new EventSource('/hmr');
      es.onmessage = async (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'css') {
          const link = document.querySelector('link[rel="stylesheet"]');
          if (link) link.href = link.href.split('?')[0] + '?t=' + Date.now();
        } else if (msg.type === 'js') {
          await import('/client.js?t=' + Date.now());
          if (window.__NEWSTACK && window.__NEWSTACK_PENDING) {
            window.__NEWSTACK.renderer.hmrUpdate(window.__NEWSTACK_PENDING);
            window.__NEWSTACK_PENDING = null;
          }
        }
      };
      es.onerror = () => {
        es.close();
        setTimeout(() => window.location.reload(), 1000);
      };
    }
    connectHmr();
  </script>`
        : "";

    const registrySnapshot = JSON.stringify(
      Object.fromEntries(
        Array.from(this.renderer.components.entries())
          .filter(([hash]) => this.renderer.visibleHashes.has(hash))
          .map(([hash, { component }]) => [hash, { state: component }]),
      ),
    );

    return `
      <!DOCTYPE html>
      <html lang="${context.page.locale || "en"}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <title>${context.page.title}</title>
            <meta name="og:title" content="${context.page.title}">

            <meta name="description" content="${context.page.description || ""}">
            <meta name="og:description" content="${context.page.description || ""}">

            <style>
      	      body { font-family: Arial, sans-serif; }
            </style>

      	    <script type="module" src="/client.js${process.env.NEWSTACK_WATCH === "true" ? "" : `?fingerprint=${hash}`}"></script>
            <link rel="stylesheet" href="/client.css${process.env.NEWSTACK_WATCH === "true" ? "" : `?fingerprint=${hash}`}"></link>
            <script id="__NEWSTACK_STATE__" type="application/json">${registrySnapshot}</script>
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

    return `
      <!DOCTYPE html>
      <html lang="${context.page.locale || "en"}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <title>${context.page.title}</title>
            <meta name="og:title" content="${context.page.title}">

            <meta name="description" content="${context.page.description || ""}">
            <meta name="og:description" content="${context.page.description || ""}">

            <style>
      	      body { font-family: Arial, sans-serif; }
            </style>
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
      this.build(app, opts).then(() => process.exit(0)).catch((err) => {
        console.error(err);
        process.exit(1);
      });
      return this.server;
    }

    if (process.env.NEWSTACK_SPA === "true") {
      this.buildSpa(opts).then(() => process.exit(0)).catch((err) => {
        console.error(err);
        process.exit(1);
      });
      return this.server;
    }

    if (process.env.NEWSTACK_SPA_DEV === "true") {
      this.setupSpaRoutes();
      serve(this.server, ({ port }) => {
        console.log(`Newstack SPA server is running on http://localhost:${port} 🚀`);
      });
      return this.server;
    }

    if (process.env.NEWSTACK_WATCH === "true") this.setupHmr();

    this.serveAppRoutes();
    this.renderer.setupAllComponents(this.app);

    serve(this.server, ({ port }) => {
      console.log(`Newstack server is running on http://localhost:${port} 🚀`);
    });

    return this.server;
  }

  /**
   * @description
   * Builds static site generation (SSG) output by crawling all routes and links.
   * This method renders all discoverable pages to static HTML files.
   *
   * @param app The Newstack application instance to build.
   * @param opts Optional configuration including:
   *   - outDir: Output directory for static files
   *   - deps: Dependencies to inject into context
   *   - dynamicRoutes: Array of concrete paths for dynamic routes (e.g., ["/profile/1", "/profile/2"])
   *   - getStaticPaths: Async function that returns paths for dynamic routes
   *   - hydrate: If true, includes client.js for hydration/interactivity (default: true)
   * @returns Promise that resolves when the build is complete.
   */
  async build(
    app: Newstack,
    opts?: {
      outDir?: string;
      deps?: Record<string, any>;
      dynamicRoutes?: string[];
      getStaticPaths?: () => Promise<string[]> | string[];
      hydrate?: boolean;
    },
  ): Promise<void> {
    this.app = app;
    context.deps = opts?.deps ?? {};
    this.renderer.setupAllComponents(this.app);

    const outDir = opts?.outDir || "dist/ssg";
    const shouldHydrate = opts?.hydrate ?? true;
    const visitedPaths = new Set<string>();
    const pathsToVisit: string[] = ["/"];

    // Discover all routes from components first
    const discoveredRoutes = this.discoverRoutes();
    const dynamicRoutePatterns = discoveredRoutes.filter((r) =>
      r.includes(":"),
    );

    // Collect dynamic route paths from multiple sources
    const dynamicRoutePaths = new Set<string>();

    // Add manually specified routes (if they match a pattern)
    for (const path of opts?.dynamicRoutes || []) {
      if (
        dynamicRoutePatterns.some((pattern) =>
          this.matchesRoutePattern(path, pattern),
        )
      ) {
        dynamicRoutePaths.add(path);
      }
    }

    // Call getStaticPaths if provided (only add paths that match patterns)
    if (opts?.getStaticPaths) {
      const paths = await opts.getStaticPaths();
      for (const path of paths) {
        if (
          dynamicRoutePatterns.some((pattern) =>
            this.matchesRoutePattern(path, pattern),
          )
        ) {
          dynamicRoutePaths.add(path);
        }
      }
    }

    // Add discovered routes to paths to visit
    for (const route of discoveredRoutes) {
      if (!route.includes(":")) {
        // Only add static routes
        pathsToVisit.push(route);
      }
    }

    console.log("Starting SSG build...");
    console.log("Discovered routes:", discoveredRoutes);

    // Create output directory
    await mkdir(outDir, { recursive: true });

    // Crawl and render all paths
    while (pathsToVisit.length > 0) {
      const path = pathsToVisit.shift();
      if (visitedPaths.has(path)) continue;

      visitedPaths.add(path);
      console.log(`Rendering: ${path}`);

      // Set the path in context
      context.path = path;
      context.router.path = path;

      // Generate HTML for this path (will execute server functions during render)
      const html = shouldHydrate
        ? await this.template()
        : await this.templateStatic();

      // Extract links from the HTML
      const links = this.extractLinks(html);
      for (const link of links) {
        if (!visitedPaths.has(link) && !pathsToVisit.includes(link)) {
          // Check if this link matches any defined route (static or dynamic)
          const matchesStaticRoute = discoveredRoutes.some(
            (r) => !r.includes(":") && r === link,
          );
          const matchesDynamicRoute = dynamicRoutePatterns.some((pattern) =>
            this.matchesRoutePattern(link, pattern),
          );

          // Only add links that match defined routes
          if (matchesStaticRoute || matchesDynamicRoute) {
            if (matchesDynamicRoute) {
              dynamicRoutePaths.add(link);
            }
            pathsToVisit.push(link);
          }
        }
      }

      // Write HTML file
      await this.writeHtmlFiles(path, outDir, html);
    }

    // Render any manually configured dynamic routes that weren't discovered
    for (const dynamicPath of dynamicRoutePaths) {
      if (visitedPaths.has(dynamicPath)) continue;

      visitedPaths.add(dynamicPath);
      console.log(`Rendering dynamic: ${dynamicPath}`);

      context.path = dynamicPath;
      context.router.path = dynamicPath;

      const html = shouldHydrate
        ? await this.template()
        : await this.templateStatic();
      await this.writeHtmlFiles(dynamicPath, outDir, html);
    }

    // Copy all client-generated files if hydration is enabled
    if (shouldHydrate) {
      await this.copyClientFiles(outDir);
    }

    // Copy public directory if it exists
    await this.copyPublicDirectory(outDir);

    console.log("\nSSG build complete!");
    console.log(`Generated ${visitedPaths.size} pages in ${outDir}`);
    console.log("Pages:", Array.from(visitedPaths));
  }

  /**
   * @description
   * Builds a static SPA shell: a minimal index.html with no SSR content,
   * plus client.js and client.css. The client handles all rendering and routing.
   *
   * @param opts Optional configuration including outDir.
   */
  /**
   * @description
   * Copies all client-generated files (client.js, client.css, and any split chunks)
   * from the dist directory to the output directory.
   *
   * @param outDir The output directory to copy files into.
   */
  private async copyClientFiles(outDir: string): Promise<void> {
    const distDir = resolve(__dirname);
    const entries = await readdir(distDir);
    const clientFiles = entries.filter((f) => f.startsWith("client"));

    for (const file of clientFiles) {
      const content = await readFile(join(distDir, file), "utf-8");
      await writeFile(join(outDir, file), content, "utf-8");
      console.log(`Copied ${file}`);
    }
  }

  private async buildSpa(opts?: { outDir?: string; deps?: Record<string, any> }): Promise<void> {
    const outDir = opts?.outDir || "dist/spa";
    await mkdir(outDir, { recursive: true });

    await this.copyClientFiles(outDir);

    const cssLink = (await readdir(resolve(__dirname))).some((f) => f === "client.css")
      ? `<link rel="stylesheet" href="/client.css?fingerprint=${hash}">`
      : "";

    const html = `<!DOCTYPE html>
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
</html>`;

    await writeFile(join(outDir, "index.html"), html, "utf-8");
    await this.copyPublicDirectory(outDir);

    console.log("SPA build complete!");
    console.log(`Output: ${outDir}`);
  }

  /**
   * @description
   * Sets up routes for SPA dev server mode.
   * All routes return the same minimal HTML shell; the client handles routing.
   */
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
        try { await loaders["client.css"](); } catch { /* no css */ }
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

  /**
   * @description
   * Copies the public directory to the SSG output directory.
   * This includes all static assets like images, fonts, etc.
   *
   * @param outDir The output directory for SSG build.
   */
  private async copyPublicDirectory(outDir: string): Promise<void> {
    // Look for public directory in the current working directory
    const publicDir = resolve(process.cwd(), "public");

    try {
      await access(publicDir);
      console.log("Copying public directory...");
      await cp(publicDir, outDir, { recursive: true });
      console.log("Public directory copied successfully");
    } catch {
      // Public directory doesn't exist, skip
      console.log("No public directory found, skipping...");
    }
  }

  /**
   * @description
   * Discovers all routes defined in the application components by traversing
   * the component tree and collecting route props.
   *
   * @returns Array of route patterns found in the application.
   */
  private discoverRoutes(): string[] {
    const routes: string[] = [];

    const traverseVNode = (vnode: any) => {
      if (!vnode || typeof vnode !== "object") return;

      const { props } = vnode;
      if (props?.route && props.route !== "*") {
        routes.push(props.route);
      }

      if (Array.isArray(props?.children)) {
        for (const child of props.children) {
          traverseVNode(child);
        }
      } else if (props?.children) {
        traverseVNode(props.children);
      }
    };

    // Render the app to discover routes
    const vnode = this.app.render(context as NewstackClientContext);
    traverseVNode(vnode);

    return routes;
  }

  /**
   * @description
   * Extracts all internal links (href attributes) from the rendered HTML.
   *
   * @param html The HTML string to extract links from.
   * @returns Array of internal link paths.
   */
  private extractLinks(html: string): string[] {
    const links: string[] = [];
    const hrefRegex = /href=["']([^"']+)["']/g;

    let match = hrefRegex.exec(html);
    while (match !== null) {
      const href = match[1];

      // Only include internal links (starting with /)
      if (href.startsWith("/") && !href.startsWith("//")) {
        // Remove query params and hash
        const cleanPath = href.split("?")[0].split("#")[0];
        if (cleanPath && !cleanPath.includes(".")) {
          links.push(cleanPath);
        }
      }

      match = hrefRegex.exec(html);
    }

    return [...new Set(links)]; // Remove duplicates
  }

  /**
   * @description
   * Converts a URL path to a file system path for SSG output.
   *
   * @param path The URL path (e.g., "/about").
   * @param outDir The output directory.
   * @returns The file system path where the HTML should be written.
   */
  /**
   * @description
   * Writes HTML to both the flat file path ([name].html) and the directory
   * path ([name]/index.html) so both URL styles resolve correctly.
   *
   * @param path The URL path (e.g., "/about").
   * @param outDir The output directory.
   * @param html The HTML content to write.
   */
  private async writeHtmlFiles(path: string, outDir: string, html: string): Promise<void> {
    if (path === "/") {
      await writeFile(join(outDir, "index.html"), html, "utf-8");
      return;
    }

    const cleanPath = path.replace(/^\//, "");

    // Flat: /about.html
    const flatPath = join(outDir, `${cleanPath}.html`);
    await mkdir(dirname(flatPath), { recursive: true });
    await writeFile(flatPath, html, "utf-8");

    // Directory: /about/index.html
    const dirPath = join(outDir, cleanPath, "index.html");
    await mkdir(dirname(dirPath), { recursive: true });
    await writeFile(dirPath, html, "utf-8");
  }

  /**
   * @description
   * Checks if a concrete path matches a route pattern with parameters.
   * For example, "/profile/123" matches "/profile/:id"
   *
   * @param path The concrete path (e.g., "/profile/123")
   * @param pattern The route pattern (e.g., "/profile/:id")
   * @returns True if the path matches the pattern
   */
  private matchesRoutePattern(path: string, pattern: string): boolean {
    const pathSegments = path.split("/").filter(Boolean);
    const patternSegments = pattern.split("/").filter(Boolean);

    if (pathSegments.length !== patternSegments.length) return false;

    for (let i = 0; i < patternSegments.length; i++) {
      const patternSegment = patternSegments[i];
      const pathSegment = pathSegments[i];

      // If pattern segment is a parameter, it matches any value
      if (patternSegment.startsWith(":")) continue;

      // Otherwise, segments must match exactly
      if (patternSegment !== pathSegment) return false;
    }

    return true;
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
