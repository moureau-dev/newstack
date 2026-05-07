import Newstack from "@moureau/newstack";

/**
 * @description
 * Demonstrates <head> injection from a component.
 * Renders a <head> block with an external script and a meta tag,
 * which should be hoisted into the document <head> on both server and client.
 */
export class HeadInject extends Newstack {
  render() {
    return (
      <>
        <head>
          <meta name="newstack-example" content="head-inject" />
          <script
            src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"
            defer
          />
        </head>

        <div class="py-8 px-2 border-t-2" id="head-inject-component">
          <h2 class="font-bold">Head Inject</h2>

          <p>
            A <code>{"<meta>"}</code> tag and a confetti script were injected
            into <code>{"<head>"}</code> by this component. Check DevTools.
          </p>

          <button
            type="button"
            class="border px-3 py-1 mt-2"
            onclick={() => {
              (window as any).confetti();
            }}
          >
            Fire confetti
          </button>
        </div>
      </>
    );
  }
}
