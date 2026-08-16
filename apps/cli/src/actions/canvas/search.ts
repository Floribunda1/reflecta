import type { Command } from "commander";
import { getServices } from "../../services";
import {
  getCommandOptions,
  parseIntegerOption,
  runCommand,
  type GlobalOptions,
} from "../../runner";

import { registerActionMeta } from "../meta";

export function registerSearchCanvasesAction(cli: Command): void {
  registerActionMeta("canvas", "search", {
    name: "search",
    description:
      "Search canvases by free-text query (OR across title / elements / labels / referenced understanding titles) or by understanding ID",
    mutates: false,
    arguments: [{ name: "query", description: "Free-text query (1-5 words)", required: false }],
    options: [
      {
        flags: "--understanding-id <id>",
        description: "Reverse query: canvases referencing this understanding",
        required: false,
      },
      { flags: "--limit <n>", description: "Limit results", required: false, defaultValue: 20 },
    ],
    returns: "CanvasHit[] — { canvas, snippet, reason }",
  });
  cli
    .command("search [query]")
    .description("Search canvases (query OR fields, or --understanding-id reverse)")
    .option("--understanding-id <id>", "Reverse query: canvases referencing this understanding")
    .option("--limit <n>", "Limit results", parseIntegerOption, 20)
    .action((query, _options, actionCli) => searchCanvasesAction(query, actionCli));
}

export async function searchCanvasesAction(query: string | undefined, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    understandingId?: string;
    limit?: number;
  };
  await runCommand(async () => {
    const services = await getServices();
    return services.canvases.searchCanvases({
      query,
      understandingId: options.understandingId,
      limit: options.limit ?? 20,
    });
  }, options);
}
