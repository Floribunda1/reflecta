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
      description: "List contexts for a thought",
      mutates: false,
      options: [{ flags: "--thought-id <id>", description: "Thought ID", required: true }],
      returns: "ContextDetail[] — { id, thoughtId, sourceType, sourceName, content }[]",
    },
    "Manage contexts",
  );
  cli
    .command("list")
    .description("List contexts for a thought")
    .requiredOption("--thought-id <id>", "Thought ID")
    .action((_options, actionCli) => listContextsAction(actionCli));
}

export async function listContextsAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & { thoughtId?: string };
  await runCommand(async () => {
    if (!options.thoughtId) {
      throw new CliError(ErrorCodes.VALIDATION_ERROR, "Missing required option --thought-id.");
    }
    const services = await getServices();
    return services.contexts.listContexts(options.thoughtId);
  }, options);
}
