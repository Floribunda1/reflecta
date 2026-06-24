import type { Command } from "commander";
import { ErrorCodes, CliError } from "./error";
import { writeData, writeError, type OutputFormat } from "./output";
import { initializeDb } from "./db";

export type GlobalOptions = {
  format: OutputFormat;
  yes: boolean;
  quiet: boolean;
  verbose: boolean;
  appConfigDir?: string;
  contentRoot?: string;
  db?: string;
};

export async function runCommand<T>(
  handler: () => Promise<T>,
  opts: GlobalOptions & { mutates?: boolean; requiresFullStore?: boolean },
): Promise<void> {
  if (opts.mutates && !opts.yes) {
    writeError(
      ErrorCodes.CONFIRMATION_REQUIRED,
      "This command mutates data. Pass --yes to execute.",
    );
    process.exitCode = 3;
    return;
  }

  try {
    await initializeDb(opts);
    const result = await handler();
    if (!opts.quiet) {
      writeData(result, opts.format);
    }
    process.exitCode = 0;
  } catch (err) {
    if (err instanceof CliError) {
      writeError(err.code, err.message, err.details);
      process.exitCode = err.code === ErrorCodes.CONFIRMATION_REQUIRED ? 3 : 1;
    } else if (err instanceof Error) {
      if (err.message.toLowerCase().includes("not found")) {
        writeError(ErrorCodes.NOT_FOUND, err.message);
        process.exitCode = 1;
      } else {
        writeError(ErrorCodes.INTERNAL_ERROR, err.message);
        process.exitCode = 1;
      }
    } else {
      writeError(ErrorCodes.INTERNAL_ERROR, String(err));
      process.exitCode = 1;
    }
  }
}

export function getCommandOptions(command: Command): GlobalOptions {
  return command.optsWithGlobals<GlobalOptions>();
}

export function parseIntegerOption(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new CliError(
      ErrorCodes.VALIDATION_ERROR,
      `Expected integer option value, got "${value}".`,
    );
  }
  return parsed;
}
