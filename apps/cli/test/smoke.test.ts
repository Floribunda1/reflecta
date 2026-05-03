import { describe, it, expect } from "vitest";
import { runCommand, parseJsonl, parseJson } from "./helpers";

describe("Smoke test — infrastructure validation", () => {
  it("seeded database responds to category list", async () => {
    const { code, stdout, stderr } = await runCommand(["category", "list"]);
    expect(stderr).toBe("");
    expect(code).toBe(0);

    const categories = parseJsonl(stdout);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
    });
  });

  it("seeded database responds to thought list", async () => {
    const { code, stdout } = await runCommand(["thought", "list"]);
    expect(code).toBe(0);

    const thoughts = parseJsonl(stdout);
    expect(thoughts.length).toBeGreaterThan(0);
  });

  it("json format returns a single array", async () => {
    const { code, stdout } = await runCommand(["category", "list", "--format", "json"]);
    expect(code).toBe(0);

    const data = parseJson(stdout);
    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });

  it("quiet mode suppresses stdout on read", async () => {
    const { code, stdout } = await runCommand(["category", "list", "--quiet"]);
    expect(code).toBe(0);
    expect(stdout).toBe("");
  });
});
