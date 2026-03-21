/* ---------- Internal ---------- */
import Newstack, { type NewstackClientContext } from "newstack";

/* ---------- Components ---------- */
import { DynamicImport } from "./components/DynamicImport";
import { AutoCounter } from "./components/AutoCounter";
import { ChangeStringOnHydrate } from "./components/ChangeStringOnHydrate";
import { ManualCounter } from "./components/ManualCounter";
import { InputShow } from "./components/InputShow";
import { List } from "./components/List";
import { SayHelloAppender } from "./components/SayHelloAppender";

/**
 * @description
 * This is the Home page of the Newstack example application.
 * It demonstrates various components and features of Newstack.
 * The page includes a welcome message, links to other pages, and several interactive components.
 */
export class Home extends Newstack {
  prepare({ page }: NewstackClientContext) {
    page.title = "Newstack Example Application";
    page.description = "A simple example of a Newstack application.";
  }

  render({ router }: NewstackClientContext) {
    return (
      <div>
        <h1>Welcome to Newstack! </h1>

        <p class="hello">This is a simple example of a Newstack application.</p>

        <DynamicImport />
        <AutoCounter />
        <ChangeStringOnHydrate />
        <ManualCounter />
        <InputShow />
        <List />
        <SayHelloAppender />

        <a href="/about">About</a>
        <a href="/profile/123">Profile 123</a>

        <button
          type="button"
          onclick={() => {
            console.log("Navigating to /about");
            router.path = "/about";
          }}
        >
          Go to about
        </button>

        <button
          type="button"
          onclick={() => {
            router.path = "/profile/1";
          }}
        >
          Go to profile 1
        </button>
      </div>
    );
  }
}
