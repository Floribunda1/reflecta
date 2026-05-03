import type { Command } from "commander";
import { getServices } from "../../services";
import {
  getCommandOptions,
  parseIntegerOption,
  runCommand,
  type GlobalOptions,
} from "../../runner";

import { registerActionMeta } from "../meta";

export function registerInspectCategoryAction(cli: Command): void {
  registerActionMeta("category", "inspect", {
    name: "inspect",
    description: "Inspect a category and its thoughts",
    mutates: false,
    arguments: [{ name: "id", description: "Category ID", required: true }],
    options: [
      {
        flags: "--include-contexts",
        description: "Include full context objects for thoughts",
        required: false,
      },
      {
        flags: "--include-edges",
        description: "Include reference edges between thoughts",
        required: false,
      },
      { flags: "--limit <n>", description: "Limit results", required: false, defaultValue: 200 },
      { flags: "--offset <n>", description: "Result offset", required: false, defaultValue: 0 },
    ],
    returns: "CategoryInspectResult — { category, categories, thoughts, contexts?, edges?, page }",
  });
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
