import type { Newstack, NewstackClientContext } from "./core";

type VNode = {
  type: string | ((...args: unknown[]) => unknown);
  props?: Record<string, unknown> & {
    route?: string;
    children?: VNode | VNode[];
  };
};

export class Renderer {
  /**
   * @description
   * The context object that holds the current state of the application,
   * such as the current path and other relevant data.
   * This context is used to determine how components should be rendered
   * based on the current application state.
   */
  context: NewstackClientContext;

  /**
   * @description
   * A set of all Newstack components that have been defined in the application.
   * This includes components that have not yet been rendered.
   */
  components: Map<string, { component: Newstack; reinitiate: () => Newstack }>;

  /**
   * @description
   * A set of hashes representing the components that are currently visible in the application.
   * This is used to track which components should be rendered based on the current route.
   */
  visibleHashes: Set<string> = new Set();

  /**
   * @description
   * A map that associates Newstack components with their corresponding HTML elements.
   * This is used to update the DOM when component properties change.
   */
  componentElements: Map<string, Element>;
  lastVNode: any;
  private isUpdating = false;

  constructor(context: NewstackClientContext = {} as NewstackClientContext) {
    this.context = context;
    this.components = new Map();
    this.componentElements = new Map();
  }

  get hashes(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * @description
   * Performs a hot module replacement update by swapping the prototype of each
   * live component instance to the corresponding class from the newly imported
   * bundle, then re-renders all visible components in place.
   *
   * State stored on instances is preserved; only methods/render are updated.
   *
   * @param newApp The newly-imported application instance (from re-imported bundle).
   */
  hmrUpdate(newApp: Newstack) {
    // Collect new class constructors by traversing the new app's vnode tree
    const newClasses = new Map<string, typeof Newstack>();

    // Include the application entrypoint class itself
    const appHash = (newApp.constructor as any).hash as string;
    if (appHash)
      newClasses.set(appHash, newApp.constructor as unknown as typeof Newstack);

    const traverse = (vnode: VNode) => {
      if (!vnode || typeof vnode !== "object") return;
      const { type, props } = vnode;

      // Duck-type on .hash instead of instanceof — the re-imported bundle
      // brings a different Newstack class reference (different module URL),
      // so instanceof would fail intermittently when the shared chunk is
      // rebuilt and no longer cached under the same URL.
      if (typeof type === "function" && (type as any).hash) {
        const hash = (type as any).hash as string;
        newClasses.set(hash, type as unknown as typeof Newstack);
        const inst = new (type as any)();
        if (isRenderableComponent(inst)) {
          traverse(inst.render(this.context));
        }
      }

      if (Array.isArray(props?.children)) {
        for (const child of props.children) traverse(child);
      } else if (props?.children) {
        traverse(props.children as VNode);
      }
    };

    if (isRenderableComponent(newApp)) {
      traverse(newApp.render(this.context));
    }

    // Swap prototypes and update reinitiate closures
    for (const [hash, entry] of this.components) {
      const NewClass = newClasses.get(hash);
      if (!NewClass) continue;

      // Object.setPrototypeOf propagates through the proxy chain (no
      // setPrototypeOf trap defined in either Newstack or proxify proxies),
      // ultimately updating the raw instance's prototype.
      Object.setPrototypeOf(entry.component, NewClass.prototype);

      // Update reinitiate so future route re-renders use the new class
      entry.reinitiate = () => {
        const c = proxify(
          new (NewClass as unknown as new () => Newstack)(),
          this,
        );
        this.components.get(hash).component = c;
        return c;
      };

      // Re-render visible components immediately
      if (this.visibleHashes.has(hash)) {
        this.updateComponent(entry.component);
      }
    }
  }

  /**
   * @description
   * Finds a Newstack component by its static hash property.
   * This function iterates through the components map and checks if the
   * component's constructor has a matching hash. If found, it returns the component.
   *
   * @param hash The hash of the component to find.
   * @returns The Newstack component if found, otherwise null.
   */
  findComponentByHash(hash: string): Newstack {
    for (const [_, { component: c }] of this.components) {
      const component = c.constructor as typeof Newstack<{ hash: string }>;
      if (!component) continue;

      if (component.hash === hash) return c;
    }

    return null;
  }

  /**
   * @description
   * Renders a Newstack component tree to HTML.
   * This function recursively traverses the component tree, converting each component
   * and its properties into an HTML string. It handles both standard HTML elements
   * and Newstack components, allowing for dynamic rendering based on the current context.
   *
   * @param node The component or element to render.
   * @returns A string representing the rendered HTML.
   */
  html(node: VNode): string {
    if (typeof node === "string" || typeof node === "number")
      return String(node);
    if (node === null || typeof node !== "object") return "";

    const { type, props } = node;

    // Skip rendering if the route does not match
    if (props?.route) {
      const matchAll = props.route === "*";
      const matchPath = matchRoute(props.route, this.context);

      if (!matchAll && !matchPath) {
        // Skip with an HTML comment for context router.path changing
        return "<!---->";
      }
    }

    // Plain function component — call it with props and render the result
    if (typeof type === "function" && !(type as any).hash) {
      return this.html((type as (p: unknown) => VNode)(props ?? {}));
    }

    const isComponent = isComponentNode(node);

    // Rendering Newstack components
    if (isComponent) {
      const { hash } = type as unknown as { hash: string };
      let { component, reinitiate } = this.components.get(hash);
      if (this.context.environment === "client" && !this.isUpdating) {
        component = reinitiate();

        if (!this.lastVNode) {
          // First render in the client
          const snapshots = document.querySelector<HTMLScriptElement>(
            "script#__NEWSTACK_STATE__",
          );

          if (snapshots) {
            const states = JSON.parse(snapshots.textContent || "{}");
            this.addSnapshotStateData(component, states);
          }
        }
      }

      const isRenderable = isRenderableComponent(component);

      if (isRenderable) {
        const vnode = component.render?.(this.context);

        // Only add to visibleHashes if component will actually render (not as comment)
        this.visibleHashes.add(hash);

        if (this.context.environment === "client") {
          if (!vnode.props) {
            vnode.props = {};
          }
          vnode.props["data-newstack"] = hash;
        }

        const node = this.html(vnode);
        return node;
      }
    }

    const children = Array.isArray(props?.children)
      ? props.children.map((c) => this.html(c)).join("")
      : this.html(props?.children);

    const attrs = Object.entries(props || {})
      .filter(([key]) => !["route", "children", "bind"].includes(key))
      .filter(([key, val]) => {
        const isFunc = typeof val === "function";

        return !isFunc;
      })
      .map(([key, val]) => ` ${key}="${val}"`)
      .join("");

    let bindAttr = "";
    if (props?.bind && typeof props.bind === "object") {
      const { object, property } = props.bind as {
        object: Record<string, unknown>;
        property: string;
      };
      const value = object[property];
      if (props?.type === "checkbox") {
        if (value) bindAttr = " checked";
      } else {
        bindAttr = ` value="${value ?? ""}"`;
      }
    }

    return `<${type}${attrs}${bindAttr}>${children}</${type}>`;
  }

  /**
   * @description
   * Adds state data from a snapshot to a Newstack component.
   * This function retrieves the state from the provided states object using the component's hash
   * and assigns the state properties to the component instance.
   *
   * @param component The Newstack component to which the state data should be added.
   * @param states An object containing state data indexed by component hashes.
   */
  addSnapshotStateData(
    component: Newstack,
    states: Record<string, { state: unknown }>,
  ) {
    const { hash } = component.constructor as typeof Newstack;
    const entry = states[hash];

    if (!entry?.state) return;

    for (const [key, value] of Object.entries(entry.state)) {
      this.components.get(hash).component[key] = value;
    }
  }

  /**
   * @description
   * Patches an existing route in the DOM with a new virtual node.
   * This function updates the HTML of the container element with the new virtual node,
   * replacing the old content while preserving the structure and attributes of the existing elements.
   *
   * @param newVNode The new virtual node to render.
   * @param container The HTML element where the new virtual node should be rendered.
   */
  patchRoute(newVNode: VNode, container: Element) {
    if (!this.lastVNode) {
      container.innerHTML = this.html(newVNode);
      this.lastVNode = newVNode;
      return;
    }

    const temp = document.createElement("div");
    temp.innerHTML = this.html(newVNode);
    const newEl = temp.firstElementChild;
    const oldEl = container.firstElementChild;

    if (newEl && oldEl) {
      patchElement(oldEl, newEl, newVNode, () => {});
    }

    this.lastVNode = newVNode;
  }

  /**
   * @description
   * Updates a Newstack component in the DOM.
   * This function finds the HTML element associated with the component,
   * renders the component to a new HTML string, and then patches the existing
   * element with the new HTML.
   *
   * @param component The Newstack component to update.
   */
  updateComponent(component: Newstack) {
    if (typeof document === "undefined") return;

    const staticComponent = component.constructor as typeof Newstack;

    const container = this.componentElements.get(staticComponent.hash);
    if (!container) return;

    this.isUpdating = true;
    const vnode = component.render(this.context);
    const html = this.html(vnode);
    this.isUpdating = false;

    const temp = document.createElement("div");
    temp.innerHTML = html;

    const newEl = temp.firstElementChild;
    if (!newEl) return;

    patchElement(container, newEl, vnode, () =>
      this.updateComponent(component),
    );
  }

  /**
   * @description
   * Sets up all components in the application, including the entrypoint component and its children.
   * This function initializes the components, creates proxies for them to ensure reactivity,
   * and recursively processes child components to add them to the renderer's component list.
   *
   * @param entrypoint The main entrypoint component of the application.
   * @param context The context object that holds the current state of the application.
   */
  setupAllComponents(entrypoint: Newstack) {
    /**
     * Sets up the entrypoint component as part of the renderer's components.
     */
    const setupEntrypoint = () => {
      const entrypointHash = (entrypoint.constructor as typeof Newstack).hash;
      const reinitiate = () => {
        const component = proxify(new (entrypoint.constructor as any)(), this);
        this.components.get(entrypointHash).component = component;
        return component;
      };

      this.components.set(entrypointHash, {
        component: proxify(entrypoint, this),
        reinitiate,
      });
    };

    /**
     * Sets up all child components recursively from a given virtual node.
     * This function traverses the virtual node tree, identifies Newstack components,
     * and adds them to the renderer's components map. It also handles the creation
     * of proxies for each component to ensure reactivity.
     *
     * @param vnode The virtual node to start processing from.
     */
    const setupChildrenRecursively = (vnode: VNode) => {
      const loop = (node: VNode) => {
        if (!node) return;
        if (typeof node !== "object") return;

        const { type, props } = node;

        if (isComponentNode(node)) {
          const hash = (type as unknown as { hash: string }).hash;
          const createComponent = () => proxify(new (type as any)(), this);
          const component = createComponent();
          const reinitiate = () => {
            const c = createComponent();
            this.components.get(hash).component = createComponent();
            return c;
          };

          this.components.set(hash, { component, reinitiate });

          if (isRenderableComponent(component)) {
            loop(component.render(this.context));
          }
        }

        if (Array.isArray(props?.children)) {
          for (const child of props.children) {
            loop(child);
          }

          return;
        }

        loop(props.children);
      };

      loop(vnode);
    };

    /**
     * Goes through all the tree and sets up the default visible hashes.
     */
    const setupDefaultVisibleHashes = (vnode: VNode) => {
      const loop = (node: VNode) => {
        if (!node || typeof node !== "object") return;

        const { type, props } = node;

        if (isComponentNode(node)) {
          const hash = (type as unknown as { hash: string }).hash;
          this.visibleHashes.add(hash);
        }

        if (Array.isArray(props?.children)) {
          for (const child of props.children) {
            loop(child);
          }
          return;
        }

        loop(props.children);
      };

      loop(vnode);
    };

    // Adding the entrypoint component to the components list
    setupEntrypoint();
    if (!isRenderableComponent(entrypoint)) return;

    const vnode = entrypoint.render(this.context);

    // Adding entrypoint children components to the components list
    setupChildrenRecursively(vnode);
    setupDefaultVisibleHashes(vnode);
  }
}

/**
 * @description
 * Creates a proxy for a Newstack component that automatically updates the component
 * when its properties are accessed or changed. This proxy intercepts property
 * access and modification, ensuring that the component is re-rendered whenever
 * its state changes. This is useful for maintaining reactivity in the application.
 *
 * @param component The Newstack component to be proxified.
 * @param renderer The renderer instance that will handle updates to the component.
 */
function proxify(component: Newstack, renderer: Renderer): Newstack {
  const proxy = new Proxy(component, {
    get(target, key) {
      const val = Reflect.get(target, key);

      // Intercept render() to stash the context in target.__ctx before every
      // call. Event handlers produced by MethodBindTransform read this.__ctx
      // so they receive the current context regardless of how the render
      // parameter is named (or whether it's declared at all).
      if (key === "render" && typeof val === "function") {
        return (...args: unknown[]) => {
          (target as any).__ctx = args[0];
          return (val as (...a: unknown[]) => unknown).apply(proxy, args);
        };
      }

      return val;
    },
    set(target, key, value) {
      target[key] = value;

      // Pass proxy (not raw target) so render's `this` stays the proxy,
      // which keeps bind.object pointing at the proxy for future oninput calls.
      renderer.updateComponent(proxy);
      target.update?.(renderer.context);

      return true;
    },
  });

  return proxy;
}

/**
 * @description
 * Patches an existing HTML element with a new one.
 * This function updates the attributes of the old element to match the new element,
 * removes any attributes that are no longer present, and recursively updates the children.
 *
 * @param oldEl The existing HTML element to be patched.
 * @param newEl The new HTML element that contains the updated content.
 * @param vnode The virtual node representation of the new element, used for event listeners and other properties.
 * @param update A callback function to call after the patching is complete, typically used to trigger a re-render or update in the application.
 */
function patchElement(
  oldEl: Element,
  newEl: Element,
  vnode?: VNode,
  update: () => void = () => {},
) {
  // Update attributes
  const oldAttrs = oldEl.attributes;
  const newAttrs = newEl.attributes;

  const vnodeChildren = Array.isArray(vnode?.props?.children)
    ? vnode.props.children
    : [vnode?.props?.children];

  // Remove old attributes
  Array.from(oldAttrs).forEach((attr) => {
    if (!newEl.hasAttribute(attr.name)) {
      oldEl.removeAttribute(attr.name);
    }
  });

  // Set new or changed attributes
  Array.from(newAttrs).forEach((attr) => {
    if (oldEl.getAttribute(attr.name) !== attr.value) {
      oldEl.setAttribute(attr.name, attr.value);
    }
  });

  // Recursively patch children
  const oldChildren = Array.from(oldEl.childNodes);
  const newChildren = Array.from(newEl.childNodes);
  const len = Math.max(oldChildren.length, newChildren.length);

  // Attach event listeners from vnode to newEl
  if (vnode?.props) {
    Object.entries(vnode.props).forEach(([key, val]) => {
      if (key.startsWith("on") && typeof val === "function") {
        oldEl[key] = (e: Event) => {
          e.preventDefault();
          val(e);
          if (update) update();
        };
      }
    });
  }

  // Two-way binding: sync value from component and attach input handler
  if (vnode?.props?.bind && typeof vnode.props.bind === "object") {
    const { object, property } = vnode.props.bind as {
      object: Record<string, unknown>;
      property: string;
    };
    const el = oldEl as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (el.type === "checkbox") {
      (el as HTMLInputElement).checked = Boolean(object[property]);
      el.onchange = (e) => {
        object[property] = (e.target as HTMLInputElement).checked;
      };
    } else {
      el.value = String(object[property] ?? "");
      el.oninput = (e) => {
        const target = e.target as HTMLInputElement;
        object[property] =
          target.type === "number" ? Number(target.value) : target.value;
      };
    }
  }

  for (let i = 0; i < len; i++) {
    const oldChild = oldChildren[i];
    const newChild = newChildren[i];
    const vchild = resolveFunctionVNode(vnodeChildren[i]);

    if (!oldChild && newChild) {
      oldEl.appendChild(newChild.cloneNode(true));
      continue;
    }

    if (oldChild && !newChild) {
      oldEl.removeChild(oldChild);
      continue;
    }

    if (oldChild.nodeType !== newChild.nodeType) {
      oldEl.replaceChild(newChild.cloneNode(true), oldChild);
      continue;
    }

    if (
      oldChild.nodeType === Node.TEXT_NODE &&
      newChild.nodeType === Node.TEXT_NODE
    ) {
      if (oldChild.textContent !== newChild.textContent) {
        oldChild.textContent = newChild.textContent;
      }
      continue;
    }

    if (
      oldChild.nodeType === Node.ELEMENT_NODE &&
      newChild.nodeType === Node.ELEMENT_NODE &&
      (oldChild as Element).tagName === (newChild as Element).tagName
    ) {
      patchElement(oldChild as Element, newChild as Element, vchild, update);
    } else {
      oldEl.replaceChild(newChild.cloneNode(true), oldChild);
    }
  }
}

function matchRoute(
  routePattern: string,
  context: NewstackClientContext,
): boolean {
  const routeSegments = routePattern?.split("/").filter(Boolean) ?? [];
  const pathSegments = context.router.path?.split("/").filter(Boolean) ?? [];

  if (routeSegments.length !== pathSegments.length) return false;

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i];
    const pathSegment = pathSegments[i];

    if (routeSegment.startsWith(":")) {
      continue; // param match
    }
    if (routeSegment !== pathSegment) return false;
  }

  routeSegments.forEach((segment, index) => {
    if (!segment.startsWith(":")) return;
    const paramName = segment.slice(1);
    context.params[paramName] = pathSegments[index];
  });

  return true;
}

function resolveFunctionVNode(vnode: VNode): VNode {
  if (
    vnode &&
    typeof vnode === "object" &&
    typeof vnode.type === "function" &&
    !(vnode.type as any).hash
  ) {
    return resolveFunctionVNode(
      (vnode.type as (p: unknown) => VNode)(vnode.props ?? {}),
    );
  }
  return vnode;
}

function isComponentNode(node: VNode): boolean {
  // Duck-type on the static `.hash` property rather than using instanceof.
  // After an HMR re-import the new bundle carries a different Newstack class
  // reference (different module URL), so instanceof fails intermittently.
  // Every Newstack component gets a string `.hash` from NewstackPlugin, which
  // is a reliable and cross-bundle-safe identifier.
  return (
    typeof node.type === "function" &&
    typeof (node.type as any).hash === "string"
  );
}

function isRenderableComponent(c: Newstack): boolean {
  return c.render && typeof c.render === "function";
}
