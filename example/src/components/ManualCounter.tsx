import Newstack from "@moureau/newstack";

/**
 * @description
 * This component demonstrates a counter that grows as we click.
 * It uses a manual method to increase the count.
 */
export class ManualCounter extends Newstack {
  count = 0;

  /**
   * @description
   * This method is called when the button is clicked.
   * It increases the count by 1.
   */
  addItem() {
    this.count++;
  }

  update() {
    console.log("Updating ManualCounter component...");
  }

  render() {
    return (
      <div class="py-8 px-2 border-t-2" id="manual-counter-component">
        <h2 class="font-bold">Manual counter</h2>

        <p>
          This component demonstrates a counter that grows as we click.{" "}
          {this.count}
        </p>

        <button type="button" onclick={() => this.addItem()}>
          Click to increase {this.count}
        </button>
      </div>
    );
  }
}
