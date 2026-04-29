import type { Command } from "commander";
import type { SourceType, CreateContextInput } from "@reflecta/server";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";
import { compactContext } from "../compact";

export function registerCreateContextAction(cli: Command): void {
  cli
    .command("create")
    .description("Create a context")
    .option("--thought-id <id>", "Thought ID")
    .option(
      "--source-type <type>",
      "Source type (experience | video | book | article | opinion | ai)",
    )
    .option("--source-name <name>", "Source name")
    .option("--content <content>", "Content")
    .action((_options, actionCli) => createContextAction(actionCli));
}

export async function createContextAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    thoughtId?: string;
    sourceType?: string;
    sourceName?: string;
    content?: string;
  };
  await runCommand(
    async () => {
      if (!options.thoughtId) {
        throw new CliError(ErrorCodes.VALIDATION_ERROR, "Missing required option --thought-id.");
      }
      if (!options.sourceType) {
        throw new CliError(ErrorCodes.VALIDATION_ERROR, "Missing required option --source-type.");
      }
      const services = await getServices();
      const input: CreateContextInput = {
        thoughtId: options.thoughtId,
        sourceType: options.sourceType as SourceType,
        sourceName: options.sourceName,
        content: options.content ?? "",
      };
      return compactContext(await services.contexts.createContext(input));
    },
    { ...options, mutates: true },
  );
}
