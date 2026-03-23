import Newstack from "@moureau/newstack";

/**
 * @description
 * This component shows the input value.
 * It updates the displayed value as the user types in the input field.
 */
export class InputShow extends Newstack {
  inputValue: string;
  nestedValue = { value: "" };

  render() {
    return (
      <div class="py-8 px-2 border-t-2" id="input-show-component">
        <h2 class="font-bold">Input Show</h2>

        <p>This component shows the input value.</p>
        <div>
          <label>
            <span>Input:</span>
            <input class="border p-2" type="text" bind={this.inputValue} />
          </label>
          <b>Current input: {this.inputValue}</b>
        </div>

        <div class="mt-4">
          <label>
            <span>Nested Input:</span>
            <input
              class="border p-2"
              type="text"
              bind={this.nestedValue.value}
            />
          </label>
          <b>Current nested input: {this.nestedValue.value}</b>
        </div>
      </div>
    );
  }
}
