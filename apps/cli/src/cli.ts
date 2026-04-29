import { cac } from "cac";
import { callAction, failure, getActionHelp, listActions, type CliResult } from "./actions";

type CliIO = {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
};

type ParsedJson = { parsed: true; value: Record<string, unknown> } | CliResult;

function printJson(io: CliIO, value: unknown): void {
  io.stdout.write(`${JSON.stringify(value)}\n`);
}

function printText(io: CliIO, value: string): void {
  io.stdout.write(`${value}\n`);
}

function printError(io: CliIO, result: CliResult): void {
  if (result.ok) {
    return;
  }

  io.stderr.write(`${result.error.code}: ${result.error.message}\n`);
  if (result.error.details !== undefined) {
    io.stderr.write(`${JSON.stringify(result.error.details)}\n`);
  }
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
    "reflecta list-actions",
    "reflecta help <action>",
    "reflecta <action> --json '<json>' [--confirm]",
  ].join("\n");
}

function formatTopLevelHelp(): string {
  return usage();
}

function formatActions(): string {
  return listActions()
    .map((action) => `${action.name}${action.mutates ? "!" : ""}`)
    .join("\n");
}

function formatActionHelp(name: string): string | undefined {
  const help = getActionHelp(name);
  if (!help) {
    return undefined;
  }

  return [
    `name ${help.name}`,
    `mutates ${help.mutates ? "1" : "0"}`,
    `req ${help.input.required.join(",") || "-"}`,
    `opt ${help.input.optional.join(",") || "-"}`,
    `json ${JSON.stringify(help.input.example)}`,
    `out ${help.output.description}`,
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
    printText(io, formatActions());
  });

  cli
    .command("help <action>", "Show input and output help for one action.")
    .action((name: string) => {
      const help = formatActionHelp(name);
      if (!help) {
        printError(io, failure("UNKNOWN_ACTION", `Unknown action: ${name}`));
        exitCode = 1;
        return;
      }

      printText(io, help);
    });

  cli
    .command("<action>", "Run a Reflecta action.")
    .option("--json <json>", "Action arguments as a JSON object.")
    .option("--confirm", "Inject confirm: true for mutating actions.")
    .action(async (actionName: string, options: { json?: unknown; confirm?: boolean }) => {
      if (typeof options.json !== "string") {
        printError(io, failure("INVALID_ARGUMENTS", "Action commands require --json '<json>'."));
        exitCode = 1;
        return;
      }

      const parsed = parseJson(options.json);
      if (isCliResult(parsed)) {
        printError(io, parsed);
        exitCode = 1;
        return;
      }

      if (options.confirm) {
        parsed.value.confirm = true;
      }

      const result = await callAction(actionName, parsed.value);
      if (result.ok) {
        if (result.data !== undefined) {
          printJson(io, result.data);
        }
      } else {
        printError(io, result);
      }
      exitCode = result.ok ? 0 : 1;
    });

  if (argv.includes("-h") || argv.includes("--help")) {
    printText(io, formatTopLevelHelp());
    return 0;
  }

  if (argv.length === 0) {
    const result = failure("USAGE", usage());
    printError(io, result);
    return 1;
  }

  try {
    cli.parse(["node", "reflecta", ...argv], { run: false });
    await cli.runMatchedCommand();
    return exitCode;
  } catch (err) {
    printError(io, failure("INVALID_ARGUMENTS", err instanceof Error ? err.message : String(err)));
    return 1;
  }
}
