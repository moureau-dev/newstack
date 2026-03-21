import { context } from "newstack/esbuild";
import { builder } from "newstack/builder";

const production = false;

async function build() {
  console.time("Time taken");

  console.log("Building server...");
  const server = await context({
    ...builder.server,
    minify: production,
  });

  await server.rebuild();
  await server.dispose();

  console.log("Building client...");
  const client = await context({
    ...builder.client,
    ignoreAnnotations: production,
    legalComments: production ? "none" : "external",
    minify: production,
  });
  await client.rebuild();
  await client.dispose();

  console.log("Build completed successfully!");
  console.timeEnd("Time taken");
}

build();
