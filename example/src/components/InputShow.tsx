import Newstack from "@newstack/cli";

/**
 * @description
 * This component shows the input value.
 * It updates the displayed value as the user types in the input field.
 */
export class InputShow extends Newstack {
  inputValue = "";

  oninput(e: Event) {
    const target = e.target as HTMLInputElement;
    this.inputValue = target.value;
  }

  render() {
    return (
      <div id="input-show-component">
        <h2>Input Show</h2>

        <p>This component shows the input value.</p>
        <input type="text" oninput={this.oninput.bind(this)} />
        <b>Current input: {this.inputValue}</b>
      </div>
    );
  }
}
