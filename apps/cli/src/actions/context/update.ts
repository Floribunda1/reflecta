import type { Command } from "commander";
import type { ContextMedium, UpdateContextInput } from "@reflecta/server";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerUpdateContextAction(cli: Command): void {
  registerActionMeta("context", "update", {
    name: "update",
    description: "Update a context",
    mutates: true,
    arguments: [{ name: "id", description: "Context ID", required: true }],
    options: [
      {
        flags: "--medium <type>",
        description: "Context medium (experience | video | book | article | opinion | ai | other)",
        required: false,
      },
      { flags: "--title <name>", description: "Context title", required: false },
      { flags: "--content <content>", description: "Content", required: false },
    ],
    returns: "ContextDetail — { id, understandingId, medium, title, content }",
  });
  cli
    .command("update <id>")
    .description("Update a context")
    .option(
      "--medium <type>",
      "Context medium (experience | video | book | article | opinion | ai | other)",
    )
    .option("--title <name>", "Context title")
    .option("--content <content>", "Content")
    .action((id, _options, actionCli) => updateContextAction(id, actionCli));
}

export async function updateContextAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    medium?: string;
    title?: string;
    content?: string;
  };
  await runCommand(
    async () => {
      const services = await getServices();
      const input: UpdateContextInput = {};
      if (options.medium !== undefined) input.medium = options.medium as ContextMedium;
      if (options.title !== undefined) input.title = options.title;
      if (options.content !== undefined) input.content = options.content;
      return services.contexts.updateContext(id, input);
    },
    { ...options, mutates: true },
  );
}
