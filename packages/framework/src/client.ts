import { proxifyContext } from "./context";
import type { Newstack, NewstackClientContext } from "./core";
import { Renderer } from "./renderer";

/**
 * @description
 * NewstackClient is a class that initializes and manages the Newstack application on the client side.
 * It handles rendering the application, managing the client-side state, and routing.
 */
export class NewstackClient {
  /**
   * @description
   * The root HTML element where the Newstack application is rendered.
   * It should have an id of "app" in the HTML document.
   */
  root: HTMLElement;

  /**
   * @description
   * The Newstack application instance entrypoint that is being served.
   */
  app: Newstack;

  /**
   * @description
   * The context object that holds the current client-side state of the application,
   * such as the current path and more.
   */
  context: NewstackClientContext;

  /**
   * @description
   * The renderer instance that handles rendering Newstack components to HTML.
   * It manages the component lifecycle, including hydration and updates.
   */
  renderer: Renderer;

  private mounted = false;
  private workerState: NewstackClientContext["worker"] = {
    enabled: true,
    mode: "ssr",
    online: true,
    responsive: false,
    registration: null,
    installation: null,
    queues: {},
  };

  constructor(root?: HTMLElement) {
    if (root) {
      this.root = root;
    } else {
      this.root = document.getElementById("app") as HTMLElement;
      if (!this.root) {
        throw new Error("Root element with id 'app' not found.");
      }
    }

    const description = document.querySelector("meta[name='description']");
    const ogImage = document.querySelector("meta[property='og:image']");

    const page = {
      title: document.title,
      description: description?.getAttribute("content") || "",
      image: ogImage?.getAttribute("content") || "",
      locale: document.documentElement.lang,
    } as NewstackClientContext["page"];

    const router = {
      url: location.href,
      path: location.pathname,
      base: location.origin,
    } as NewstackClientContext["router"];

    const scriptSrc =
      document.querySelector('script[src*="client.js"]')?.getAttribute("src") ??
      "";
    const fingerprint =
      new URL(scriptSrc, location.origin).searchParams.get("fingerprint") ?? "";

    const stateScript = document.querySelector<HTMLScriptElement>(
      "script#__NEWSTACK_STATE__",
    );
    const state = JSON.parse(stateScript?.textContent || "{}");

    this.workerState = state.__worker ?? { enabled: true, mode: "ssr" };

    const ctx: Partial<NewstackClientContext> = {
      environment: "client",
      page,
      project: state.__project ?? {},
      router,
      path: location.pathname,
      params: {},
      instances: new Proxy({} as Record<string, any>, {
        get: (t, k) => (k in t ? t[k as string] : {}),
      }),
      settings: (globalThis as any).__NEWSTACK_SETTINGS__ ?? {},
      fingerprint,
      worker: this.workerState,
    };

    this.context = proxifyContext(ctx, this) as NewstackClientContext;

    this.renderer = new Renderer(this.context);

    (window as any).mount = (
      ComponentClass: typeof Newstack,
      _root?: HTMLElement,
    ) => {
      if ((window as any).__NEWSTACK) {
        return (window as any).__NEWSTACK.mount(ComponentClass, _root);
      }
      window.addEventListener(
        "newstack:ready",
        () => (window as any).__NEWSTACK.mount(ComponentClass, _root),
        { once: true },
      );
    };
  }

  static init(root?: HTMLElement): NewstackClient {
    if ((window as any).__NEWSTACK) return (window as any).__NEWSTACK;

    let el = root;
    if (!el) {
      el = document.createElement("div");
      document.body.appendChild(el);
    }

    const client = new NewstackClient(el);
    (window as any).__NEWSTACK = client;
    window.dispatchEvent(new CustomEvent("newstack:ready", { detail: client }));
    return client;
  }

