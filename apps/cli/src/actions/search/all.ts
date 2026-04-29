import type { Command } from "commander";
import { getServices } from "../../services";
import {
  getCommandOptions,
  parseIntegerOption,
  runCommand,
  type GlobalOptions,
} from "../../runner";
import { compactSearchResult } from "../compact";
import { normalizeFtsQuery } from "./shared";

export function registerSearchAllAction(cli: Command): void {
  cli
    .command("all <query>")
    .description("Search both thoughts and contexts")
    .option("--limit <n>", "Limit results", parseIntegerOption, 20)
    .option("--offset <n>", "Result offset", parseIntegerOption, 0)
    .action((query, _options, actionCli) => searchAllAction(query, actionCli));
}

export async function searchAllAction(query: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & { limit?: number; offset?: number };
  await runCommand(async () => {
    const services = await getServices();
    const normalizedQuery = normalizeFtsQuery(query);
    return compactSearchResult(
      await services.search.search(normalizedQuery, {
        limit: options.limit ?? 20,
        offset: options.offset ?? 0,
      }),
    );
  }, options);
}
