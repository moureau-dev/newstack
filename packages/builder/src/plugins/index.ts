import type { Plugin } from "esbuild";
import { readFile } from "fs/promises";
import { Hasher } from "./hasher";
import { ReplaceStaticMethods } from "./static-methods";
import { IgnoreCss } from "./ignore-css";
import { BindTransform, MethodBindTransform } from "./bind";
export { Hasher, ReplaceStaticMethods, IgnoreCss, BindTransform, MethodBindTransform };
export * from "./split-bundle";
export { EnvPlugin } from "./env";

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
      // Ignore CSS imports in server build
      if (environment === "server") {
        IgnoreCss(build);
      }

      build.onLoad({ filter: /\.(tsx|ts|jsx|js)$/ }, async (args) => {
        let code = await readFile(args.path, "utf8");

        // Add a hash to classes extending Newstack
        code = Hasher(args, code);

        // Rewrite bind={this.prop} and on*={this.method} before JSX compilation
        code = BindTransform(code);
        code = MethodBindTransform(code);

        if (environment === "client" && code.includes("static async")) {
          // Replace static methods with fetch calls in the client
          code = await ReplaceStaticMethods(args, code);
        }

        return {
          contents: code,
          loader: args.path.endsWith("jsx") ? "jsx" : "tsx",
        };
      });
    },
  };
}
