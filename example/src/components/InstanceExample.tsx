/* ---------- Internal ---------- */
import Newstack, { type NewstackClientContext } from "@moureau/newstack";

export class CounterStore extends Newstack {
  count = 0;

  prepare() {
    console.log("[CounterStore] prepare — count:", this.count);
  }

  hydrate() {
    console.log("[CounterStore] hydrate — count:", this.count);
  }
}

export class InstanceExample extends Newstack {
  render({ instances }: NewstackClientContext) {
    const counter = instances.counter as CounterStore;

    return (
      <div class="py-8 px-2 border-t-2" id="context-inject-component">
        <h2 class="font-bold">Instance example</h2>

        <p>A reactive persistent store</p>

        <div class="flex gap-2 mt-2 flex-wrap">
            <button
                class="border px-3 py-1"
                type="button"
                onclick={() => counter.count--}
            >
              -
            </button>

            <b>Current count: {counter.count}</b>

            <button
                class="border px-3 py-1"
                type="button"
                onclick={() => counter.count++}
            >
              +
            </button>
        </div>
      </div>
    );
  }
}
