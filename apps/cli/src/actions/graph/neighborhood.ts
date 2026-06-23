import type { Command } from "commander";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import {
  getCommandOptions,
  parseIntegerOption,
  runCommand,
  type GlobalOptions,
} from "../../runner";

import { registerActionMeta } from "../meta";

export function registerGraphNeighborhoodAction(cli: Command): void {
  registerActionMeta(
    "graph",
    "neighborhood",
    {
      name: "neighborhood",
      description: "Get the neighborhood graph around a understanding",
      mutates: false,
      hidden: true,
      options: [
        { flags: "--understanding-id <id>", description: "Seed understanding ID", required: true },
        {
          flags: "--depth <n>",
          description: "Neighborhood depth",
          required: false,
          defaultValue: 1,
        },
        {
          flags: "--include-contexts",
          description: "Include full context objects",
          required: false,
        },
        { flags: "--limit <n>", description: "Limit results", required: false, defaultValue: 200 },
        { flags: "--offset <n>", description: "Result offset", required: false, defaultValue: 0 },
      ],
      returns: "GraphNeighborhoodResult — { seed, nodes, edges, contexts?, page }",
    },
    "Explore understanding graph",
  );
  cli
    .command("neighborhood")
    .description("Get the neighborhood graph around a understanding")
    .requiredOption("--understanding-id <id>", "Seed understanding ID")
    .option("--depth <n>", "Neighborhood depth", parseIntegerOption, 1)
    .option("--include-contexts", "Include full context objects")
    .option("--limit <n>", "Limit results", parseIntegerOption, 200)
    .option("--offset <n>", "Result offset", parseIntegerOption, 0)
    .action((_options, actionCli) => graphNeighborhoodAction(actionCli));
}

export async function graphNeighborhoodAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    understandingId?: string;
    depth?: number;
    includeContexts?: boolean;
    limit?: number;
    offset?: number;
  };
  await runCommand(async () => {
    if (!options.understandingId) {
      throw new CliError(
        ErrorCodes.VALIDATION_ERROR,
        "Missing required option --understanding-id.",
      );
    }
    const services = await getServices();
    return services.graph.graphNeighborhood(options.understandingId, {
      depth: options.depth,
      includeContexts: options.includeContexts,
      limit: options.limit,
      offset: options.offset,
    });
  }, options);
}
