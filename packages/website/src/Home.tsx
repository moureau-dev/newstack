/* ---------- External ---------- */
import Newstack, { NewstackClientContext } from "@moureau/newstack";

const LLMS_URL = "/llms.txt";

const Clipboard = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" /></svg>
);

const ClipboardCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.35 3.836q-.099.316-.1.664c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75a2.3 2.3 0 0 0-.1-.664m-5.8 0A2.25 2.25 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0q-.563.035-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414q.564.035 1.124.08c1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5l3-3.75" /></svg>
);

const IconOpenAI = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linejoin="round" d="M12.019 16.225L8.35 14.13m3.669 2.096l3.65-2.129m-3.65 2.13L9.183 17.88l-5.196-3a5 5 0 0 1-.714-.498m5.077-.252L5.5 12.5v-6q0-.444.075-.867m2.775 8.496l-.018-4.225m5.97-6.652a5.001 5.001 0 0 0-8.727 2.38m8.727-2.38a5 5 0 0 0-.789.369l-5.196 3l.015 3.283m5.97-6.652a5.001 5.001 0 0 1 6.425 6.367M5.575 5.633a5.001 5.001 0 0 0-2.302 8.748m8.708-6.606l3.669 2.096m-3.67-2.096L8.33 9.904m3.65-2.129l2.836-1.654l5.196 3q.384.223.714.498m-5.077.252L18.5 11.5v6q0 .444-.075.867M15.65 9.871l.018 4.225m-5.97 6.652a5.001 5.001 0 0 0 8.727-2.38m-8.727 2.38a5 5 0 0 0 .789-.369l5.196-3l-.015-3.283m-5.97 6.652a5.001 5.001 0 0 1-6.425-6.367m15.152 3.986a5.001 5.001 0 0 0 2.302-8.748" stroke-width="1" />
  </svg>
);

const IconClaude = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 257"><path fill="#d97757" d="m50.228 170.321l50.357-28.257l.843-2.463l-.843-1.361h-2.462l-8.426-.518l-28.775-.778l-24.952-1.037l-24.175-1.296l-6.092-1.297L0 125.796l.583-3.759l5.12-3.434l7.324.648l16.202 1.101l24.304 1.685l17.629 1.037l26.118 2.722h4.148l.583-1.685l-1.426-1.037l-1.101-1.037l-25.147-17.045l-27.22-18.017l-14.258-10.37l-7.713-5.25l-3.888-4.925l-1.685-10.758l7-7.713l9.397.649l2.398.648l9.527 7.323l20.35 15.75L94.817 91.9l3.889 3.24l1.555-1.102l.195-.777l-1.75-2.917l-14.453-26.118l-15.425-26.572l-6.87-11.018l-1.814-6.61c-.648-2.723-1.102-4.991-1.102-7.778l7.972-10.823L71.42 0l10.63 1.426l4.472 3.888l6.61 15.101l10.694 23.786l16.591 32.34l4.861 9.592l2.592 8.879l.973 2.722h1.685v-1.556l1.36-18.211l2.528-22.36l2.463-28.776l.843-8.1l4.018-9.722l7.971-5.25l6.222 2.981l5.12 7.324l-.713 4.73l-3.046 19.768l-5.962 30.98l-3.889 20.739h2.268l2.593-2.593l10.499-13.934l17.628-22.036l7.778-8.749l9.073-9.657l5.833-4.601h11.018l8.1 12.055l-3.628 12.443l-11.342 14.388l-9.398 12.184l-13.48 18.147l-8.426 14.518l.778 1.166l2.01-.194l30.46-6.481l16.462-2.982l19.637-3.37l8.88 4.148l.971 4.213l-3.5 8.62l-20.998 5.184l-24.628 4.926l-36.682 8.685l-.454.324l.519.648l16.526 1.555l7.065.389h17.304l32.21 2.398l8.426 5.574l5.055 6.805l-.843 5.184l-12.962 6.611l-17.498-4.148l-40.83-9.721l-14-3.5h-1.944v1.167l11.666 11.406l21.387 19.314l26.767 24.887l1.36 6.157l-3.434 4.86l-3.63-.518l-23.526-17.693l-9.073-7.972l-20.545-17.304h-1.36v1.814l4.73 6.935l25.017 37.59l1.296 11.536l-1.814 3.76l-6.481 2.268l-7.13-1.297l-14.647-20.544l-15.1-23.138l-12.185-20.739l-1.49.843l-7.194 77.448l-3.37 3.953l-7.778 2.981l-6.48-4.925l-3.436-7.972l3.435-15.749l4.148-20.544l3.37-16.333l3.046-20.285l1.815-6.74l-.13-.454l-1.49.194l-15.295 20.999l-23.267 31.433l-18.406 19.702l-4.407 1.75l-7.648-3.954l.713-7.064l4.277-6.286l25.47-32.405l15.36-20.092l9.917-11.6l-.065-1.686h-.583L44.07 198.125l-12.055 1.555l-5.185-4.86l.648-7.972l2.463-2.593l20.35-13.999z" />
  </svg>
);

const IconSpinner = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
    <path fill="currentColor" d="M12 2A10 10 0 1 0 22 12A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8A8 8 0 0 1 12 20Z" opacity="0.5" /><path fill="currentColor" d="M20 12h2A10 10 0 0 0 12 2V4A8 8 0 0 1 20 12Z">
    <animateTransform attributeName="transform" dur="1s" from="0 12 12" repeatCount="indefinite" to="360 12 12" type="rotate" />
  </path>
  </svg>
);

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
        <head>
          <link rel="stylesheet" href="https://cdn.hugeicons.com/font/hgi-stroke-rounded.css" />
          </head>
        <div class="home" onclick={this.closeLlmsMenu}>
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
      </>
    );
  }
}
