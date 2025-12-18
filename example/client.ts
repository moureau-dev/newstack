import { Application } from "./src/Application";
import { NewstackClient } from "newstack";

const app = new Application();
new NewstackClient().start(app);
