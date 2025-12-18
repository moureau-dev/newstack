import { Application } from "./src/Application";
import { NewstackServer } from "@newstack/framework/server";

const app = new Application();
const server = new NewstackServer();
server.start(app);
