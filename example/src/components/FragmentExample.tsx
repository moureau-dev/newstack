import Newstack from "@moureau/newstack";

/**
 * @description
 * Demonstrates JSX fragment syntax (<>...</>).
 * Toggling visibility renders sibling elements without a wrapper div.
 */
export class FragmentExample extends Newstack {
  visible = true;

  toggle() {
    this.visible = !this.visible;
  }

  render() {
    return (
      <div class="py-8 px-2 border-t-2" id="fragment-example-component">
        <h2 class="font-bold">Fragment Example</h2>

        <p>Elements below are rendered with {"<>...</>"} — no wrapper div.</p>

        {this.visible ? (
          <>
            <p>First sibling</p>
            <p>Second sibling</p>
            <p>Third sibling</p>
          </>
        ) : null}

        <button
          type="button"
          class="border px-3 py-1 mt-2"
          onclick={this.toggle}
        >
          {this.visible ? "Hide" : "Show"}
        </button>
      </div>
    );
  }
}
