import type { Command } from "commander";
import type { ContextMedium, CreateContextInput } from "@reflecta/server";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerCreateContextAction(cli: Command): void {
  registerActionMeta("context", "create", {
    name: "create",
    description: "Create a context",
    mutates: true,
    options: [
      { flags: "--understanding-id <id>", description: "Understanding ID", required: true },
      {
        flags: "--medium <type>",
        description: "Context medium (experience | video | book | article | opinion | ai | other)",
        required: true,
      },
      { flags: "--title <name>", description: "Context title", required: false },
      { flags: "--content <content>", description: "Content", required: false },
    ],
    returns: "ContextDetail — { id, understandingId, medium, title, content }",
  });
  cli
    .command("create")
    .description("Create a context")
    .option("--understanding-id <id>", "Understanding ID")
    .option(
      "--medium <type>",
      "Context medium (experience | video | book | article | opinion | ai | other)",
    )
    .option("--title <name>", "Context title")
    .option("--content <content>", "Content")
    .action((_options, actionCli) => createContextAction(actionCli));
}

export async function createContextAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    understandingId?: string;
    medium?: string;
    title?: string;
    content?: string;
  };
  await runCommand(
    async () => {
      if (!options.understandingId) {
        throw new CliError(
          ErrorCodes.VALIDATION_ERROR,
          "Missing required option --understanding-id.",
        );
      }
      if (!options.medium) {
        throw new CliError(ErrorCodes.VALIDATION_ERROR, "Missing required option --medium.");
      }
      const services = await getServices();
      const input: CreateContextInput = {
        understandingId: options.understandingId,
        medium: options.medium as ContextMedium,
        title: options.title,
        content: options.content ?? "",
      };
      return services.contexts.createContext(input);
    },
    { ...options, mutates: true },
  );
}
