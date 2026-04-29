import type { Command } from "commander";
import type { SourceType, UpdateContextInput } from "@reflecta/server";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";
import { compactContext } from "../compact";

export function registerUpdateContextAction(cli: Command): void {
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
      return compactContext(await services.contexts.updateContext(id, input));
    },
    { ...options, mutates: true },
  );
}
