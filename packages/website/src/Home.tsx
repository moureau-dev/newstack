/* ---------- External ---------- */
import Newstack, { NewstackClientContext } from "@moureau/newstack";

const LLMS_URL = "https://newstack.moureau.dev/llms.txt";

const AI_OPTIONS = [
  { label: "Copy llms.txt URL", action: "copy" },
  {
    label: "Open in ChatGPT",
    href: `https://chatgpt.com/?q=${encodeURIComponent(`Read ${LLMS_URL} and help me build with Newstack`)}`,
  },
  {
    label: "Open in Claude",
    href: `https://claude.ai/new?q=${encodeURIComponent(`Read ${LLMS_URL} and help me build with Newstack`)}`,
  },
];

export class Home extends Newstack {
  /* ---------- Proxies ---------- */
  copied: boolean;
  tailwind: boolean;
  cmd: string = "bunx create-newstack-app my-app";
  llmsOpen: boolean;
  llmsCopied: boolean;

  /* ---------- Refs ---------- */
  menuWrapper: HTMLDivElement;

  /* ---------- Lifecycle ---------- */
  prepare({ page }) {
    page.title = "Newstack";
    page.description =
      "A modern web framework for building fast, reactive applications with zero runtime overhead.";
  }

  update() {
    this.cmd = this.tailwind
      ? "bunx create-newstack-app my-app --tailwind"
      : "bunx create-newstack-app my-app";
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

  async copyLlmsUrl() {
    await navigator.clipboard.writeText(LLMS_URL);
    this.llmsCopied = true;
    this.llmsOpen = false;
    setTimeout(() => (this.llmsCopied = false), 2000);
  }

  render() {
    return (
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
              href="/llms.txt"
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
                {this.llmsCopied ? "Copied!" : "Use with AI ↓"}
              </button>
              {this.llmsOpen && (
                <div class="home__llms-dropdown">
                  {AI_OPTIONS.map((opt) =>
                    opt.action ? (
                      <button class="home__llms-option" onclick={this.copyLlmsUrl}>
                        {opt.label}
                      </button>
                    ) : (
                      <a
                        class="home__llms-option"
                        href={opt.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
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
    );
  }
}
