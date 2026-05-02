import type { Command } from "commander";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

export function registerGraphPathAction(cli: Command): void {
  cli
    .command("path")
    .description("Find paths between two thoughts")
    .requiredOption("--from <id>", "Source thought ID")
    .requiredOption("--to <id>", "Target thought ID")
    .action((_options, actionCli) => graphPathAction(actionCli));
}

export async function graphPathAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    from?: string;
    to?: string;
  };
  await runCommand(async () => {
    if (!options.from) {
      throw new CliError(ErrorCodes.VALIDATION_ERROR, "Missing required option --from.");
    }
    if (!options.to) {
      throw new CliError(ErrorCodes.VALIDATION_ERROR, "Missing required option --to.");
    }
    const services = await getServices();
    return services.graph.graphPath(options.from, options.to);
  }, options);
}
