export class HeadManager {
  private injections: { html: string; hash: string | null }[] = [];
  private cache: Map<string, string> = new Map();
  currentHash: string | null = null;

  collect(html: string): void {
    if (html) this.injections.push({ html, hash: this.currentHash });
  }

  reset(): void {
    this.injections = [];
  }

  clearFor(hash: string): void {
    this.injections = this.injections.filter((i) => i.hash !== hash);
  }

  /** Returns tagged HTML for the server <head> template. */
  serverHtml(): string {
    return this.injections
      .map(({ html, hash }) =>
        html
          .trim()
          .replace(
            /^(<[a-zA-Z][a-zA-Z0-9-]*)/,
            `$1 data-newstack-head="${hash ?? ""}"`,
          ),
      )
      .join("\n");
  }

  /** Flushes injections into document.head. Scoped = one component; unscoped = full route flush. */
  flush(scope?: string): void {
    if (typeof document === "undefined") return;

    const injections =
      scope !== undefined
        ? this.injections.filter((i) => i.hash === scope)
        : this.injections;

    const selector =
      scope !== undefined
        ? `[data-newstack-head="${scope}"]`
        : "[data-newstack-head]";

    if (injections.length === 0) {
      if (scope !== undefined) {
        if (this.cache.has(scope)) {
          this.cache.delete(scope);
          document.head.querySelectorAll(selector).forEach((el) => el.remove());
        }
      } else {
        this.cache.clear();
        document.head.querySelectorAll(selector).forEach((el) => el.remove());
      }
      return;
    }

    if (scope !== undefined) {
      const key = injections.map((i) => i.html).join("|");
      if (this.cache.get(scope) === key) return;
      this.cache.set(scope, key);
    } else {
      this.cache.clear();
    }

    document.head.querySelectorAll(selector).forEach((el) => el.remove());

    for (const { html, hash } of injections) {
      const temp = document.createElement("div");
      temp.innerHTML = html;
      for (const child of Array.from(temp.children)) {
        let el: Element;
        if (child.tagName === "SCRIPT") {
          el = document.createElement("script");
          for (const attr of Array.from(child.attributes))
            el.setAttribute(attr.name, attr.value);
          el.textContent = child.textContent;
        } else {
          el = child;
        }
        el.setAttribute("data-newstack-head", hash ?? "");
        document.head.appendChild(el);
      }
    }

    if (scope === undefined) this.injections = [];
  }
}
