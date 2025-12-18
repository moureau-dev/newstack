import Newstack from "newstack";
import type { Socket } from "socket.io-client";

/**
 * @description
 * This component demonstrates dynamic import of a module.
 * It uses the `hydrate` method to dynamically import the `socket.io-client` module,
 * splitting the code into a separate chunk in the client build.
 */
export class DynamicImport extends Newstack {
  io: Socket;
  imported = false;

  async hydrate() {
    const { io } = await import("socket.io-client"); // dynamic import to split this code into a separate chunk in the client build
    this.io = io("");
    this.imported = true;
  }

  destroy() {
    this.io?.disconnect();
  }

  render() {
    return (
      <div id="dynamic-import-component">
        <h2>Dynamic Import</h2>

        <p>This component demonstrates dynamic import of a module.</p>
        <b>Module imported: {this.imported ? "Yes" : "No"}</b>
      </div>
    );
  }
}
