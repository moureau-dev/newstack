/**
 * Rewrites bind={this.prop} to bind={{ object: this, property: 'prop' }}
 * and bind={this.nested.prop} to bind={{ object: this.nested, property: 'prop' }}
 * before esbuild processes the JSX, so the renderer receives both the
 * target object and the property name at runtime.
 */
export function BindTransform(code: string): string {
  return code.replace(
    /bind=\{\s*(this(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)+)\s*\}/g,
    (_, path) => {
      const lastDot = path.lastIndexOf(".");
      const object = path.slice(0, lastDot);
      const property = path.slice(lastDot + 1);
      return `bind={{ object: ${object}, property: '${property}' }}`;
    },
  );
}

/**
 * Rewrites on*={this.method} to on*={(e) => this.method(this.__ctx, e)}
 * so event handlers referencing component methods:
 *   - keep their `this` context (via lexical arrow function)
 *   - receive the current render context as first arg, event as second
 *     (consistent with prepare/hydrate/update signatures)
 *
 * `this.__ctx` is set by the renderer's proxy immediately before every render call,
 * so it's always the current context regardless of how the render param is named.
 *
 * Only matches bare property references (not calls, arrow functions, or chained access).
 */
export function MethodBindTransform(code: string): string {
  return code.replace(
    /(on[a-zA-Z]+)=\{\s*this\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\}/g,
    "$1={(e) => this.$2({ ...this.__ctx, event: e }, e)}",
  );
}
