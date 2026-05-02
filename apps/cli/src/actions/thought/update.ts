import type { Command } from "commander";
import type { ThoughtType, UpdateThoughtInput } from "@reflecta/server";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";
import { compactThought } from "../compact";
import { normalizeThoughtBody } from "./wiki-links";

export function registerUpdateThoughtAction(cli: Command): void {
  cli
    .command("update <id>")
    .description("Update a thought")
    .option("--type <type>", "Thought type (idea | insight)")
    .option("--title <title>", "Thought title")
    .option("--body <body>", "Thought body. Use [[title#thought-id]] to create links")
    .option("--category-id <ids>", "Replace category IDs, comma-separated")
    .action((id, _options, actionCli) => updateThoughtAction(id, actionCli));
}

export async function updateThoughtAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    type?: string;
    title?: string;
    body?: string;
    categoryId?: string;
  };
  await runCommand(
    async () => {
      const services = await getServices();
      const input: UpdateThoughtInput = {};
      if (options.type !== undefined) input.type = options.type as ThoughtType;
      if (options.title !== undefined) input.title = options.title;
      if (options.body !== undefined) input.body = normalizeThoughtBody(options.body);
      if (options.categoryId !== undefined) {
        input.categoryIds = options.categoryId
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return compactThought(await services.thoughts.updateThought(id, input));
    },
    { ...options, mutates: true },
  );
}
