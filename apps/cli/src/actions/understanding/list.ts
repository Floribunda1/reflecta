import type { Command } from "commander";
import type { ListUnderstandingsFilter } from "@reflecta/server";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import {
  getCommandOptions,
  parseIntegerOption,
  runCommand,
  type GlobalOptions,
} from "../../runner";

import { registerActionMeta } from "../meta";

export function registerListUnderstandingsAction(cli: Command): void {
  registerActionMeta(
    "understanding",
    "list",
    {
      name: "list",
      description: "List understandings",
      mutates: false,
      options: [
        { flags: "--domain-id <id>", description: "Filter by domain ID", required: false },
        {
          flags: "--include-descendants",
          description: "Include descendant domains when filtering by domain",
          required: false,
        },
        {
          flags: "--recent",
          description: "Sort by recently updated (descending)",
          required: false,
        },
        { flags: "--limit <n>", description: "Limit results", required: false, defaultValue: 20 },
      ],
      returns: "UnderstandingSummary[] — { id, title, body, domains }[]",
    },
    "Manage understandings",
  );
  cli
    .command("list")
    .description("List understandings")
    .option("--domain-id <id>", "Filter by domain ID")
    .option("--include-descendants", "Include descendant domains when filtering by domain")
    .option("--recent", "Sort by recently updated (descending)")
    .option("--limit <n>", "Limit results", parseIntegerOption, 20)
    .action((_options, actionCli) => listUnderstandingsAction(actionCli));
}

export async function listUnderstandingsAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    domainId?: string;
    includeDescendants?: boolean;
    recent?: boolean;
    limit?: number;
  };
  await runCommand(async () => {
    const services = await getServices();
    const limit = options.limit ?? 20;

    if (options.recent) {
      if (options.domainId) {
        throw new CliError(
          ErrorCodes.VALIDATION_ERROR,
          "--recent cannot be combined with --domain-id.",
        );
      }
      return services.understandings.listRecentUnderstandings(limit);
    }

    const filter: ListUnderstandingsFilter = {};
    if (options.domainId) {
      filter.domainIds = [options.domainId];
      if (options.includeDescendants) filter.includeDescendants = true;
    }
    filter.limit = limit;

    return services.understandings.listUnderstandings(filter);
  }, options);
}
