import { cleanupE2eTestEnv } from "./test-env";

export default function globalTeardown() {
  cleanupE2eTestEnv();
}
