import Newstack from "@moureau/newstack";

/**
 * @description
 * Demonstrates the `html` prop, which sets innerHTML directly on an element.
 * The content is driven by a reactive string that cycles through different
 * HTML snippets when the user clicks the button.
 */
export class HtmlProp extends Newstack {
  snippets = [
    "<strong>Hello from <em>innerHTML</em>!</strong>",
    '<span style="color: red;">Red text via html prop</span>',
    "<ul><li>Item one</li><li>Item two</li><li>Item three</li></ul>",
    '<a href="#">A link rendered via html prop</a>',
  ];

  index = 0;

  get current() {
    return this.snippets[this.index];
  }

  next() {
    this.index = (this.index + 1) % this.snippets.length;
  }

  render() {
    return (
      <div class="py-8 px-2 border-t-2" id="html-prop-component">
        <h2 class="font-bold">Html Prop</h2>

        <p>
          The div below renders its content via the <code>html</code> prop
          (innerHTML).
        </p>

        <div class="border p-4 my-2 rounded" html={this.current} />

        <button type="button" class="border px-3 py-1 mt-2" onclick={() => this.next()}>
          Next snippet
        </button>
      </div>
    );
  }
}
