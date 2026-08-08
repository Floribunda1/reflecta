import { describe, expect, test, vi } from "vitest";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { getSharedModelRuntime, refreshSharedModelRuntime } from "./pi-model-runtime";

vi.mock("../../config", () => ({
  getAppConfigDir: () => "/tmp/reflecta-pi-model-runtime-test-config",
  getPiAuthPath: () => "/tmp/reflecta-pi-model-runtime-test-auth.json",
  getAiConfig: () => ({ providers: [] }),
  getAiProviderDefinition: () => ({ id: "", name: "", piProviderId: "", models: [] }),
}));

describe("shared ModelRuntime", () => {
  test("reuses a single runtime across calls instead of creating per message", async () => {
    const create = vi.spyOn(ModelRuntime, "create");
    try {
      const first = await getSharedModelRuntime();
      const second = await getSharedModelRuntime();
      expect(second).toBe(first);
      expect(create).toHaveBeenCalledTimes(1);
    } finally {
      create.mockRestore();
    }
  });

  test("refresh rebuilds the shared runtime and serves the fresh instance next", async () => {
    const before = await getSharedModelRuntime();
    const after = await refreshSharedModelRuntime();
    expect(after).not.toBe(before);
    expect(await getSharedModelRuntime()).toBe(after);
  });
});
