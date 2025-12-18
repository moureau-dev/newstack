import { context } from "esbuild";
import { builder } from "@newstack/builder";

const production = false;

async function build() {
  console.time("Time taken");

  console.log("Building server...");
  const server = await context({
    ...builder.server,
    minify: production,
    external: ["esbuild", "@newstack/builder"],
  });

  await server.rebuild();
  await server.dispose();

  // console.log("Building SSG script...");
  // const ssg = await context({
  //   ...builder.server,
  //   entryPoints: ["ssg.ts"],
  //   minify: production,
  //   external: ["esbuild", "@newstack/builder"],
  // });

  // await ssg.rebuild();
  // await ssg.dispose();

  console.log("Building client...");
  const client = await context({
    ...builder.client,
    ignoreAnnotations: production,
    legalComments: production ? "none" : "external",
    minify: production,
    external: ["esbuild", "@newstack/builder"],
  });
  await client.rebuild();
  await client.dispose();

  console.log("Build completed successfully!");
  console.timeEnd("Time taken");
}

build();
