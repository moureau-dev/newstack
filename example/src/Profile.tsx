/* ---------- Internal ---------- */
import Newstack, { type NewstackClientContext } from "newstack";

/**
 * @description
 * This is the Profile page of the Newstack example application.
 * It displays user profile information based on the provided ID in the URL.
 * The page includes a link to navigate back to the home page.
 */
export class Profile extends Newstack {
  prepare({ page }: NewstackClientContext) {
    page.title = "Profile Page";
    page.description = "User profile information.";
  }

  render({ params }: NewstackClientContext) {
    return (
      <div>
        <h1>Profile Page</h1>
        <p>This is the user profile page. id: {params.id}</p>
        <a href="/">Home</a>
      </div>
    );
  }
}
