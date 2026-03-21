import { Application } from "./src/Application";
import { NewstackServer } from "newstack/server";

const app = new Application();
const server = new NewstackServer();
server.start(app);
