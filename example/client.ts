import { Application } from "./src/Application";
import { NewstackClient } from "@newstack/cli";

const app = new Application();
new NewstackClient().start(app);
