/* ---------- Internal ---------- */
import Newstack, { type NewstackClientContext } from "@moureau/newstack";

/**
 * @description
 * Fallback page for the Newstack example application.
 *
 * Wired in `Application.tsx` as `<NotFound route="*" />`. The `*` route renders
 * only when no sibling `route` matched the current path — i.e. it is a 404,
 * not a "render on every page" catch-all. Try navigating to `/does-not-exist`
 * to see it; navigating back to `/`, `/about`, or `/profile/:id` hides it.
 */
export class NotFound extends Newstack {
  prepare({ page }: NewstackClientContext) {
    page.title = "404 — Not Found";
    page.description = "The page you were looking for does not exist.";
  }

  render({ router }: NewstackClientContext) {
    return (
      <div>
        <h1>404 — Not Found</h1>

        <p>
          No route matched <code>{router.path}</code>.
        </p>

        <footer class="flex gap-4 items-center">
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/profile/123">Profile 123</a>
        </footer>
      </div>
    );
  }
}
