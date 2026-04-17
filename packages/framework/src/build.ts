import type {
  Newstack,
  NewstackClientContext,
  NewstackServerContext,
} from "./core";
import type { Renderer } from "./renderer";
import { mkdir, writeFile, readFile, readdir, cp, access } from "fs/promises";
import { resolve, join, dirname } from "path";

export type BuildOpts = {
  outDir?: string;
  deps?: Record<string, unknown>;
  dynamicRoutes?: string[];
  getStaticPaths?: () => Promise<string[]> | string[];
  hydrate?: boolean;
};

type BuildManagerDeps = {
  renderer: Renderer;
  context: NewstackServerContext & NewstackClientContext;
  distDir: string;
  fingerprint: string;
  template: () => Promise<string>;
  templateStatic: () => Promise<string>;
};

/**
 * Handles SSG and SPA build operations.
 * Compose into NewstackServer by passing the deps object.
 */
export class BuildManager {
  constructor(private readonly deps: BuildManagerDeps) {}

  async build(app: Newstack, opts?: BuildOpts): Promise<void> {
    const { renderer, context } = this.deps;

    context.deps = opts?.deps ?? {};
    renderer.setupAllComponents(app);

    const outDir = opts?.outDir || "dist/ssg";
    const shouldHydrate = opts?.hydrate ?? true;
    const visitedPaths = new Set<string>();
    const pathsToVisit: string[] = ["/"];

    const discoveredRoutes = this.discoverRoutes(app);
    const dynamicRoutePatterns = discoveredRoutes.filter((r) =>
      r.includes(":"),
    );
    const dynamicRoutePaths = new Set<string>();

    for (const path of opts?.dynamicRoutes || []) {
      if (
        dynamicRoutePatterns.some((pattern) =>
          this.matchesRoutePattern(path, pattern),
        )
      ) {
        dynamicRoutePaths.add(path);
      }
    }

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

    for (const route of discoveredRoutes) {
      if (!route.includes(":")) pathsToVisit.push(route);
    }

    console.log("Starting SSG build...");
    console.log("Discovered routes:", discoveredRoutes);

    await mkdir(outDir, { recursive: true });

    while (pathsToVisit.length > 0) {
      const path = pathsToVisit.shift();
      if (visitedPaths.has(path)) continue;

      visitedPaths.add(path);
      console.log(`Rendering: ${path}`);

      context.path = path;
      context.router.path = path;

      const html = shouldHydrate
        ? await this.deps.template()
        : await this.deps.templateStatic();

      const links = this.extractLinks(html);
      for (const link of links) {
        if (!visitedPaths.has(link) && !pathsToVisit.includes(link)) {
          const matchesStaticRoute = discoveredRoutes.some(
            (r) => !r.includes(":") && r === link,
          );
          const matchesDynamicRoute = dynamicRoutePatterns.some((pattern) =>
            this.matchesRoutePattern(link, pattern),
          );

          if (matchesStaticRoute || matchesDynamicRoute) {
            if (matchesDynamicRoute) dynamicRoutePaths.add(link);
            pathsToVisit.push(link);
          }
        }
      }

      await this.writeHtmlFiles(path, outDir, html);
    }

    for (const dynamicPath of dynamicRoutePaths) {
      if (visitedPaths.has(dynamicPath)) continue;

      visitedPaths.add(dynamicPath);
      console.log(`Rendering dynamic: ${dynamicPath}`);

      context.path = dynamicPath;
      context.router.path = dynamicPath;

      const html = shouldHydrate
        ? await this.deps.template()
        : await this.deps.templateStatic();
      await this.writeHtmlFiles(dynamicPath, outDir, html);
    }

    if (shouldHydrate) await this.copyClientFiles(outDir);
    await this.copyPublicDirectory(outDir);
    await this.writeManifest(outDir);
    await this.writeServiceWorker(outDir, Array.from(visitedPaths), "ssg");

    console.log("\nSSG build complete!");
    console.log(`Generated ${visitedPaths.size} pages in ${outDir}`);
    console.log("Pages:", Array.from(visitedPaths));
  }

