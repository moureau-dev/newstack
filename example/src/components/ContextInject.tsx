import Newstack, { type NewstackClientContext } from "@moureau/newstack";

/**
 * @description
 * Demonstrates that context is auto-injected into sub-render helpers.
 * The helper methods receive the full context without being passed explicitly.
 */
export class ContextInject extends Newstack {
  renderPath({ router }: NewstackClientContext) {
    return <p>Current path: <strong>{router.path}</strong></p>;
  }

  renderEnv({ environment }: NewstackClientContext) {
    return <p>Environment: <strong>{environment}</strong></p>;
  }

  render() {
    return (
      <div class="py-8 px-2 border-t-2" id="context-inject-component">
        <h2 class="font-bold">Context Inject</h2>

        <p>Sub-render helpers receive context automatically:</p>

        {this.renderPath({})}
        {this.renderEnv({})}
      </div>
    );
  }
}
