import type { Plugin } from "esbuild";
import { readFile } from "fs/promises";
import { Hasher } from "./hasher";
import { ReplaceStaticMethods } from "./static-methods";
export { Hasher, ReplaceStaticMethods };
export * from "./split-bundle";

/**
 * @description
 * Newstack plugin for esbuild.
 * It processes files that extend Newstack and process transformations.
 *
 * @param environment "client" | "server"
 * @returns {Plugin} Newstack plugin for esbuild
 */
export function NewstackPlugin(environment: "client" | "server"): Plugin {
  return {
    name: "newstack-plugin",
    setup(build) {
      build.onLoad({ filter: /\.(tsx|ts|jsx|js)$/ }, async (args) => {
        let code = await readFile(args.path, "utf8");

        // Add a hash to classes extending Newstack
        code = Hasher(args, code);

        if (environment === "client") {
          // Replace static methods with fetch calls in the client
          code = ReplaceStaticMethods(args, code);
        }

        return {
          contents: code,
          loader: args.path.endsWith("jsx") ? "jsx" : "tsx",
        };
      });
    },
  };
}
