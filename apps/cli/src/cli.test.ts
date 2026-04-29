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
  it("prints list-actions as a success JSON envelope", async () => {
    const capture = createIo();
    const code = await runCli(["list-actions"], capture.io);
    const output = JSON.parse(capture.stdout) as { ok: boolean; data: unknown[] };

    expect(code).toBe(0);
    expect(capture.stderr).toBe("");
    expect(output.ok).toBe(true);
    expect(output.data.length).toBeGreaterThan(0);
    expect(output.data[0]).not.toHaveProperty("inputSchema");
  });

  it("prints per-action help as a success JSON envelope", async () => {
    const capture = createIo();
    const code = await runCli(["help", "search_thoughts"], capture.io);
    const output = JSON.parse(capture.stdout) as {
      ok: boolean;
      data?: { input?: unknown; output?: unknown };
    };

    expect(code).toBe(0);
    expect(output.ok).toBe(true);
    expect(output.data?.input).toBeTruthy();
    expect(output.data?.output).toBeTruthy();
  });

  it("returns failure JSON for unknown action help", async () => {
    const capture = createIo();
    const code = await runCli(["help", "missing_action"], capture.io);
    const output = JSON.parse(capture.stdout) as {
      ok: boolean;
      error?: { code: string };
    };

    expect(code).toBe(1);
    expect(output.ok).toBe(false);
    expect(output.error?.code).toBe("UNKNOWN_ACTION");
  });

  it("injects --confirm into action JSON", async () => {
    const capture = createIo();
    const code = await runCli(
      ["delete_thought", "--json", '{"id":"thought-1"}', "--confirm"],
      capture.io,
    );
    const output = JSON.parse(capture.stdout) as {
      ok: boolean;
      error?: { code: string };
    };

    expect([0, 1]).toContain(code);
    if (!output.ok) {
      expect(output.error?.code).not.toBe("CONFIRMATION_REQUIRED");
    }
  });

  it("returns failure JSON and exit code 1 for invalid JSON", async () => {
    const capture = createIo();
    const code = await runCli(["search_thoughts", "--json", "not-json"], capture.io);
    const output = JSON.parse(capture.stdout) as {
      ok: boolean;
      error?: { code: string };
    };

    expect(code).toBe(1);
    expect(capture.stderr).toBe("");
    expect(output.ok).toBe(false);
    expect(output.error?.code).toBe("INVALID_JSON");
  });

  it("returns failure JSON and exit code 1 for unknown actions", async () => {
    const capture = createIo();
    const code = await runCli(["missing_action", "--json", "{}"], capture.io);
    const output = JSON.parse(capture.stdout) as {
      ok: boolean;
      error?: { code: string };
    };

    expect(code).toBe(1);
    expect(output.ok).toBe(false);
    expect(output.error?.code).toBe("UNKNOWN_ACTION");
  });

  it("accepts --json=value syntax", async () => {
    const capture = createIo();
    const code = await runCli(["missing_action", '--json={"ok":true}'], capture.io);
    const output = JSON.parse(capture.stdout) as {
      ok: boolean;
      error?: { code: string };
    };

    expect(code).toBe(1);
    expect(output.ok).toBe(false);
    expect(output.error?.code).toBe("UNKNOWN_ACTION");
  });

  it("returns failure JSON for missing --json", async () => {
    const capture = createIo();
    const code = await runCli(["search_thoughts"], capture.io);
    const output = JSON.parse(capture.stdout) as {
      ok: boolean;
      error?: { code: string };
    };

    expect(code).toBe(1);
    expect(output.ok).toBe(false);
    expect(output.error?.code).toBe("INVALID_ARGUMENTS");
  });

  it("returns failure JSON for unknown options", async () => {
    const capture = createIo();
    const code = await runCli(["search_thoughts", "--json", "{}", "--bad"], capture.io);
    const output = JSON.parse(capture.stdout) as {
      ok: boolean;
      error?: { code: string };
    };

    expect(code).toBe(1);
    expect(output.ok).toBe(false);
    expect(output.error?.code).toBe("INVALID_ARGUMENTS");
  });
});
