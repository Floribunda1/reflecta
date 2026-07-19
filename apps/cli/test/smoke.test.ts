import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { runCommand, parseJsonl, parseJson } from "./helpers";

const CLI_ROOT = path.resolve(import.meta.dirname, "..");

describe("Smoke test — infrastructure validation", () => {
  it("seeded database responds to domain list", async () => {
    const { code, stdout, stderr } = await runCommand(["domain", "list"]);
    expect(stderr).toBe("");
    expect(code).toBe(0);

    const domains = parseJsonl(stdout);
    expect(domains.length).toBeGreaterThan(0);
    expect(domains[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
    });
  });

  it("seeded database responds to understanding list", async () => {
    const { code, stdout } = await runCommand(["understanding", "list"]);
    expect(code).toBe(0);

    const understandings = parseJsonl(stdout);
    expect(understandings.length).toBeGreaterThan(0);
  });

  it("json format returns a single array", async () => {
    const { code, stdout } = await runCommand(["domain", "list", "--format", "json"]);
    expect(code).toBe(0);

    const data = parseJson(stdout);
    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });

  it("quiet mode suppresses stdout on read", async () => {
    const { code, stdout } = await runCommand(["domain", "list", "--quiet"]);
    expect(code).toBe(0);
    expect(stdout).toBe("");
  });
});

describe("Release build — packaged CLI", () => {
  let buildOutput = "";

  beforeAll(() => {
    const result = spawnSync("bun", ["run", "build"], {
      cwd: CLI_ROOT,
      encoding: "utf-8",
    });
    buildOutput = `${result.stdout}${result.stderr}`;

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });

  it("leaves platform-specific native dependencies to the package manager", () => {
    expect(buildOutput).not.toContain("[UNRESOLVED_IMPORT]");
    expect(buildOutput).not.toMatch(/dist\/assets\/.*\.node/);
  });

  it("starts with release migrations available", () => {
    const result = spawnSync("node", ["dist/index.mjs", "--help"], {
      cwd: CLI_ROOT,
      encoding: "utf-8",
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage:");
  });
});
