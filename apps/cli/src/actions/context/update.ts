import type { Command } from "commander";
import type { SourceType, UpdateContextInput } from "@reflecta/server";
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
        flags: "--source-type <type>",
        description: "Source type (experience | video | book | article | opinion | ai)",
        required: false,
      },
      { flags: "--source-name <name>", description: "Source name", required: false },
      { flags: "--content <content>", description: "Content", required: false },
    ],
    returns: "ContextDetail — { id, thoughtId, sourceType, sourceName, content }",
  });
  cli
    .command("update <id>")
    .description("Update a context")
    .option(
      "--source-type <type>",
      "Source type (experience | video | book | article | opinion | ai)",
    )
    .option("--source-name <name>", "Source name")
    .option("--content <content>", "Content")
    .action((id, _options, actionCli) => updateContextAction(id, actionCli));
}

export async function updateContextAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    sourceType?: string;
    sourceName?: string;
    content?: string;
  };
  await runCommand(
    async () => {
      const services = await getServices();
      const input: UpdateContextInput = {};
      if (options.sourceType !== undefined) input.sourceType = options.sourceType as SourceType;
      if (options.sourceName !== undefined) input.sourceName = options.sourceName;
      if (options.content !== undefined) input.content = options.content;
      return services.contexts.updateContext(id, input);
    },
    { ...options, mutates: true },
  );
}
