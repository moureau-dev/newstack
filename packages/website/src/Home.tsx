/* ---------- External ---------- */
import Newstack from "@moureau/newstack";

/**
 * @description
 * This is the Home page of the Newstack example application.
 * It demonstrates a simple interactive component with a counter.
 */
export class Home extends Newstack {
  /* ---------- Proxies ---------- */
  copied: boolean;

  /* ---------- Lifecycle ---------- */
  prepare({ page }) {
    page.title = "Newstack";
    page.description = "Welcome to Newstack - a modern web framework for building fast and efficient applications.";
  }

  render() {
    return (
      <div class="home">
        <h1>Welcome to Newstack!</h1>
        <p>Get started by editing <code>src/Home.tsx</code></p>
      </div>
    );
  }
}
