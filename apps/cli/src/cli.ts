import { cac } from "cac";
import { callAction, failure, getActionHelp, listActions, type CliResult } from "./actions.js";

type CliIO = {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
};

type ParsedJson = { parsed: true; value: Record<string, unknown> } | CliResult;

function printJson(io: CliIO, value: unknown): void {
  io.stdout.write(`${JSON.stringify(value)}\n`);
}

function isCliResult(value: unknown): value is CliResult {
  return (
    !!value &&
    typeof value === "object" &&
    "ok" in value &&
    typeof (value as { ok?: unknown }).ok === "boolean"
  );
}

function usage(): string {
  return [
    "Usage:",
    "  reflecta list-actions",
    "  reflecta help <action>",
    "  reflecta <action> --json '<json>' [--confirm]",
  ].join("\n");
}

function parseJson(raw: string): ParsedJson {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return failure("INVALID_JSON", "--json must be a JSON object.");
    }
    return { parsed: true, value: parsed as Record<string, unknown> };
  } catch (err) {
    return failure("INVALID_JSON", err instanceof Error ? err.message : String(err));
  }
}

export async function runCli(argv = process.argv.slice(2), io: CliIO = process): Promise<number> {
  const cli = cac("reflecta");
  let exitCode = 0;

  cli.usage("<command> [options]");

  cli.command("list-actions", "List all Reflecta CLI actions.").action(() => {
    printJson(io, { ok: true, data: listActions() });
  });

  cli
    .command("help <action>", "Show input and output help for one action.")
    .action((name: string) => {
      const help = getActionHelp(name);
      if (!help) {
        printJson(io, failure("UNKNOWN_ACTION", `Unknown action: ${name}`));
        exitCode = 1;
        return;
      }

      printJson(io, { ok: true, data: help });
    });

  cli
    .command("<action>", "Run a Reflecta action.")
    .option("--json <json>", "Action arguments as a JSON object.")
    .option("--confirm", "Inject confirm: true for mutating actions.")
    .action(async (actionName: string, options: { json?: unknown; confirm?: boolean }) => {
      if (typeof options.json !== "string") {
        printJson(io, failure("INVALID_ARGUMENTS", "Action commands require --json '<json>'."));
        exitCode = 1;
        return;
      }

      const parsed = parseJson(options.json);
      if (isCliResult(parsed)) {
        printJson(io, parsed);
        exitCode = 1;
        return;
      }

      if (options.confirm) {
        parsed.value.confirm = true;
      }

      const result = await callAction(actionName, parsed.value);
      printJson(io, result);
      exitCode = result.ok ? 0 : 1;
    });

  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    const result = failure("USAGE", usage());
    printJson(io, result);
    io.stderr.write(`${result.error.message}\n`);
    return 1;
  }

  try {
    cli.parse(["node", "reflecta", ...argv], { run: false });
    await cli.runMatchedCommand();
    return exitCode;
  } catch (err) {
    printJson(io, failure("INVALID_ARGUMENTS", err instanceof Error ? err.message : String(err)));
    return 1;
  }
}
