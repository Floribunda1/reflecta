import type { Command } from "commander";
import type { ThoughtType, UpdateThoughtInput } from "@reflecta/server";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerUpdateThoughtAction(cli: Command): void {
  registerActionMeta("thought", "update", {
    name: "update",
    description: "Update a thought",
    mutates: true,
    arguments: [{ name: "id", description: "Thought ID", required: true }],
    options: [
      { flags: "--type <type>", description: "Thought type (idea | insight)", required: false },
      { flags: "--title <title>", description: "Thought title", required: false },
      {
        flags: "--body <body>",
        description: "Thought body. Use [[title#thought-id]] to create links",
        required: false,
      },
      {
        flags: "--category-id <ids>",
        description: "Replace category IDs, comma-separated",
        required: false,
      },
    ],
    returns: "ThoughtDetail — ThoughtSummary + contextCount, referenceCount, referencedByCount",
  });
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
      if (options.body !== undefined) input.body = options.body;
      if (options.categoryId !== undefined) {
        input.categoryIds = options.categoryId
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return services.thoughts.updateThought(id, input);
    },
    { ...options, mutates: true },
  );
}
