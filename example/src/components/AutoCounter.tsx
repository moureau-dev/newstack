import Newstack from "@moureau/newstack";

/**
 * @description
 * This component is a simple counter that automatically increments every second.
 * It demonstrates the use of the `hydrate` method to initialize the counter and
 * the `destroy` method to clean up resources when the component is no longer needed.
 */
export class AutoCounter extends Newstack {
  count = 0;
  interval: NodeJS.Timeout;

  async hydrate() {
    this.count = 0;

    this.interval = setInterval(() => this.increase(), 1000);
  }

  destroy() {
    clearInterval(this.interval);
  }

  /**
   * @description
   * This method the count by 1.
   */
  increase() {
    this.count += 1;
  }

  render() {
    return (
      <div class="py-8 px-2 border-t-2" id="counter-component">
        <h2 class="font-bold">Counter</h2>

        <p>This is a reusable component in the Newstack application.</p>
        <b>Current count: {this.count}</b>
      </div>
    );
  }
}
