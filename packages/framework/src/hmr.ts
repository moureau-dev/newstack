import type { Hono } from "hono/tiny";
import { watch as watchFs } from "fs";

/**
 * Manages HMR (Hot Module Replacement) for the dev server.
 * Owns the set of connected SSE clients and the dist directory watcher.
 * Compose into NewstackServer by passing the Hono instance and dist path.
 */
export class HmrManager {
  private readonly clients = new Set<(data: string) => void>();
  private readonly startTime = Date.now();

  constructor(
    private readonly server: Hono,
    private readonly distDir: string,
  ) {}

  notify(data: object): void {
    const msg = JSON.stringify(data);
    for (const send of this.clients) {
      try {
        send(msg);
      } catch {
        this.clients.delete(send);
      }
    }
  }

  setup(): void {
    const encoder = new TextEncoder();

    this.server.get("/hmr", (_c) => {
      let clientSend: ((data: string) => void) | null = null;

      const body = new ReadableStream({
        start: (controller) => {
          clientSend = (data: string) => {
            try {
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } catch {
              // connection already closed
            }
          };
          this.clients.add(clientSend);

          // Connections arriving >500ms after server start are reconnects
          // (not initial page loads). Push a JS update immediately so the
          // browser hot-swaps without requiring a manual reload.
          if (Date.now() - this.startTime > 500) {
            setTimeout(() => clientSend?.(JSON.stringify({ type: "js" })), 50);
          }
        },
        cancel: () => {
          if (clientSend) this.clients.delete(clientSend);
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

    const pending = new Set<string>();
    let debounce: ReturnType<typeof setTimeout> | null = null;

    watchFs(this.distDir, (_, filename) => {
      if (!filename) return;
      if (filename === "client.css") pending.add("css");
      else if (filename.startsWith("client") && filename.endsWith(".js"))
        pending.add("js");
      else return;

      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        for (const type of pending) this.notify({ type });
        pending.clear();
        debounce = null;
      }, 100);
    });
  }

  clientInjection(): string {
    if (process.env.NEWSTACK_WATCH !== "true") return "";

    return `<script type="module">
    async function doJsHmr() {
      await import('/client.js?t=' + Date.now());
      if (window.__NEWSTACK && window.__NEWSTACK_PENDING) {
        window.__NEWSTACK.renderer.hmrUpdate(window.__NEWSTACK_PENDING);
        window.__NEWSTACK_PENDING = null;
      }
    }

    function connectHmr() {
      const es = new EventSource('/hmr');
      es.onmessage = async (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'css') {
          const link = document.querySelector('link[rel="stylesheet"]');
          if (link) link.href = link.href.split('?')[0] + '?t=' + Date.now();
        } else if (msg.type === 'js') {
          await doJsHmr();
        }
      };
      es.onerror = () => {
        es.close();
        setTimeout(connectHmr, 1000);
      };
    }
    connectHmr();
  </script>`;
  }
}
