import type { Command } from "commander";
import type { ThoughtType, ListThoughtsFilter } from "@reflecta/server";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import {
  getCommandOptions,
  parseIntegerOption,
  runCommand,
  type GlobalOptions,
} from "../../runner";

import { registerActionMeta } from "../meta";

export function registerListThoughtsAction(cli: Command): void {
  registerActionMeta(
    "thought",
    "list",
    {
      name: "list",
      description: "List thoughts",
      mutates: false,
      options: [
        { flags: "--type <type>", description: "Filter by type (idea | insight)", required: false },
        { flags: "--category-id <id>", description: "Filter by category ID", required: false },
        {
          flags: "--include-descendants",
          description: "Include descendant categories when filtering by category",
          required: false,
        },
        {
          flags: "--recent",
          description: "Sort by recently updated (descending)",
          required: false,
        },
        { flags: "--limit <n>", description: "Limit results", required: false, defaultValue: 20 },
      ],
      returns: "ThoughtSummary[] — { id, type, title, body, categories }[]",
    },
    "Manage thoughts",
  );
  cli
    .command("list")
    .description("List thoughts")
    .option("--type <type>", "Filter by type (idea | insight)")
    .option("--category-id <id>", "Filter by category ID")
    .option("--include-descendants", "Include descendant categories when filtering by category")
    .option("--recent", "Sort by recently updated (descending)")
    .option("--limit <n>", "Limit results", parseIntegerOption, 20)
    .action((_options, actionCli) => listThoughtsAction(actionCli));
}

export async function listThoughtsAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    type?: string;
    categoryId?: string;
    includeDescendants?: boolean;
    recent?: boolean;
    limit?: number;
  };
  await runCommand(async () => {
    const services = await getServices();
    const limit = options.limit ?? 20;

    if (options.recent) {
      if (options.categoryId || options.type) {
        throw new CliError(
          ErrorCodes.VALIDATION_ERROR,
          "--recent cannot be combined with --category-id or --type.",
        );
      }
      return services.thoughts.listRecentThoughts(limit);
    }

    const filter: ListThoughtsFilter = {};
    if (options.type) filter.type = options.type as ThoughtType;
    if (options.categoryId) {
      filter.categoryIds = [options.categoryId];
      if (options.includeDescendants) filter.includeDescendants = true;
    }
    filter.limit = limit;

    return services.thoughts.listThoughts(filter);
  }, options);
}
