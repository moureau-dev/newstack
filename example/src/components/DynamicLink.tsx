import Newstack from "@moureau/newstack";

/**
 * @description
 * Demonstrates that dynamically rendered anchor tags are correctly
 * patched for client-side navigation. A link appears after a 2s timeout
 * — if patchLinks uses delegation it will work, if not it won't navigate.
 */
export class DynamicLink extends Newstack {
  ready = false;

  async hydrate() {
    setTimeout(() => {
      this.ready = true;
    }, 2000);
  }

  render() {
    return (
      <div class="py-8 px-2 border-t-2" id="dynamic-link-component">
        <h2 class="font-bold">Dynamic Link</h2>

        <p>
          A link will appear after 2 seconds. It should navigate client-side.
        </p>

        {this.ready ? (
          <a href="/about" class="underline text-blue-400">
            Go to About (dynamically rendered)
          </a>
        ) : (
          <span class="text-zinc-500">Waiting...</span>
        )}
      </div>
    );
  }
}
