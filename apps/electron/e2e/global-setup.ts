import { execFileSync } from "node:child_process";
import path from "node:path";
import { createE2eTestEnv, saveE2eTestEnv } from "./test-env";

export default function globalSetup() {
  const env = createE2eTestEnv();
  const seedScript = path.resolve(import.meta.dirname, "../../cli/scripts/seed-test-data.ts");

  execFileSync("bun", ["run", seedScript, env.dbPath], { stdio: "inherit" });
  saveE2eTestEnv(env);
}