  /**
   * @description
   * Starts the Newstack application on the client side.
   * This method hydrates the application tree into the root element,
   * sets up client-side routing, and patches links to handle navigation without full page reloads.
   *
   * @param app The Newstack application instance to start on the client side.
   */
  async start(app: Newstack) {
    // HMR: when the bundle is re-imported after a JS change, a second
    // NewstackClient().start() call is triggered. Detect this and stash
    // the new app so hmrUpdate() can swap prototypes without re-initialising.
    if (typeof window !== "undefined" && (window as any).__NEWSTACK) {
      (window as any).__NEWSTACK_PENDING = app;
      return;
    }

    this.app = app;
    this.renderer.setupAllComponents(this.app);
    this.patchLinks();

    this.app.prepare?.(this.context);
    await this.renderRoute(location.pathname);
    this.app.hydrate?.(this.context);

    if (typeof window !== "undefined") {
      (window as any).__NEWSTACK = this;
      window.dispatchEvent(new CustomEvent("newstack:ready", { detail: this }));

      const update = () => {
        this.renderer.components.forEach(({ component }, hash) => {
          if (this.renderer.visibleHashes.has(hash))
            this.renderer.updateComponent(component);
        });
      };

      const emptyQueue = Object.freeze([]);
      const worker = new Proxy(
        {
          ...this.workerState,
          online: navigator.onLine,
          responsive: false,
          registration: null as ServiceWorkerRegistration | null,
          installation: null as Event | null,
          queues: new Proxy({} as Record<string, any[]>, {
            set: (t, k, v) => {
              t[k as string] = v;
              update();
              return true;
            },
            get: (t, k) => t[k as string] ?? emptyQueue,
          }),
        },
        {
          set: (t, k, v) => {
            if (t[k as string] !== v) {
              t[k as string] = v;
              update();
            }
            return true;
          },
        },
      );

      this.context.worker = worker;

      if (worker.enabled) {
        const dev = !this.context.fingerprint;

        const register = async () => {
          if (!("serviceWorker" in navigator)) return;
          try {
            worker.registration = await navigator.serviceWorker.register(
              "/service-worker.js",
              { scope: "/" },
            );
            if (dev) await worker.registration.unregister();
          } catch (error) {
            console.error(error);
          }
        };

        window.addEventListener("beforeinstallprompt", (event) => {
          event.preventDefault();
          worker.installation = event;
        });

        window.addEventListener("online", () => {
          worker.online = true;
          if (worker.mode === "ssg") void this.renderRoute(location.pathname);
          else worker.responsive = true;
        });

        window.addEventListener("offline", () => {
          worker.online = false;
        });

        register();
      }
    }
  }

  mount(
    ComponentClass: typeof Newstack,
    _root?: HTMLElement,
  ): { destroy: () => void } {
    if (!ComponentClass.hash) {
      (ComponentClass as any).hash = Math.random().toString(36).slice(2, 10);
    }

    const container = _root ?? document.createElement("div");
    if (!_root) this.root.appendChild(container);

    const component = this.renderer.mount(ComponentClass, container);

    if (!this.app) {
      this.app = component;
      this.mounted = true;
      this.patchLinks();
    }

    this.assignElements();

    void (async () => {
      const vnode = component.render(this.context);
      this.renderer.extractParams(vnode);

      await component.prepare?.(this.context);

      for (const [hash, { component: c }] of this.renderer.components) {
        if (hash === ComponentClass.hash || !this.renderer.visibleHashes.has(hash)) continue;
        (c as any).__preparing = true;
        await c.prepare?.(this.context);
        (c as any).__preparing = false;
        c.prepared = true;
      }

      this.renderer.updateComponent(component);

      await component.hydrate?.(this.context);

      for (const [hash, { component: c }] of this.renderer.components) {
        if (hash === ComponentClass.hash || !this.renderer.visibleHashes.has(hash)) continue;
        (c as any).__hydrating = true;
        await c.hydrate?.(this.context);
        (c as any).__hydrating = false;
        c.hydrated = true;
      }
    })();

    return {
      destroy: () => {
        const hash = ComponentClass.hash;
        component.destroy?.(this.context);
        component.terminate?.(this.context);
        this.renderer.components.delete(hash);
        this.renderer.visibleHashes.delete(hash);
        this.renderer.componentElements.delete(hash);
        container.remove();
      },
    };
  }

