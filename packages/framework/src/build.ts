import type { Newstack, NewstackClientContext, NewstackServerContext } from "./core";
import type { Renderer } from "./renderer";
import {
  mkdir,
  writeFile,
  readFile,
  readdir,
  cp,
  access,
} from "fs/promises";
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
    const dynamicRoutePatterns = discoveredRoutes.filter((r) => r.includes(":"));
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

  private discoverRoutes(app: Newstack): string[] {
    const routes: string[] = [];

    const traverse = (vnode: any) => {
      if (!vnode || typeof vnode !== "object") return;
      const { props } = vnode;
      if (props?.route && props.route !== "*") routes.push(props.route);
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
