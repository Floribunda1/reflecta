import type { Command } from "commander";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerGraphPathAction(cli: Command): void {
  registerActionMeta("graph", "path", {
    name: "path",
    description: "Find paths between two understandings",
    mutates: false,
    hidden: true,
    options: [
      { flags: "--from <id>", description: "Source understanding ID", required: true },
      { flags: "--to <id>", description: "Target understanding ID", required: true },
    ],
    returns: "GraphPathResult — { from, to, paths: { nodes, edges }[] }",
  });
  cli
    .command("path")
    .description("Find paths between two understandings")
    .requiredOption("--from <id>", "Source understanding ID")
    .requiredOption("--to <id>", "Target understanding ID")
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