  /**
   * @description
   * Renders a specific route in the Newstack application.
   * This function prepares the application context, renders the HTML for the current route,
   * and hydrates the components. It also patches links to handle client-side navigation.
   *
   * @param href The URL path to render.
   */
  async renderRoute(href: string) {
    if (!this.app) return;

    this.context.path = href;

    if (this.mounted) {
      const vnode = this.app.render(this.context);
      this.renderer.extractParams(vnode);

      for (const [hash, { component }] of this.renderer.components) {
        if (!this.renderer.visibleHashes.has(hash)) continue;
        await component.prepare?.(this.context);
      }
      this.renderer.updateComponent(this.app);
      return;
    }

    this.destroyComponents();

    const html = this.app.render?.(this.context) || {};
    if (!html) {
      console.error("No HTML returned from the application render method.");
      return;
    }

    this.renderer.patchRoute(html, this.root);

    this.assignElements();

    await this.startComponents();
  }

  /**
   * @description
   * Patches links in the application to handle client-side navigation.
   * This function adds click event listeners to all anchor tags (`<a>`) in the document
   * to prevent the default browser behavior and instead use the Newstack application's routing.
   * It also listens for the `popstate` event to handle back/forward navigation.
   */
  private patchLinks() {
    document.addEventListener("click", (e) => {
      const link = (e.target as Element).closest("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href) return;

      const target = link.getAttribute("target");
      const isExternal =
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("//");
      const isSpecial =
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:");

      if (
        target === "_blank" ||
        target === "_parent" ||
        target === "_top" ||
        isExternal ||
        isSpecial
      )
        return;

      e.preventDefault();
      history.pushState({}, "", href);
      void this.renderRoute(href);
    });

    window.addEventListener("popstate", () => {
      void this.renderRoute(location.pathname);
    });
  }

  /**
   * @description
   * Assigns HTML elements to their corresponding Newstack components.
   * This function finds all components in the renderer, queries the DOM for their associated elements,
   * and updates the component's element reference. It also calls the component's update method.
   *
   */
  private assignElements() {
    const components = this.routeComponents();
    for (const component of components) {
      const { hash } = component.constructor as unknown as { hash: string };
      const element = this.root.querySelector(`[data-newstack="${hash}"]`);
      if (!element) continue;

      element.removeAttribute("data-newstack");
      this.renderer.componentElements.set(hash, element);
      this.renderer.updateComponent(component);
    }
  }

  /**
   * @description
   * Destroys all visible components in the renderer and set them as invisible.
   * This function iterates through the components map and calls the destroy method
   * on each component that is currently visible. It then marks the component as not visible.
   * This is used when changing routes.
   */
  private destroyComponents() {
    const components = this.routeComponents();

    for (const component of components) {
      const hash = (component.constructor as any).hash as string;
      if (this.renderer.persistentHashes.has(hash)) continue;
      component.destroy?.(this.context);
      component.terminate?.(this.context);
    }

    for (const hash of this.renderer.visibleHashes) {
      if (!this.renderer.persistentHashes.has(hash)) {
        this.renderer.visibleHashes.delete(hash);
      }
    }
  }

  /**
   * @description
   * Starts all visible components in the renderer that are visible.
   * This function prepares and hydrates all components that are currently visible in the route.
   * It is called after rendering a new route to ensure that all components are ready for interaction.
   */
  private async startComponents() {
    const components = this.routeComponents();

    for (const component of components) {
      const hash = (component.constructor as any).hash as string;
      if (this.renderer.persistentHashes.has(hash) && component.hydrated)
        continue;

      (component as any).__preparing = true;
      await component.prepare?.(this.context);
      (component as any).__preparing = false;
      component.prepared = true;

      (component as any).__hydrating = true;
      await component.hydrate?.(this.context);
      (component as any).__hydrating = false;
      component.hydrated = true;
    }
  }

  /**
   * @description
   * Returns an array of all components that are currently visible in the route.
   * This function iterates through the renderer's allComponents map and collects
   * components that are marked as visible. It is used to manage the lifecycle of components
   * when rendering a new route.
   *
   * @returns {Newstack[]} An array of visible Newstack components.
   */
  private routeComponents() {
    const components: Newstack[] = [];

    this.renderer.components.forEach(({ component }, hash) => {
      if (hash === (this.app.constructor as typeof Newstack).hash) {
        // Skip the entrypoint component
        return;
      }

      if (!this.renderer.visibleHashes.has(hash)) return;

      components.push(component);
    });

    return components;
  }
}
