
import { Basebox } from "@moureau/basebox";

const { BASEBOX_ANON_KEY, BASEBOX_SECRET_KEY } = process.env;

const dist = "./dist/ssg";
const domain = "newstack.moureau.dev";
const publicKey = BASEBOX_ANON_KEY;
const apiKey = BASEBOX_SECRET_KEY;

const bb = new Basebox({ publicKey });

const { success } = await bb
  .managed({ apiKey })
  .deploy({ dist, domain });

if (success) {
  console.log(`Deployed successfully at https://${domain}`);
} else {
  console.log("Failed to deploy.")
}
