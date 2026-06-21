import { describe, expect, test, vi } from "vitest";

vi.mock("electron", () => ({
  net: { fetch: vi.fn() },
  protocol: {
    handle: vi.fn(),
    registerSchemesAsPrivileged: vi.fn(),
  },
}));

describe("asset protocol", () => {
  test("extracts only single asset filenames", async () => {
    const { assetFilename } = await import("./assetProtocol");

    expect(assetFilename("asset:///saved.png")).toBe("saved.png");
    expect(assetFilename("asset://saved.png")).toBe("saved.png");
    expect(assetFilename("asset:///..")).toBeNull();
    expect(assetFilename("asset:///%2E%2E%2Fsecret.txt")).toBeNull();
    expect(assetFilename("asset:///nested/file.png")).toBeNull();
  });
});
