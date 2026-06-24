import { runCli } from "../src/cli";
import { execSync } from "node:child_process";

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Run a CLI command in-process and capture stdout/stderr.
 */
export async function runCommand(argv: string[]): Promise<CommandResult> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const shouldInjectRuntimeArgs =
    argv.length > 0 && !argv.includes("--help") && !argv.includes("-h");
  const runtimeArgs = shouldInjectRuntimeArgs
    ? [
        ...(process.env.REFLECTA_CONTENT_STORAGE_ROOT
          ? ["--content-root", process.env.REFLECTA_CONTENT_STORAGE_ROOT]
          : []),
        ...(process.env.REFLECTA_APP_CONFIG_DIR
          ? ["--app-config-dir", process.env.REFLECTA_APP_CONFIG_DIR]
          : []),
      ]
    : [];

  const origLog = console.log;
  const origErr = console.error;

  console.log = (...args: unknown[]) => stdoutLines.push(args.map(String).join(" "));
  console.error = (...args: unknown[]) => stderrLines.push(args.map(String).join(" "));

  const prevExitCode = process.exitCode;
  process.exitCode = undefined;

  try {
    const code = await runCli([...runtimeArgs, ...argv]);
    return {
      code: process.exitCode ?? code ?? 0,
      stdout: stdoutLines.join("\n"),
      stderr: stderrLines.join("\n"),
    };
  } finally {
    console.log = origLog;
    console.error = origErr;
    process.exitCode = prevExitCode;
  }
}

/**
 * Parse JSONL output into an array of objects.
 */
export function parseJsonl(stdout: string): unknown[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return line;
      }
    });
}

/**
 * Parse single JSON output.
 */
export function parseJson(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

/**
 * Assert that the result array contains an object matching the partial shape.
 */
export function expectContains<T extends Record<string, unknown>>(
  arr: T[],
  partial: Partial<T>,
): T | undefined {
  const found = arr.find((item) =>
    Object.entries(partial).every(([key, value]) => item[key] === value),
  );
  return found;
}

/**
 * Extract IDs from a JSONL array of objects.
 */
export function extractIds(arr: Array<{ id?: string }>): string[] {
  return arr.map((item) => item.id).filter((id): id is string => !!id);
}

/**
 * Query the test SQLite database directly via sqlite3 CLI.
 */
export function queryDb<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
): T[] {
  const dbPath = process.env.REFLECTA_DB_PATH;
  if (!dbPath) {
    throw new Error("REFLECTA_DB_PATH is required for test database queries.");
  }
  try {
    const output = execSync(`sqlite3 "${dbPath}" -json "${sql}"`, {
      encoding: "utf-8",
      timeout: 5000,
    });
    if (!output.trim()) return [];
    return JSON.parse(output) as T[];
  } catch {
    return [];
  }
}

/**
 * Get a single row from the test database.
 */
export function queryDbOne<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
): T | undefined {
  const rows = queryDb<T>(sql);
  return rows[0];
}

/**
 * Get the ID of a understanding by its title.
 */
export function getUnderstandingId(title: string): string | undefined {
  const row = queryDbOne<{ id: string }>(
    `SELECT id FROM understandings WHERE title = '${title.replace(/'/g, "''")}' AND deleted_at IS NULL`,
  );
  return row?.id;
}

/**
 * Get the ID of a domain by its name.
 */
export function getDomainId(name: string): string | undefined {
  const row = queryDbOne<{ id: string }>(
    `SELECT id FROM domains WHERE name = '${name.replace(/'/g, "''")}'`,
  );
  return row?.id;
}

/**
 * Get the ID of a deleted understanding by its title.
 */
export function getDeletedUnderstandingId(title: string): string | undefined {
  const row = queryDbOne<{ id: string }>(
    `SELECT id FROM understandings WHERE title = '${title.replace(/'/g, "''")}' AND deleted_at IS NOT NULL`,
  );
  return row?.id;
}

/**
 * Get the ID of a context by its source name.
 */
export function getContextId(title: string): string | undefined {
  const row = queryDbOne<{ id: string }>(
    `SELECT id FROM contexts WHERE title = '${title.replace(/'/g, "''")}' AND deleted_at IS NULL`,
  );
  return row?.id;
}

/**
 * Count rows in a table.
 */
export function countRows(table: string): number {
  const row = queryDbOne<{ c: number }>(`SELECT count(*) AS c FROM ${table}`);
  return row?.c ?? 0;
}
