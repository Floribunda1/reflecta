import type { Command } from "commander";
import type { CreateThoughtInput } from "@reflecta/server";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerCreateThoughtAction(cli: Command): void {
  registerActionMeta("thought", "create", {
    name: "create",
    description: "Create a thought",
    mutates: true,
    options: [
      { flags: "--title <title>", description: "Thought title", required: false },
      {
        flags: "--body <body>",
        description: "Thought body. Use [[title#thought-id]] to create links",
        required: false,
      },
      {
        flags: "--category-id <ids>",
        description: "Category IDs, comma-separated",
        required: false,
      },
    ],
    returns: "ThoughtDetail — ThoughtSummary + contextCount, referenceCount, referencedByCount",
  });
  cli
    .command("create")
    .description("Create a thought")
    .option("--title <title>", "Thought title")
    .option("--body <body>", "Thought body. Use [[title#thought-id]] to create links")
    .option("--category-id <ids>", "Category IDs, comma-separated")
    .action((_options, actionCli) => createThoughtAction(actionCli));
}

export async function createThoughtAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    title?: string;
    body?: string;
    categoryId?: string;
  };
  await runCommand(
    async () => {
      const services = await getServices();
      const input: CreateThoughtInput = {
        title: options.title,
        body: options.body,
        categoryIds: options.categoryId
          ? options.categoryId
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      };
      return services.thoughts.createThought(input);
    },
    { ...options, mutates: true },
  );
}
