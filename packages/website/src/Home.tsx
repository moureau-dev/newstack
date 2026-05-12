/* ---------- External ---------- */
import Newstack, { NewstackClientContext } from "@moureau/newstack";

const LLMS_URL = "/llms.txt";

const IconOpenAI = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L4.01 14.3A4.501 4.501 0 0 1 2.34 7.896zm16.597 3.855-5.833-3.387 2.02-1.168a.076.076 0 0 1 .071 0l4.808 2.777a4.5 4.5 0 0 1-.676 8.137v-5.678a.79.79 0 0 0-.39-.681zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.807-2.774a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
  </svg>
);

const IconClaude = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.304 1.273a9.285 9.285 0 0 1 5.478 8.516c0 3.699-2.167 6.916-5.32 8.425l-5.222 2.463c-2.215 1.044-4.699.976-6.84-.185a9.283 9.283 0 0 1-4.686-7.282l-.011-.37c0-3.157 1.585-6.05 4.235-7.77L9.64 2.756C11.783 1.391 14.488 1.08 17.304 1.273zm-4.199 4.885L8.763 8.82c-1.456.687-2.39 2.162-2.39 3.784v.066c0 1.409.699 2.72 1.868 3.509l4.864-2.293c1.456-.687 2.39-2.162 2.39-3.784v-.066c0-1.409-.699-2.72-1.868-3.509l-.522.246z" />
  </svg>
);

const AI_OPTIONS = [
  { label: "Copy llms.txt", action: "copy", icon: "clipboard" },
  {
    label: "Open in ChatGPT",
    href: `https://chatgpt.com/?q=${encodeURIComponent(`Read https://newstack.moureau.dev/llms.txt and help me build with Newstack`)}`,
    Icon: IconOpenAI,
  },
  {
    label: "Open in Claude",
    href: `https://claude.ai/new?q=${encodeURIComponent(`Read https://newstack.moureau.dev/llms.txt and help me build with Newstack`)}`,
    Icon: IconClaude,
  },
];

export class Home extends Newstack {
  /* ---------- Proxies ---------- */
  copied: boolean;
  tailwind: boolean;
  cmd: string = "bunx create-newstack-app my-app";
  llmsOpen: boolean;
  llmsCopied: boolean;
  llmsLoading: boolean;

  /* ---------- Refs ---------- */
  menuWrapper: HTMLDivElement;

  /* ---------- Lifecycle ---------- */
  prepare({ page }) {
    page.title = "Newstack";
    page.description =
      "A modern web framework for building fast, reactive applications with zero runtime overhead.";
  }

  hydrate() {
    if (typeof window !== "undefined" && (window as any).lucide) {
      (window as any).lucide.createIcons();
    }
  }

  update() {
    this.cmd = this.tailwind
      ? "bunx create-newstack-app my-app --tailwind"
      : "bunx create-newstack-app my-app";

    if (typeof window !== "undefined" && (window as any).lucide) {
      requestAnimationFrame(() => (window as any).lucide.createIcons());
    }
  }

  /* ---------- Methods ---------- */
  async copy() {
    await navigator.clipboard.writeText(this.cmd);
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }

  toggleLlmsMenu() {
    this.llmsOpen = !this.llmsOpen;
  }

  closeLlmsMenu({ event }: NewstackClientContext) {
    if (this.menuWrapper?.contains(event.target as Node)) return;
    this.llmsOpen = false;
  }

  async copyLlmsContent() {
    this.llmsLoading = true;
    try {
      const res = await fetch(LLMS_URL);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      this.llmsCopied = true;
      this.llmsOpen = false;
      setTimeout(() => (this.llmsCopied = false), 2000);
    } finally {
      this.llmsLoading = false;
    }
  }

  render() {
    return (
      <>
        <head>
          <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js" />
        </head>
        <div class="home" onclick={this.closeLlmsMenu}>
          <div class="home__content">
            <h1 class="home__title">
              Build fast.<br />Stay lean.
            </h1>
            <p class="home__subtitle">
              A minimal <a href="https://nullstack.app" target="_blank">Nullstackative</a> web framework with proxy-based reactivity,
              <br />zero virtual DOM, and SSR/SSG/SPA build modes out of the box.
            </p>

            <div class="home__command-wrapper">
              <div class="home__tabs">
                <button
                  class={`home__tab${!this.tailwind ? " home__tab--active" : ""}`}
                  onclick={() => (this.tailwind = false)}
                >
                  Default
                </button>
                <button
                  class={`home__tab${this.tailwind ? " home__tab--active" : ""}`}
                  onclick={() => (this.tailwind = true)}
                >
                  + Tailwind
                </button>
              </div>
              <div class="home__command">
                <code class="home__code">{this.cmd}</code>
                <button class="home__copy" onclick={this.copy}>
                  {this.copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div class="home__llms-row">
              <a
                class="home__llms"
                href={LLMS_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                llms.txt
              </a>
              <div class="home__llms-menu-wrapper" ref={this.menuWrapper}>
                <button
                  class={`home__llms-trigger${this.llmsOpen ? " home__llms-trigger--open" : ""}`}
                  onclick={this.toggleLlmsMenu}
                >
                  {this.llmsCopied
                    ? <><i data-lucide="check" class="lucide-icon" /> Copied!</>
                    : "Vibe with Newstack ↓"}
                </button>
                {this.llmsOpen && (
                  <div class="home__llms-dropdown">
                    {AI_OPTIONS.map((opt) =>
                      opt.action ? (
                        <button
                          class="home__llms-option"
                          onclick={this.copyLlmsContent}
                          disabled={this.llmsLoading}
                        >
                          {this.llmsLoading
                            ? <i data-lucide="loader-circle" class="lucide-icon spin" />
                            : <i data-lucide="clipboard" class="lucide-icon" />}
                          {this.llmsLoading ? "Fetching…" : opt.label}
                        </button>
                      ) : (
                        <a
                          class="home__llms-option"
                          href={opt.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <opt.Icon />
                          {opt.label}
                        </a>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
}
