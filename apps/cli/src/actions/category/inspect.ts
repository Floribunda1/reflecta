import type { Command } from "commander";
import { getServices } from "../../services";
import {
  getCommandOptions,
  parseIntegerOption,
  runCommand,
  type GlobalOptions,
} from "../../runner";

export function registerInspectCategoryAction(cli: Command): void {
  cli
    .command("inspect <id>")
    .description("Inspect a category and its thoughts")
    .option("--include-contexts", "Include full context objects for thoughts")
    .option("--include-edges", "Include reference edges between thoughts")
    .option("--limit <n>", "Limit results", parseIntegerOption, 200)
    .option("--offset <n>", "Result offset", parseIntegerOption, 0)
    .action((id, _options, actionCli) => inspectCategoryAction(id, actionCli));
}

export async function inspectCategoryAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    includeContexts?: boolean;
    includeEdges?: boolean;
    limit?: number;
    offset?: number;
  };
  await runCommand(async () => {
    const services = await getServices();
    return services.categories.inspectCategory(id, {
      includeContexts: options.includeContexts,
      includeEdges: options.includeEdges,
      limit: options.limit,
      offset: options.offset,
    });
  }, options);
}
