import Newstack from "newstack";

/**
 * @description
 * This component displays a list of items.
 * It allows the user to add new items to the list.
 */
export class List extends Newstack {
  items = ["Item 1", "Item 2", "Item 3"];

  /**
   * @description
   * This method adds a new item to the list.
   * It is called when the button is clicked.
   */
  addItem() {
    this.items.push(`Item ${this.items.length + 1}`);
  }

  render() {
    return (
      <div>
        <h2>List Component</h2>

        <p>This component displays a list of items.</p>

        <ul>
          {this.items.map((item) => (
            <li>{item}</li>
          ))}
        </ul>

        <button type="button" onclick={() => this.addItem()}>
          Add Item
        </button>
      </div>
    );
  }
}
