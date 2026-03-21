import { parseSync } from "@swc/core";
import type { OnLoadArgs } from "esbuild";

const baseClassName = "Newstack";

/**
 * @description
 * Replaces static async methods in Newstack-derived classes with runtime.invoke calls.
 * This transformation happens only on the client side, converting server methods into
 * fetch-based API calls.
 *
 * @example
 * // Input (client build):
 * class MyComponent extends Newstack {
 *   static async serverMethod(ctx) {
 *     return doServerStuff(ctx);
 *   }
 * }
 *
 * // Output:
 * class MyComponent extends Newstack {
 *   static serverMethod = (ctx) => runtime.invoke("serverMethod", this.hash, ctx)
 * }
 *
 * Parameter requirements:
 * - Server functions must accept exactly one parameter: an object
 * - The object can be destructured: `({ name, age })` → `{ name, age }`
 * - Or passed directly: `(ctx)` → `ctx`
 * - Empty parameters `()` are allowed for backwards compatibility → `undefined`
 *
 * Multiple parameters or non-object parameters will throw a build error.
 *
 * @param args ESBuild onLoad arguments
 * @param code Source code to transform
 * @returns Transformed code with runtime.invoke calls
 */
export async function ReplaceStaticMethods(args: OnLoadArgs, code: string) {
  const ast = parseSync(code, {
    syntax: "typescript",
    tsx: true,
  });

  // Collect inheritance graph
  const extendsMap: Record<string, string> = {};
  for (const node of ast.body) {
    let classDecl = null;
    if (node.type === "ClassDeclaration") {
      classDecl = node;
    } else if (
      node.type === "ExportDeclaration" &&
      node.declaration?.type === "ClassDeclaration"
    ) {
      classDecl = node.declaration;
    }

    if (classDecl && classDecl.superClass?.type === "Identifier") {
      extendsMap[classDecl.identifier.value] = classDecl.superClass.value;
    }
  }

  const extendsBase = (cls: string): boolean => {
    let cur = extendsMap[cls];
    while (cur) {
      if (cur === baseClassName) return true;
      cur = extendsMap[cur];
    }
    return false;
  };

  // Collect static methods to replace
  const replacements: Array<{
    className: string;
    methodName: string;
    hash: string;
    start: number;
    end: number;
    params: string[];
    isDestructured: boolean;
  }> = [];

  for (const node of ast.body) {
    // Handle both direct class declarations and exported class declarations
    let classDecl = null;
    if (node.type === "ClassDeclaration") {
      classDecl = node;
    } else if (
      node.type === "ExportDeclaration" &&
      node.declaration?.type === "ClassDeclaration"
    ) {
      classDecl = node.declaration;
    }

    if (!classDecl) continue;

    const className = classDecl.identifier?.value;
    if (!className || !extendsBase(className)) continue;

    // Find static hash
    let hashValue: string | null = null;
    for (const member of classDecl.body) {
      if (
        member.type === "ClassProperty" &&
        member.isStatic &&
        member.key.type === "Identifier" &&
        member.key.value === "hash" &&
        member.value?.type === "StringLiteral"
      ) {
        hashValue = member.value.value;
        break;
      }
    }
    if (!hashValue) continue;

    // Find static methods
    for (const member of classDecl.body) {
      if (
        member.type === "ClassMethod" &&
        member.isStatic &&
        member.kind === "method" &&
        member.key.type === "Identifier"
      ) {
        const methodName = member.key.value;
        const params: string[] = [];
        let isDestructured = false;

        for (const p of member.function.params) {
          const pat = p.pat;
          if (pat.type === "Identifier") {
            params.push(pat.value);
          } else if (
            pat.type === "AssignmentPattern" &&
            pat.left.type === "Identifier"
          ) {
            params.push(pat.left.value);
          } else if (pat.type === "ObjectPattern") {
            // Handle destructured params like { name }
            isDestructured = true;
            for (const prop of pat.properties) {
              if (prop.type === "KeyValuePatternProperty") {
                if (prop.key.type === "Identifier") {
                  params.push(prop.key.value);
                }
              } else if (
                prop.type === "AssignmentPatternProperty" &&
                prop.key.type === "Identifier"
              ) {
                params.push(prop.key.value);
              }
            }
          }
        }

        // Validate parameter count
        if (!isDestructured && params.length > 1) {
          throw new Error(
            `${args.path}:${member.span.start}
            Static server method "${className}.${methodName}" has multiple non-destructured parameters (${params.join(", ")}).
            Server functions must use either:
              - A single parameter: static async ${methodName}(ctx) { ... }
              - Destructured parameters: static async ${methodName}({ param1, param2 }) { ... }
              - No parameters: static async ${methodName}() { ... }`,
          );
        }

        replacements.push({
          className,
          methodName,
          hash: hashValue,
          start: member.span.start,
          end: member.span.end,
          params,
          isDestructured,
        });
      }
    }
  }

  // Replace methods using regex search for each method name
  // Process in reverse order so positions remain valid
  replacements.sort((a, b) => b.start - a.start);

  let result = code;

  for (const r of replacements) {
    let paramsDecl: string;
    let paramsPass: string;

    if (r.params.length === 0) {
      paramsDecl = "";
      paramsPass = "undefined";
    } else if (r.isDestructured) {
      paramsDecl = `{ ${r.params.join(", ")} }`;
      paramsPass = `{ ${r.params.join(", ")} }`;
    } else {
      paramsDecl = r.params[0];
      paramsPass = r.params[0];
    }

    const newMethod = `static ${r.methodName} = (${paramsDecl}) => runtime.invoke("${r.methodName}", this.hash, ${paramsPass})`;

    // Use regex to find the full "static async methodName" declaration
    // and replace it with the new arrow function
    const escapedMethodName = r.methodName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Match from "static async methodName" through the end (using AST end position as guide)
    // Look for the pattern around the AST start position
    const searchStart = Math.max(0, r.start - 20);
    const searchEnd = r.end + 10;
    const searchRegion = result.substring(searchStart, searchEnd);

    const methodPattern = new RegExp(
      `(\\s*)static\\s+async\\s+${escapedMethodName}\\s*\\([^)]*\\)\\s*\\{`,
    );
    const match = searchRegion.match(methodPattern);

    if (match) {
      const matchStart = searchStart + match.index + match[1].length; // Preserve leading whitespace
      const actualStart = matchStart;
      const actualEnd = r.end;

      const before = result.substring(0, actualStart);
      const after = result.substring(actualEnd);
      result = before + newMethod + after;
    }
  }

  // Add runtime import AFTER replacements (so AST positions stay valid)
  if (replacements.length > 0) {
    // Check if @newstack/framework is already imported
    const frameworkImportRegex =
      /import\s+([^;]+)\s+from\s+["'](newstack|@newstack\/framework)["'];?/;
    const hasFrameworkImport = frameworkImportRegex.test(result);

    if (!hasFrameworkImport) {
      // No existing import, add a new one
      result = `import { runtime } from "newstack";\n${result}`;
    } else {
      // Add runtime to existing import if not already there
      result = result.replace(
        frameworkImportRegex,
        (match, importStatement) => {
          if (match.includes("runtime")) return match;

          // Handle different import formats:
          // import Newstack from "newstack"
          // import { Foo } from "newstack"
          // import Newstack, { Foo } from "newstack"

          if (importStatement.includes("{")) {
            // Has destructured imports
            return match.replace(/}\s+from/, ", runtime } from");
          }
          // Only default import
          return match.replace(/from/, ", { runtime } from");
        },
      );
    }
  }

  return result;
}
