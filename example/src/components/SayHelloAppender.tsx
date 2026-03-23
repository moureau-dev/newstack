import Newstack from "@moureau/newstack";

/**
 * @description
 * This component appends a message to the existing message when the button is clicked.
 * It demonstrates the use of state management in Newstack.
 */
export class SayHelloAppender extends Newstack {
  message = "";

  prepare() {
    this.message = "";
  }

  /**
   * @description
   * This method is called when the button is clicked.
   * It appends a message to the existing message.
   */
  onclick() {
    console.log("Button clicked!");
    this.message += "Hello, Newstack!\n";
  }

  render() {
    return (
      <div class="py-8 px-2 border-t-2" id="say-hello-appender-component">
        <h2 class="font-bold">Say Hello Appender</h2>

        <pre>{this.message}</pre>

        <button type="button" onclick={this.onclick}>
          Say Hello
        </button>
      </div>
    );
  }
}
