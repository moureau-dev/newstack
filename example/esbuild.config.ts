import { builder } from "newstack/builder";
import tailwindPlugin from "esbuild-plugin-tailwindcss";

export default {
  server: {
    ...builder.server,
  },
  client: {
    ...builder.client,
    plugins: [...(builder.client.plugins ?? []), tailwindPlugin()],
  },
};
