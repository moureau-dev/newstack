import Newstack, { type NewstackClientContext } from "@moureau/newstack";

/**
 * Props the child expects. Declaring them on `Newstack<T>` intersects the type
 * into the context (NewstackClientContext<T>), so every lifecycle method gets
 * them fully typed.
 */
type GreetingProps = { name: string; count: number };

/**
 * @description
 * Child class component that owns no state of its own — everything it renders
 * comes from props. Props passed in JSX (`<Greeting name=... count=... />`) are
 * merged into the context, so they're available in EVERY lifecycle method:
 * here `prepare`, `render`, and the `shout` event handler.
 */
class Greeting extends Newstack<GreetingProps> {
  prepare({ name }: NewstackClientContext<GreetingProps>) {
    // Props are available during prepare too (runs on the server for SSR and
    // on the client before paint).
    console.log(`[Greeting] prepared with name="${name}"`);
  }

  // Event handlers receive the same merged context, so props are reachable here
  // as well — no need to thread them through manually.
  shout({ name }: NewstackClientContext<GreetingProps>) {
    alert(`Hi from ${name}!`);
  }

  render({ name, count }: NewstackClientContext<GreetingProps>) {
    return (
      <div class="mt-2">
        <p>
          Hello, <strong>{name || "stranger"}</strong>! The parent has counted{" "}
          <strong>{count}</strong>.
        </p>

        <button type="button" onclick={this.shout}>
          Shout my name
        </button>
      </div>
    );
  }
}

/**
 * @description
 * Demonstrates prop dropping: a parent passes its own reactive state down to a
 * child as props. Because the child is re-rendered inline whenever the parent
 * re-renders, the props stay reactive — editing the name or clicking the button
 * immediately flows the new values into <Greeting>.
 */
export class PropDrop extends Newstack {
  name = "Ada";
  count = 0;

  increase() {
    this.count += 1;
  }

  render() {
    return (
      <div class="py-8 px-2 border-t-2" id="prop-drop-component">
        <h2 class="font-bold">Prop Dropping</h2>

        <p>Props passed in JSX are merged into the child component's context:</p>

        <label>
          <span>Name passed to child: </span>
          <input class="border p-2" type="text" bind={this.name} />
        </label>

        <button type="button" onclick={() => this.increase()}>
          Increase count
        </button>

        {/* Reactive props: changing name/count above re-renders <Greeting> */}
        <Greeting name={this.name} count={this.count} />
      </div>
    );
  }
}
