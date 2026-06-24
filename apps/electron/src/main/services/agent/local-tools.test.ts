import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { readLocalFileForTool, runBashForTool } from "./local-tools";

describe("local agent tools", () => {
  test("reads local text files with truncation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reflecta-local-tools-"));
    const path = join(dir, "note.txt");
    await writeFile(path, "hello local file");

    const result = await readLocalFileForTool({ path, maxBytes: 5 });

    expect(result).toMatchObject({
      path,
      encoding: "utf8",
      content: "hello",
      truncated: true,
    });
  });

  test("runs bash commands and returns stdout after approval execution", async () => {
    const result = await runBashForTool({ command: "printf hello" });

    expect(result).toMatchObject({
      command: "printf hello",
      exitCode: 0,
      stdout: "hello",
    });
  });
});
