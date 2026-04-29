import type { Command } from "commander";
import { getServices } from "../../services";
import {
  getCommandOptions,
  parseIntegerOption,
  runCommand,
  type GlobalOptions,
} from "../../runner";
import { compactThoughtSummary } from "../compact";
import { normalizeFtsQuery } from "./shared";

export function registerSearchThoughtsAction(cli: Command): void {
  cli
    .command("thoughts <query>")
    .description("Full-text search thoughts")
    .option("--limit <n>", "Limit results", parseIntegerOption, 20)
    .option("--offset <n>", "Result offset", parseIntegerOption, 0)
    .action((query, _options, actionCli) => searchThoughtsAction(query, actionCli));
}

export async function searchThoughtsAction(query: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & { limit?: number; offset?: number };
  await runCommand(async () => {
    const services = await getServices();
    const normalizedQuery = normalizeFtsQuery(query);
    return (
      await services.search.searchThoughts(normalizedQuery, {
        limit: options.limit ?? 20,
        offset: options.offset ?? 0,
      })
    ).map(compactThoughtSummary);
  }, options);
}
