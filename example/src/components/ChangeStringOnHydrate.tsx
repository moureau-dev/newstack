import Newstack from "newstack";

/**
 * @description
 * This component changes a string value when it is hydrated.
 * It demonstrates the use of the `hydrate` method to modify the component's state.
 */
export class ChangeStringOnHydrate extends Newstack {
  str = "this is how the string comes by default from the server";

  hydrate() {
    this.str = "Hello, Newstack!";
  }

  render() {
    return (
      <div class="py-8 px-2 border-t-2" id="change-string-component">
        <h2 class="font-bold">Change String Component</h2>

        <p>This component changes a string value.</p>
        <b>Current string: {this.str}</b>
      </div>
    );
  }
}
