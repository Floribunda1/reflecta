import type { Command } from "commander";
import type { ThoughtType, CreateThoughtInput } from "@reflecta/server";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerCreateThoughtAction(cli: Command): void {
  registerActionMeta("thought", "create", {
    name: "create",
    description: "Create a thought",
    mutates: true,
    options: [
      { flags: "--type <type>", description: "Thought type (idea | insight)", required: true },
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
    .option("--type <type>", "Thought type (idea | insight)")
    .option("--title <title>", "Thought title")
    .option("--body <body>", "Thought body. Use [[title#thought-id]] to create links")
    .option("--category-id <ids>", "Category IDs, comma-separated")
    .action((_options, actionCli) => createThoughtAction(actionCli));
}

export async function createThoughtAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    type?: string;
    title?: string;
    body?: string;
    categoryId?: string;
  };
  await runCommand(
    async () => {
      if (!options.type) {
        throw new CliError(ErrorCodes.VALIDATION_ERROR, "Missing required option --type.");
      }
      const services = await getServices();
      const input: CreateThoughtInput = {
        type: options.type as ThoughtType,
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
