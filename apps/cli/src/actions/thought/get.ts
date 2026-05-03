import type { Command } from "commander";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerGetThoughtAction(cli: Command): void {
  registerActionMeta("thought", "get", {
    name: "get",
    description: "Get a thought by ID",
    mutates: false,
    arguments: [{ name: "id", description: "Thought ID", required: true }],
    options: [
      { flags: "--include-contexts", description: "Include full context objects", required: false },
      {
        flags: "--include-references",
        description: "Include referenced thoughts",
        required: false,
      },
      {
        flags: "--include-referenced-bys",
        description: "Include thoughts that reference this one",
        required: false,
      },
    ],
    returns:
      "ThoughtDetail — ThoughtSummary + contextCount, referenceCount, referencedByCount, contexts?, references?, referencedBys?",
  });
  cli
    .command("get <id>")
    .description("Get a thought by ID")
    .option("--include-contexts", "Include full context objects")
    .option("--include-references", "Include referenced thoughts")
    .option("--include-referenced-bys", "Include thoughts that reference this one")
    .action((id, _options, actionCli) => getThoughtAction(id, actionCli));
}

export async function getThoughtAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as {
    format: "json" | "jsonl";
    yes: boolean;
    quiet: boolean;
    verbose: boolean;
    includeContexts?: boolean;
    includeReferences?: boolean;
    includeReferencedBys?: boolean;
  };
  await runCommand(async () => {
    const services = await getServices();
    const thought = await services.thoughts.getThought(id, {
      includeContexts: options.includeContexts,
      includeReferences: options.includeReferences,
      includeReferencedBys: options.includeReferencedBys,
    });
    if (!thought) {
      throw new CliError(ErrorCodes.NOT_FOUND, `Thought "${id}" not found.`);
    }
    return thought;
  }, options);
}
