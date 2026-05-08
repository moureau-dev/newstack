/* ---------- Internal ---------- */
import Newstack, { type NewstackClientContext } from "@moureau/newstack";
import "./styles.css";

/* ---------- Pages ---------- */
import { Home } from "./Home";
import { About } from "./About";
import { Profile } from "./Profile";
import { NotFound } from "./NotFound";

/* ---------- Components ---------- */
import { Layout } from "./components/Layout";
import { CounterStore } from "./components/InstanceExample";

/**
 * @description
 * This is the application entrypoint component for the Newstack example.
 */
export class Application extends Newstack {
  prepare({ page, project }: NewstackClientContext) {
    page.image = "/icon-512x512.png";
    project.domain = "example.newstack.dev";
    project.name = "Newstack Example";
    project.favicon = "/favicon.ico";
    project.icons = {
      96: "/icon-96x96.png",
      192: "/icon-192x192.png",
      384: "/icon-384x384.png",
      128: "/icon-128x128.png",
      152: "/icon-152x152.png",
      512: "/icon-512x512.png",
      144: "/icon-144x144.png",
    };
  }

  render() {
    return (
      <Layout>
        <CounterStore key="counter" persistent />
        <Home route="/" />
        <About route="/about" />
        <Profile route="/profile/:id" />
        <NotFound route="*" />
      </Layout>
    );
  }
}
