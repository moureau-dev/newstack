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
        for (const [attr, name] of [
          ["property", "og:title"],
          ["name", "twitter:title"],
        ] as const) {
          let meta = document.querySelector(`meta[${attr}='${name}']`);
          if (!meta) {
            meta = document.createElement("meta");
            meta.setAttribute(attr, name);
            document.head.appendChild(meta);
          }
          meta.setAttribute("content", val);
        }
      }

      if (prop === "locale" && typeof val === "string") {
        document.documentElement.lang = val;
      }

      if (prop === "description" && typeof val === "string") {
        for (const [attr, name] of [
          ["name", "description"],
          ["property", "og:description"],
          ["name", "twitter:description"],
        ] as const) {
          let meta = document.querySelector(`meta[${attr}='${name}']`);
          if (!meta) {
            meta = document.createElement("meta");
            meta.setAttribute(attr, name);
            document.head.appendChild(meta);
          }
          meta.setAttribute("content", val);
        }
      }

      if (prop === "image" && typeof val === "string") {
        for (const [attr, name] of [
          ["property", "og:image"],
          ["name", "twitter:image"],
        ] as const) {
          let meta = document.querySelector(`meta[${attr}='${name}']`);
          if (!meta) {
            meta = document.createElement("meta");
            meta.setAttribute(attr, name);
            document.head.appendChild(meta);
          }
          meta.setAttribute("content", val);
        }

        let card = document.querySelector("meta[name='twitter:card']");
        if (!card) {
          card = document.createElement("meta");
          card.setAttribute("name", "twitter:card");
          document.head.appendChild(card);
        }
        card.setAttribute("content", val ? "summary_large_image" : "summary");
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

        const pageUrl = new URL(val, window.location.origin).href;
        for (const selector of ["link[rel='canonical']", "meta[property='og:url']"]) {
          const el = document.querySelector(selector);
          if (el) el.setAttribute(selector.startsWith("link") ? "href" : "content", pageUrl);
        }
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
