import { execFile } from "node:child_process";
import { open } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_FILE_READ_MAX_BYTES = 200_000;
export const HARD_FILE_READ_MAX_BYTES = 1_000_000;
const MAX_BASH_OUTPUT_CHARS = 120_000;
const DEFAULT_BASH_TIMEOUT_MS = 10_000;
export const MAX_BASH_TIMEOUT_MS = 30_000;

type BashToolInput = {
  command: string;
  cwd?: string;
  timeoutMs?: number;
};

function localPath(value: string) {
  if (value === "~") return homedir();
  if (value.startsWith("~/")) return resolve(homedir(), value.slice(2));
  return resolve(value);
}

function clampInt(value: number | undefined, fallback: number, max: number) {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.floor(value), 1), max);
}

function truncateText(value: string) {
  if (value.length <= MAX_BASH_OUTPUT_CHARS) return { value, truncated: false };
  return { value: value.slice(0, MAX_BASH_OUTPUT_CHARS), truncated: true };
}

function looksBinary(buffer: Buffer) {
  return buffer.includes(0);
}

export async function readLocalFileForTool(input: { path: string; maxBytes?: number }) {
  const path = localPath(input.path);
  const limit = clampInt(input.maxBytes, DEFAULT_FILE_READ_MAX_BYTES, HARD_FILE_READ_MAX_BYTES);
  const handle = await open(path, "r");
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) throw new Error("路径不是文件");
    const readBytes = Math.min(stats.size, limit + 1);
    const buffer = Buffer.alloc(readBytes);
    const result = await handle.read(buffer, 0, readBytes, 0);
    const data = buffer.subarray(0, Math.min(result.bytesRead, limit));
    const truncated = stats.size > limit || result.bytesRead > limit;
    const base = { path, bytes: stats.size, truncated };
    if (looksBinary(data)) return { ...base, encoding: "base64", content: data.toString("base64") };
    return { ...base, encoding: "utf8", content: data.toString("utf8") };
  } finally {
    await handle.close();
  }
}

export async function runBashForTool(input: BashToolInput) {
  const timeoutMs = clampInt(input.timeoutMs, DEFAULT_BASH_TIMEOUT_MS, MAX_BASH_TIMEOUT_MS);
  const cwd = input.cwd ? localPath(input.cwd) : undefined;
  try {
    const { stdout, stderr } = await execFileAsync("bash", ["-lc", input.command], {
      cwd,
      timeout: timeoutMs,
      maxBuffer: MAX_BASH_OUTPUT_CHARS * 4,
    });
    const out = truncateText(stdout);
    const err = truncateText(stderr);
    return {
      command: input.command,
      cwd,
      exitCode: 0,
      stdout: out.value,
      stderr: err.value,
      truncated: out.truncated || err.truncated,
    };
  } catch (error) {
    const record = error as {
      code?: unknown;
      stdout?: unknown;
      stderr?: unknown;
      killed?: boolean;
    };
    const out = truncateText(typeof record.stdout === "string" ? record.stdout : "");
    const err = truncateText(typeof record.stderr === "string" ? record.stderr : String(error));
    return {
      command: input.command,
      cwd,
      exitCode: typeof record.code === "number" ? record.code : null,
      stdout: out.value,
      stderr: err.value,
      timedOut: record.killed || undefined,
      truncated: out.truncated || err.truncated,
    };
  }
}
