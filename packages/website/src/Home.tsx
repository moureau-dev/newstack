/* ---------- External ---------- */
import Newstack from "@moureau/newstack";

export class Home extends Newstack {
  /* ---------- Proxies ---------- */
  copied: boolean;
  tailwind: boolean;
  cmd: string = "bunx create-newstack-app my-app";

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

  render() {
    return (
      <div class="home">
        <div class="home__content">
          <div class="home__badge">Newstack</div>
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

          <a
            class="home__llms"
            href="/llms.txt"
            target="_blank"
            rel="noopener noreferrer"
          >
            llms.txt →
          </a>
        </div>
      </div>
    );
  }
}
