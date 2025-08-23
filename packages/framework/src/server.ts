/* ---------- Internal ---------- */
import { randomUUID } from "crypto";
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

const context = proxifyContext({
  environment: "server",
  params: {},
  page: {} as NewstackClientContext["page"],
  router: {} as NewstackClientContext["router"],
}) as NewstackServerContext & NewstackClientContext;

const loaders = {
  client: async () => {
    const file = resolve(__dirname, "client.js");
    const content = await readFile(file, "utf-8");
    files.set("client", content);
  },
};

loaders.client();

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

  constructor() {
    this.server = new Hono();
    context.deps = {};

    this.renderer = new Renderer(context as NewstackClientContext);
    this.setupRoutes();
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
      .get("/client.js", (c) => {
        c.header("Content-Type", "application/javascript");
        c.header("Cache-Control", "public, max-age=87600, immutable");
        c.header("X-Newstack-Fingerprint", hash);

        return c.body(files.get("client"));
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

      	    <script type="module" src="/client.js?fingerprint=${hash}"></script>
            <script id="__NEWSTACK_STATE__" type="application/json">${registrySnapshot}</script>
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
    this.serveAppRoutes();
    this.renderer.setupAllComponents(this.app);

    serve(this.server, ({ port }) => {
      console.log(`Newstack server is running on http://localhost:${port} 🚀`);
    });

    return this.server;
  }
}

/* ---------- Types ---------- */
type PublicFile = "client";

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
