/* ---------- External ---------- */
import Newstack, { NewstackClientContext } from "@moureau/newstack";
import { Clipboard, IconClaude, IconOpenAI, IconSpinner } from "./icons";

const LLMS_URL = "/llms.txt";

const AI_OPTIONS = [
  { label: "Copy llms.txt", action: "copy", Icon: Clipboard },
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
  llmsOpen: boolean = false;
  llmsCopied: boolean;
  llmsLoading: boolean;
  home: HTMLDivElement;

  /* ---------- Refs ---------- */
  menuWrapper: HTMLDivElement;

  /* ---------- Lifecycle ---------- */
  prepare({ page }) {
    page.title = "Newstack";
    page.description =
      "A modern web framework for building fast, reactive applications with zero runtime overhead.";
  }

  hydrate() {
    document.addEventListener('click', (event) => {
      this.closeLlmsMenu({ event })
    });
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

  closeLlmsMenu({ event }: Partial<NewstackClientContext>) {
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

  /* ---------- Renderers ---------- */
  renderCommands() {
    return (
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
    );
}

  render() {
    return (
      <>
        <div class="home" ref={this.home}>
          <div class="home__content">
            <h1 class="home__title">
              Build fast.<br />Stay lean.
            </h1>


            <p class="home__subtitle">
              A minimal <a href="https://nullstack.app" target="_blank">Nullstackative</a> web framework with proxy-based reactivity,
              <br />
              zero virtual DOM, and SSR/SSG/SPA build modes out of the box.
            </p>

            {this.renderCommands()}

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
                    ? <><i class="fa-solid fa-check" /> Copied!</>
                    : "Vibe with Newstack ↓"}
                </button>

                  <div class="home__llms-dropdown" data-visible={String(Boolean(this.llmsOpen))}>
                    {AI_OPTIONS.map((opt) =>
                      opt.action ? (
                        <button
                          class="home__llms-option"
                          onclick={this.copyLlmsContent}
                          disabled={Boolean(this.llmsLoading)}
                        >
                          {this.llmsLoading ? <IconSpinner /> : <opt.Icon />}
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
              </div>
            </div>
          </div>
        </div>
        <footer class="home__footer">
          Made with ❤️ by{' '}
          <a href="https://moureau.dev" target="_blank" rel="noopener noreferrer">
            moureau.dev
          </a>
        </footer>
      </>
    );
  }
}
