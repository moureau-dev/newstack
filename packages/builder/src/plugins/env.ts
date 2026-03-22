import type { Plugin } from "esbuild";
import { readFileSync } from "fs";
import { resolve } from "path";

function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/**
 * Reads .env and .env.local from the project root and:
 * - Injects all plain vars (except NEWSTACK_SECRETS_* and NEWSTACK_SETTINGS_*)
 *   as process.env.KEY define replacements in both bundles.
 * - Injects __NEWSTACK_SETTINGS__ as a camelCased JSON object in both bundles
 *   so ctx.settings is available on client and server.
 * - Secrets are intentionally excluded from all bundles — server-only at runtime
 *   via ctx.secrets.
 */
export function EnvPlugin(): Plugin {
  return {
    name: "newstack-env",
    setup(build) {
      const env: Record<string, string> = {};
      for (const file of [".env", ".env.local"]) {
        try {
          Object.assign(
            env,
            parseEnv(readFileSync(resolve(process.cwd(), file), "utf8")),
          );
        } catch {}
      }

      const settings: Record<string, string> = {};
      const define: Record<string, string> = {};

      for (const [key, value] of Object.entries(env)) {
        if (key.startsWith("NEWSTACK_SECRETS_")) continue;
        if (key.startsWith("NEWSTACK_SETTINGS_")) {
          const camel = key
            .slice("NEWSTACK_SETTINGS_".length)
            .toLowerCase()
            .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
          settings[camel] = value;
          continue;
        }
        define[`process.env.${key}`] = JSON.stringify(value);
      }

      define.__NEWSTACK_SETTINGS__ = JSON.stringify(settings);

      build.initialOptions.define = {
        ...define,
        ...(build.initialOptions.define ?? {}),
      };
    },
  };
}
