/* ---------- Internal ---------- */
import Newstack, { type NewstackClientContext } from "@moureau/newstack";

/**
 * @description
 * A render-less Newstack instance used as a shared store/service.
 * Exercises the lifecycle and reactivity paths for instances:
 *  - prepare/hydrate are called by the framework
 *  - direct property writes (this.user = ...) re-render readers
 *  - array re-assignment (this.items = [...]) re-renders readers
 *  - array mutation (this.items.push(...)) re-renders readers
 *  - async writes (after await) re-render readers
 */
export class CounterStore extends Newstack {
  count = 0;
  user: { name: string } | null = null;
  items: string[] = [];
  ready = false;

  prepare() {
    console.log("[CounterStore] prepare — count:", this.count);
  }

  async hydrate() {
    console.log("[CounterStore] hydrate start");

    // Simulate an async fetch that writes to the instance after await.
    // This is the exact pattern that was previously broken: properties
    // assigned after `await` did not propagate to readers.
    await new Promise((r) => setTimeout(r, 800));
    this.user = { name: "Async User" };

    await new Promise((r) => setTimeout(r, 800));
    this.items = ["alpha", "beta", "gamma"];

    this.ready = true;
    console.log("[CounterStore] hydrate done");
  }

  addItem() {
    // Array mutation through reactiveArray proxy
    this.items.push(`item-${this.items.length + 1}`);
  }

  reset() {
    this.count = 0;
    this.user = null;
    this.items = [];
    this.ready = false;
  }
}

/**
 * @description
 * Reads from `instances.counter`. Should re-render whenever any
 * property on the CounterStore changes — including async writes.
 */
export class InstanceExample extends Newstack {
  render({ instances }: NewstackClientContext) {
    const counter = instances.counter as CounterStore;

    return (
      <div class="py-8 px-2 border-t-2" id="instance-example-component">
        <h2 class="font-bold">Instance example</h2>
        <p>A reactive persistent store</p>

        <div class="flex gap-2 mt-2 flex-wrap items-center">
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

          <button
            class="border px-3 py-1"
            type="button"
            onclick={() => counter.addItem()}
          >
            push item
          </button>

          <button
            class="border px-3 py-1"
            type="button"
            onclick={() => counter.reset()}
          >
            reset
          </button>
        </div>

        <p class="mt-3">
          ready: <b>{String(counter.ready)}</b> · user:{" "}
          <b>{counter.user?.name ?? "—"}</b>
        </p>

        <ul class="mt-2 list-disc pl-6">
          {counter.items.map((it) => (
            <li>{it}</li>
          ))}
        </ul>
      </div>
    );
  }
}

/**
 * @description
 * A second component reading the same instance — proves the broadcast
 * re-renders ALL visible components, not just one.
 */
export class InstanceMirror extends Newstack {
  render({ instances }: NewstackClientContext) {
    const counter = instances.counter as CounterStore;

    return (
      <div class="py-4 px-2 border-t" id="instance-mirror-component">
        <h3 class="font-bold">Instance mirror</h3>
        <p>
          Mirroring count from another component:{" "}
          <b>{counter.count}</b> · items: <b>{counter.items.length}</b>
        </p>
      </div>
    );
  }
}
