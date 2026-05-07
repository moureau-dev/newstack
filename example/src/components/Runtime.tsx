import Newstack, { type NewstackClientContext } from "@moureau/newstack";

/**
 * @description
 * A component that is never placed in the JSX tree directly.
 * It gets mounted at runtime via __NEWSTACK.mount() to demonstrate
 * the dynamic component mounting API.
 */
class RuntimeWidget extends Newstack {
  count = 0;

  render({ page }: NewstackClientContext) {
    return (
      <div class="mt-3 p-3 border-2 border-dashed border-blue-400 rounded">
        <p class="font-bold text-blue-500">
          Runtime Widget — mounted dynamically!
        </p>
        <p>
          Current page title: <strong>{page.title}</strong>
        </p>
        <p>
          Count: <strong>{this.count}</strong>
        </p>
        <button
          type="button"
          class="border px-3 py-1 mt-2"
          onclick={() => this.count++}
        >
          Increment
        </button>
      </div>
    );
  }
}

/**
 * @description
 * Demonstrates runtime component mounting via __NEWSTACK.mount().
 * RuntimeWidget is never placed in the JSX tree — it is mounted
 * and destroyed dynamically.
 */
export class Runtime extends Newstack {
  mounted: { destroy: () => void } | null = null;

  render() {
    return (
      <div class="py-8 px-2 border-t-2" id="runtime-component">
        <h2 class="font-bold">Runtime Mount</h2>

        <p>
          <code>RuntimeWidget</code> is not in the JSX tree. Clicking mount
          injects it via <code>__NEWSTACK.mount()</code>.
        </p>

        <div class="flex gap-2 mt-2">
          <button
            type="button"
            class="border px-3 py-1"
            onclick={() => {
              if (this.mounted) return;
              this.mounted = (window as any).__NEWSTACK.mount(RuntimeWidget);
            }}
          >
            Mount
          </button>

          <button
            type="button"
            class="border px-3 py-1"
            onclick={() => {
              this.mounted?.destroy();
              this.mounted = null;
            }}
          >
            Destroy
          </button>
        </div>
      </div>
    );
  }
}
