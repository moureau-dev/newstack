import Newstack from "@moureau/newstack";
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
      <div class="py-8 px-2 border-t-2" id="dynamic-import-component">
        <h2 class="font-bold">Dynamic Import</h2>

        <p>This component demonstrates dynamic import of a module.</p>
        <b>Module imported: {this.imported ? "Yes" : "No"}</b>
      </div>
    );
  }
}
