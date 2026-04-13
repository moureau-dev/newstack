import type { NewstackClient } from "./client";
import type { NewstackClientContext, NewstackServerContext } from "./core";

export function proxifyContext(
  ctx: Partial<NewstackClientContext & NewstackServerContext>,
  client?: NewstackClient,
): Partial<NewstackClientContext & NewstackServerContext> {
  const page = new Proxy(ctx.page, {
    get(target, prop) {
      return Reflect.get(target, prop);
    },
    set(target, prop, val) {
      if (ctx.environment === "server") {
        target[prop] = val;
        return true;
      }

      if (prop === "title" && typeof val === "string") {
        document.title = val;
      }

      if (prop === "locale" && typeof val === "string") {
        document.documentElement.lang = val;
      }

      if (prop === "description" && typeof val === "string") {
        let meta = document.querySelector("meta[name='description']");
        if (!meta) {
          meta = document.createElement("meta");
          meta.setAttribute("name", "description");
          document.head.appendChild(meta);
        }
        meta.setAttribute("content", val);
      }

      if (prop === "image" && typeof val === "string") {
        for (const selector of [
          "meta[property='og:image']",
          "meta[name='twitter:image']",
        ]) {
          let meta = document.querySelector(selector);
          if (!meta) {
            meta = document.createElement("meta");
            const [attr, value] = selector.includes("property")
              ? ["property", "og:image"]
              : ["name", "twitter:image"];
            meta.setAttribute(attr, value);
            document.head.appendChild(meta);
          }
          meta.setAttribute("content", val);
        }
      }

      target[prop] = val;
      return true;
    },
  });

  const router = new Proxy(ctx.router, {
    get(target, prop) {
      if (prop === "path") {
        return ctx.path;
      }

      if (prop === "url") {
        if (ctx.environment === "server") {
          return new URL(ctx.path, "http://localhost").href;
        }

        return new URL(ctx.path, window.location.origin).href;
      }

      return Reflect.get(target, prop);
    },
    set(obj, key, val) {
      if (ctx.environment === "server") {
        obj[key] = val;
        return true;
      }

      if (key === "path" && typeof val === "string") {
        history.pushState({}, "", val);
        client.renderRoute(val);
      }

      obj[key] = val;
      return true;
    },
  });

  const params = new Proxy(ctx.params, {
    get(target, prop) {
      return Reflect.get(target, prop);
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  });

  const settings = new Proxy({} as NonNullable<typeof ctx.settings>, {
    get(_, prop) {
      return Reflect.get(ctx.settings ?? {}, prop);
    },
    set(_, prop, value) {
      if (!ctx.settings) ctx.settings = {};
      ctx.settings[prop as string] = value;
      if (client) {
        client.renderer.components.forEach(({ component }, hash) => {
          if (client.renderer.visibleHashes.has(hash)) {
            client.renderer.updateComponent(component);
          }
        });
      }
      return true;
    },
  });

  return new Proxy(ctx, {
    get(target, prop) {
      if (!(prop in target)) {
        return Reflect.get(ctx, prop);
      }

      const value = target[prop];
      if (typeof value === "function") return value.bind(ctx);

      if (typeof value === "object" && value !== null) {
        if (prop === "page") return page;
        if (prop === "router") return router;
        if (prop === "params") return params;
        if (prop === "settings") return settings;
      }

      return value;
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  });
}
