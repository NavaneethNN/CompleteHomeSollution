import { config } from "dotenv";
import { releaseConfigErrors } from "../lib/release-config";

config({ quiet: true });
config({ path: ".env.local", override: true, quiet: true });

const gateway = process.env.PAYMENT_GATEWAY;
const errors = releaseConfigErrors(process.env);
if (errors.length) {
  console.error(`Release configuration failed: ${errors.join("; ")}`);
  process.exitCode = 1;
} else {
  console.log(`Release configuration passed for ${new URL(process.env.NEXT_PUBLIC_APP_URL!).origin} (${gateway}); secret values withheld`);
}
