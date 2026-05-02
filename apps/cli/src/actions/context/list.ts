import type { Command } from "commander";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

export function registerListContextsAction(cli: Command): void {
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
