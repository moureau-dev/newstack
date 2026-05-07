import Newstack from "@moureau/newstack";

export class RefExample extends Newstack {
  dialog: HTMLDialogElement;

  open() {
    console.log(this.dialog);
    this.dialog.showModal();
  }

  close() {
    this.dialog.close();
  }

  render() {
    return (
      <div class="py-8 px-2 border-t-2" id="ref-example-component">
        <h2 class="font-bold">Ref example</h2>

        <p>Open a dialog using a ref to the dialog element.</p>

        <button
          class="border px-3 py-1 mt-2"
          type="button"
          onclick={this.open}
        >
          Open dialog
        </button>

        <dialog
          ref={this.dialog}
          class="hidden backdrop:bg-black/75 bg-black inset-0 fixed z-50 open:flex flex-col self-center justify-self-center gap-2 pt-6 pb-10 px-4 md:m-2 mb-[20%] md:max-w-fit w-full rounded-lg"
        >
          <p class="mb-4">Hello from the dialog opened via ref!</p>

          <button type="button" onclick={this.close}>
            Close
          </button>
        </dialog>
      </div>
    );
  }
}
