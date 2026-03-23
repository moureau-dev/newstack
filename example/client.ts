import { Application } from "./src/Application";
import { NewstackClient } from "@moureau/newstack";

const app = new Application();
new NewstackClient().start(app);
