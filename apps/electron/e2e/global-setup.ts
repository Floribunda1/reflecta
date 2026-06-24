import { createE2eTestRun, saveE2eTestRun } from "./test-env";

export default function globalSetup() {
  saveE2eTestRun(createE2eTestRun());
}
