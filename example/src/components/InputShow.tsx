import Newstack from "newstack";

/**
 * @description
 * This component shows the input value.
 * It updates the displayed value as the user types in the input field.
 */
export class InputShow extends Newstack {
  inputValue: string;

  render() {
    return (
      <div class="py-8 px-2 border-t-2" id="input-show-component">
        <h2 class="font-bold">Input Show</h2>

        <p>This component shows the input value.</p>
        <input class="border p-2" type="text" bind={this.inputValue} />
        <b>Current input: {this.inputValue}</b>
      </div>
    );
  }
}