  async buildSpa(opts?: {
    outDir?: string;
    deps?: Record<string, unknown>;
  }): Promise<void> {
    const { distDir, fingerprint } = this.deps;
    const outDir = opts?.outDir || "dist/spa";

    await mkdir(outDir, { recursive: true });
    await this.copyClientFiles(outDir);

    const cssLink = (await readdir(resolve(distDir))).some(
      (f) => f === "client.css",
    )
      ? `<link rel="stylesheet" href="/client.css?fingerprint=${fingerprint}">`
      : "";

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script type="module" src="/client.js?fingerprint=${fingerprint}"></script>
    ${cssLink}
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`;

    await writeFile(join(outDir, "index.html"), html, "utf-8");
    await this.copyPublicDirectory(outDir);
    await this.writeManifest(outDir);
    await this.writeServiceWorker(outDir, [], "spa");

    console.log("SPA build complete!");
    console.log(`Output: ${outDir}`);
  }

  private async copyClientFiles(outDir: string): Promise<void> {
    const entries = await readdir(this.deps.distDir);
    for (const file of entries.filter((f) => f.startsWith("client"))) {
      const content = await readFile(join(this.deps.distDir, file), "utf-8");
      await writeFile(join(outDir, file), content, "utf-8");
      console.log(`Copied ${file}`);
    }
  }

  private async copyPublicDirectory(outDir: string): Promise<void> {
    const publicDir = resolve(process.cwd(), "public");
    try {
      await access(publicDir);
      console.log("Copying public directory...");
      await cp(publicDir, outDir, { recursive: true });
      console.log("Public directory copied successfully");
    } catch {
      console.log("No public directory found, skipping...");
    }
  }

  private async writeHtmlFiles(
    path: string,
    outDir: string,
    html: string,
  ): Promise<void> {
    if (path === "/") {
      await writeFile(join(outDir, "index.html"), html, "utf-8");
      return;
    }

    const cleanPath = path.replace(/^\//, "");

    const flatPath = join(outDir, `${cleanPath}.html`);
    await mkdir(dirname(flatPath), { recursive: true });
    await writeFile(flatPath, html, "utf-8");

    const dirPath = join(outDir, cleanPath, "index.html");
    await mkdir(dirname(dirPath), { recursive: true });
    await writeFile(dirPath, html, "utf-8");
  }

  discoverRoutes(app: Newstack): string[] {
    const routes: string[] = [];

    const traverse = (vnode: any) => {
      if (!vnode) return;
      if (Array.isArray(vnode)) {
        vnode.forEach(traverse);
        return;
      }
      if (typeof vnode !== "object") return;
      const { type, props } = vnode;
      if (props?.route && props.route !== "*") routes.push(props.route);
      if (typeof type === "function" && !type.hash) {
        traverse(type(props ?? {}));
        return;
      }
      if (Array.isArray(props?.children)) {
        for (const child of props.children) traverse(child);
      } else if (props?.children) {
        traverse(props.children);
      }
    };

    traverse(app.render(this.deps.context as NewstackClientContext));
    return routes;
  }

  private extractLinks(html: string): string[] {
    const links: string[] = [];
    const hrefRegex = /href=["']([^"']+)["']/g;
    let match = hrefRegex.exec(html);
    while (match !== null) {
      const href = match[1];
      if (href.startsWith("/") && !href.startsWith("//")) {
        const cleanPath = href.split("?")[0].split("#")[0];
        if (cleanPath && !cleanPath.includes(".")) links.push(cleanPath);
      }
      match = hrefRegex.exec(html);
    }
    return [...new Set(links)];
  }

  serviceWorkerScript(routes: string[], mode: string): string {
    const { fingerprint, context } = this.deps;
    const dev = process.env.NEWSTACK_WATCH === "true";

    const swContext = {
      environment: dev ? "development" : "production",
      mode,
      fingerprint,
      project: { ...context.project },
      settings: context.settings || {},
      worker: {
        enabled: true,
        fetching: false,
        preload: routes,
        staleWhileRevalidate: [],
        cacheFirst: [],
        headers: {},
        api: "",
        cdn: context.project?.cdn || "",
        protocol: "https",
        queues: {},
      },
    };

    return `self.context = ${JSON.stringify(swContext, null, 2)};

async function load(event) {
  const response = await event.preloadResponse;
  if (response) return response;
  return fetch(event.request);
}

function match(serializedMatcher, url) {
  const matcher = JSON.parse(serializedMatcher);
  return new RegExp(matcher.source, matcher.flags).test(url.href);
}

function withAPI(url) {
  const fragments = url.split("?");
  let path = fragments[0];
  const query = fragments[1];
  if (path.includes(".")) return url;
  return query ? [url, \`\${path}?\${query}\`] : [url, path];
}

async function extractData(response) {
  const html = await response.clone().text();
  const parts = html.split('<script id="__NEWSTACK_STATE__" type="application/json">');
  if (parts.length < 2) return new Response("{}", { headers: { "Content-Type": "application/json" } });
  const json = parts[1].split("</script>")[0];
  return new Response(json, { headers: { "Content-Type": "application/json" } });
}

async function cacheFirst(event) {
  const cache = await caches.open(self.context.fingerprint);
  const cachedResponse = await cache.match(event.request);
  if (cachedResponse) return cachedResponse;
  const response = await load(event);
  await cache.put(event.request, response.clone());
  return response;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(self.context.fingerprint);
  const cachedResponse = await cache.match(event.request);
  const networkResponsePromise = load(event);
  event.waitUntil(async function () {
    const networkResponse = await networkResponsePromise;
    await cache.put(event.request, networkResponse.clone());
  }());
  return cachedResponse || networkResponsePromise;
}

async function networkFirst(event) {
  const cache = await caches.open(self.context.fingerprint);
  try {
    const networkResponse = await load(event);
    await cache.put(event.request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    return cache.match(event.request);
  }
}

async function networkDataFirst(event) {
  const cache = await caches.open(self.context.fingerprint);
  const url = new URL(event.request.url);
  try {
    const response = await load(event);
    const dataResponse = await extractData(response);
    return response;
  } catch (error) {
    const cachedDataResponse = await cache.match(url);
    return cachedDataResponse || cache.match("/offline/index.html");
  }
}

function install(event) {
  const urls = [
    \`/client.js?fingerprint=\${self.context.fingerprint}\`,
    \`/client.css?fingerprint=\${self.context.fingerprint}\`,
    ...(self.context.mode === "ssg" ? ["/", ...self.context.worker.preload.map(withAPI)] : []),
  ].flat().filter(Boolean);
  event.waitUntil(async function () {
    const cache = await caches.open(self.context.fingerprint);
    await cache.addAll([...new Set(urls)]);
    self.skipWaiting();
  }());
}
self.addEventListener("install", install);

function activate(event) {
  event.waitUntil(async function () {
    const cacheNames = await caches.keys();
    const cachesToDelete = cacheNames.filter((name) => name !== self.context.fingerprint);
    await Promise.all(cachesToDelete.map((name) => caches.delete(name)));
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    self.clients.claim();
  }());
}
self.addEventListener("activate", activate);

function staticStrategy(event) {
  event.waitUntil(async function () {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);
    for (const matcher of self.context.worker.staleWhileRevalidate) {
      if (match(matcher, url)) return event.respondWith(staleWhileRevalidate(event));
    }
    for (const matcher of self.context.worker.cacheFirst) {
      if (match(matcher, url)) return event.respondWith(cacheFirst(event));
    }
    if (url.origin !== location.origin) return;
    if (url.searchParams?.get("fingerprint") === self.context.fingerprint) {
      return event.respondWith(cacheFirst(event));
    }
    if (url.pathname.indexOf(".") > -1) return event.respondWith(staleWhileRevalidate(event));
    if (self.context.mode === "ssr" || url.pathname === "/") return event.respondWith(networkFirst(event));
    event.respondWith(networkDataFirst(event));
  }());
}
self.addEventListener("fetch", staticStrategy);
`;
  }

  manifest(): object {
    const { name, shortName, color, backgroundColor, display, orientation, scope, icons, cdn } = this.deps.context.project;
    const resolveHref = (href: string) => cdn ? new URL(href, cdn).href : href;
    const mime: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };

    return {
      name,
      short_name: shortName ?? name,
      theme_color: color || "#000000",
      background_color: backgroundColor || "#ffffff",
      display: display || "standalone",
      orientation: orientation || "portrait",
      scope: scope || "/",
      start_url: "/",
      icons: Object.entries(icons ?? {}).map(([size, href]) => ({
        src: resolveHref(href),
        sizes: `${size}x${size}`,
        type: mime[`.${href.split(".").pop()}`] || "image/png",
        purpose: "maskable any",
      })),
      splash_pages: null,
    };
  }

  headHtml(extras = ""): string {
    const { context } = this.deps;
    const mime: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon" };

    const pageUrl = new URL(
      context.path ?? "/",
      context.project.domain ? `https://${context.project.domain}` : "http://localhost",
    ).href;

    const resolveHref = (href: string) =>
      context.project.cdn ? new URL(href, context.project.cdn).href : href;

    const faviconHref = resolveHref(context.project.favicon ?? "");
    const faviconType = mime[`.${faviconHref.split(".").pop()}`] || "image/png";

    const iconLinks = Object.entries(context.project.icons ?? {})
      .map(([size, href]) => {
        const resolved = resolveHref(href);
        const type = mime[`.${href.split(".").pop()}`] || "image/png";
        const dimension = `${size}x${size}`;
        return `<link rel="apple-touch-icon" sizes="${dimension}" href="${resolved}">
            <link rel="icon" type="${type}" sizes="${dimension}" href="${resolved}">`;
      })
      .join("\n            ");

    return `
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <title>${context.page.title ?? ""}</title>
            <meta property="og:title" content="${context.page.title ?? ""}">
            <meta name="twitter:title" content="${context.page.title ?? ""}">

            <meta name="description" content="${context.page.description || ""}">
            <meta property="og:description" content="${context.page.description || ""}">
            <meta name="twitter:description" content="${context.page.description || ""}">

            ${context.page.image ? `<meta property="og:image" content="${context.page.image}">
            <meta name="twitter:image" content="${context.page.image}">` : ""}
            <meta name="twitter:card" content="${context.page.image ? "summary_large_image" : "summary"}">

            <meta property="og:locale" content="${context.page.locale || "en"}">
            <meta property="og:site_name" content="${context.project.name ?? ""}">
            <meta property="og:type" content="website">
            <meta property="og:url" content="${pageUrl}">
            <link rel="canonical" href="${pageUrl}">

            <meta name="apple-mobile-web-app-title" content="${context.project.name ?? ""}">
            <meta name="apple-mobile-web-app-capable" content="yes">
            <meta name="mobile-web-app-capable" content="yes">

            ${context.project.color ? `<meta name="theme-color" content="${context.project.color}">
            <meta name="msapplication-TileColor" content="${context.project.color}">
            <meta name="msapplication-navbutton-color" content="${context.project.color}">` : ""}

            <link rel="manifest" href="/manifest.webmanifest">
            <link rel="shortcut icon" href="${faviconHref}" type="${faviconType}">
            ${iconLinks}
            ${extras}`;
  }

  private async writeManifest(outDir: string): Promise<void> {
    const manifest = this.manifest();
    await writeFile(join(outDir, "manifest.webmanifest"), JSON.stringify(manifest, null, 2), "utf-8");
    console.log("Generated manifest.webmanifest");
  }

  private async writeServiceWorker(
    outDir: string,
    routes: string[],
    mode: string,
  ): Promise<void> {
    const script = this.serviceWorkerScript(routes, mode);
    await writeFile(join(outDir, "service-worker.js"), script, "utf-8");
    console.log("Generated service-worker.js");
  }

  private matchesRoutePattern(path: string, pattern: string): boolean {
    const pathSegs = path.split("/").filter(Boolean);
    const patternSegs = pattern.split("/").filter(Boolean);
    if (pathSegs.length !== patternSegs.length) return false;
    for (let i = 0; i < patternSegs.length; i++) {
      if (patternSegs[i].startsWith(":")) continue;
      if (patternSegs[i] !== pathSegs[i]) return false;
    }
    return true;
  }
}
