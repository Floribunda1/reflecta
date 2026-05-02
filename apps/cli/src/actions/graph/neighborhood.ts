import type { Command } from "commander";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import {
  getCommandOptions,
  parseIntegerOption,
  runCommand,
  type GlobalOptions,
} from "../../runner";

export function registerGraphNeighborhoodAction(cli: Command): void {
  cli
    .command("neighborhood")
    .description("Get the neighborhood graph around a thought")
    .requiredOption("--thought-id <id>", "Seed thought ID")
    .option("--depth <n>", "Neighborhood depth", parseIntegerOption, 1)
    .option("--include-contexts", "Include full context objects")
    .option("--limit <n>", "Limit results", parseIntegerOption, 200)
    .option("--offset <n>", "Result offset", parseIntegerOption, 0)
    .action((_options, actionCli) => graphNeighborhoodAction(actionCli));
}

export async function graphNeighborhoodAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    thoughtId?: string;
    depth?: number;
    includeContexts?: boolean;
    limit?: number;
    offset?: number;
  };
  await runCommand(async () => {
    if (!options.thoughtId) {
      throw new CliError(ErrorCodes.VALIDATION_ERROR, "Missing required option --thought-id.");
    }
    const services = await getServices();
    return services.graph.graphNeighborhood(options.thoughtId, {
      depth: options.depth,
      includeContexts: options.includeContexts,
      limit: options.limit,
      offset: options.offset,
    });
  }, options);
}
