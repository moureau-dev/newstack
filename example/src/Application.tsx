/* ---------- Internal ---------- */
import Newstack from "newstack";
import "./styles.css";

/* ---------- Pages ---------- */
import { Home } from "./Home";
import { About } from "./About";
import { Profile } from "./Profile";

/**
 * @description
 * This is the application entrypoint component for the Newstack example.
 */
export class Application extends Newstack {
  render() {
    return (
      <main>
        <Home route="/" />
        <About route="/about" />
        <Profile route="/profile/:id" />
      </main>
    );
  }
}
