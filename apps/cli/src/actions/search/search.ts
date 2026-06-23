import type { Command } from "commander";
import { getServices } from "../../services";
import {
  getCommandOptions,
  parseIntegerOption,
  runCommand,
  type GlobalOptions,
} from "../../runner";
import { normalizeFtsQuery } from "./shared";

import { registerActionMeta } from "../meta";

export function registerSearchAction(cli: Command): void {
  registerActionMeta(
    "search",
    "search",
    {
      name: "search",
      description: "Search understandings and contexts",
      mutates: false,
      arguments: [{ name: "query", description: "Search query", required: true }],
      options: [
        { flags: "--limit <n>", description: "Limit results", required: false, defaultValue: 20 },
        { flags: "--offset <n>", description: "Result offset", required: false, defaultValue: 0 },
      ],
      returns: "SearchOutput — { hits: SearchHit[] }",
    },
    "Search understandings and contexts",
  );
  cli
    .argument("<query>", "Search query")
    .option("--limit <n>", "Limit results", parseIntegerOption, 20)
    .option("--offset <n>", "Result offset", parseIntegerOption, 0)
    .action((query, _options, actionCli) => searchAction(query, actionCli));
}

export async function searchAction(query: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & { limit?: number; offset?: number };
  await runCommand(async () => {
    const services = await getServices();
    const normalizedQuery = normalizeFtsQuery(query);
    return services.search.search(normalizedQuery, {
      limit: options.limit ?? 20,
      offset: options.offset ?? 0,
    });
  }, options);
}
