import type { Command } from "commander";
import { getServices } from "../../services";
import {
  getCommandOptions,
  parseIntegerOption,
  runCommand,
  type GlobalOptions,
} from "../../runner";
import { normalizeFtsQuery } from "./shared";

export function registerSearchContextsAction(cli: Command): void {
  cli
    .command("contexts <query>")
    .description("Full-text search contexts")
    .option("--limit <n>", "Limit results", parseIntegerOption, 20)
    .option("--offset <n>", "Result offset", parseIntegerOption, 0)
    .action((query, _options, actionCli) => searchContextsAction(query, actionCli));
}

export async function searchContextsAction(query: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & { limit?: number; offset?: number };
  await runCommand(async () => {
    const services = await getServices();
    const normalizedQuery = normalizeFtsQuery(query);
    return services.search.searchContexts(normalizedQuery, {
      limit: options.limit ?? 20,
      offset: options.offset ?? 0,
    });
  }, options);
}
