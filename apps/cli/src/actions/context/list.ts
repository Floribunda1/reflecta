import type { Command } from "commander";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerListContextsAction(cli: Command): void {
  registerActionMeta(
    "context",
    "list",
    {
      name: "list",
      description: "List contexts for an understanding",
      mutates: false,
      options: [
        { flags: "--understanding-id <id>", description: "Understanding ID", required: true },
      ],
      returns: "ContextDetail[] — { id, understandingId, medium, title, content }[]",
    },
    "Manage contexts",
  );
  cli
    .command("list")
    .description("List contexts for an understanding")
    .requiredOption("--understanding-id <id>", "Understanding ID")
    .action((_options, actionCli) => listContextsAction(actionCli));
}

export async function listContextsAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & { understandingId?: string };
  await runCommand(async () => {
    if (!options.understandingId) {
      throw new CliError(
        ErrorCodes.VALIDATION_ERROR,
        "Missing required option --understanding-id.",
      );
    }
    const services = await getServices();
    return services.contexts.listContexts(options.understandingId);
  }, options);
}
