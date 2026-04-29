import { describe, expect, it } from "vitest";
import { runCli } from "./cli";

function createIo() {
  let stdout = "";
  let stderr = "";

  return {
    io: {
      stdout: {
        write: (chunk: string) => {
          stdout += chunk;
          return true;
        },
      },
      stderr: {
        write: (chunk: string) => {
          stderr += chunk;
          return true;
        },
      },
    },
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
  };
}

describe("Reflecta CLI", () => {
  it("prints top-level help as text", async () => {
    const capture = createIo();
    const code = await runCli(["--help"], capture.io);

    expect(code).toBe(0);
    expect(capture.stderr).toBe("");
    expect(capture.stdout).toContain("reflecta list-actions");
    expect(capture.stdout).toContain("reflecta help <action>");
  });

  it("prints list-actions as text", async () => {
    const capture = createIo();
    const code = await runCli(["list-actions"], capture.io);

    expect(code).toBe(0);
    expect(capture.stderr).toBe("");
    expect(capture.stdout).toContain("search_thoughts");
    expect(capture.stdout).toContain("create_thought!");
    expect(capture.stdout).not.toContain("Full-text search Reflecta thoughts");
    expect(capture.stdout).not.toContain("inputSchema");
  });

  it("prints per-action help as text", async () => {
    const capture = createIo();
    const code = await runCli(["help", "search_thoughts"], capture.io);

    expect(code).toBe(0);
    expect(capture.stderr).toBe("");
    expect(capture.stdout).toContain("name search_thoughts");
    expect(capture.stdout).toContain("mutates 0");
    expect(capture.stdout).toContain("req query");
    expect(capture.stdout).toContain('json {"query":"design","limit":20,"offset":0}');
    expect(capture.stdout).not.toContain('"properties"');
  });

  it("returns an stderr error for unknown action help", async () => {
    const capture = createIo();
    const code = await runCli(["help", "missing_action"], capture.io);

    expect(code).toBe(1);
    expect(capture.stdout).toBe("");
    expect(capture.stderr).toContain("UNKNOWN_ACTION");
  });

  it("injects --confirm into action JSON", async () => {
    const capture = createIo();
    const code = await runCli(
      ["delete_thought", "--json", '{"id":"thought-1"}', "--confirm"],
      capture.io,
    );

    expect([0, 1]).toContain(code);
    if (code === 1) {
      expect(capture.stderr).not.toContain("CONFIRMATION_REQUIRED");
    } else {
      expect(capture.stdout).toBe("");
    }
  });

  it("returns an stderr error and exit code 1 for invalid JSON", async () => {
    const capture = createIo();
    const code = await runCli(["search_thoughts", "--json", "not-json"], capture.io);

    expect(code).toBe(1);
    expect(capture.stdout).toBe("");
    expect(capture.stderr).toContain("INVALID_JSON");
  });

  it("returns an stderr error and exit code 1 for unknown actions", async () => {
    const capture = createIo();
    const code = await runCli(["missing_action", "--json", "{}"], capture.io);

    expect(code).toBe(1);
    expect(capture.stdout).toBe("");
    expect(capture.stderr).toContain("UNKNOWN_ACTION");
  });

  it("accepts --json=value syntax", async () => {
    const capture = createIo();
    const code = await runCli(["missing_action", '--json={"ok":true}'], capture.io);

    expect(code).toBe(1);
    expect(capture.stdout).toBe("");
    expect(capture.stderr).toContain("UNKNOWN_ACTION");
  });

  it("returns an stderr error for missing --json", async () => {
    const capture = createIo();
    const code = await runCli(["search_thoughts"], capture.io);

    expect(code).toBe(1);
    expect(capture.stdout).toBe("");
    expect(capture.stderr).toContain("INVALID_ARGUMENTS");
  });

  it("returns an stderr error for unknown options", async () => {
    const capture = createIo();
    const code = await runCli(["search_thoughts", "--json", "{}", "--bad"], capture.io);

    expect(code).toBe(1);
    expect(capture.stdout).toBe("");
    expect(capture.stderr).toContain("INVALID_ARGUMENTS");
  });
});
