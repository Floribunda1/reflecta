import { Option, type Command } from "commander";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerGetUnderstandingAction(cli: Command): void {
  registerActionMeta("understanding", "get", {
    name: "get",
    description: "Get a understanding by ID",
    mutates: false,
    arguments: [{ name: "id", description: "Understanding ID", required: true }],
    options: [
      { flags: "--include-contexts", description: "Include full context objects", required: false },
      {
        flags: "--include-relations",
        description: "Include wiki-link relations",
        required: false,
      },
    ],
    returns:
      "UnderstandingDetail — UnderstandingSummary + contextCount, referenceCount, referencedByCount, contexts?, relations?",
  });
  cli
    .command("get <id>")
    .description("Get a understanding by ID")
    .option("--include-contexts", "Include full context objects")
    .option("--include-relations", "Include wiki-link relations")
    .addOption(new Option("--include-references", "Include referenced understandings").hideHelp())
    .addOption(
      new Option(
        "--include-referenced-bys",
        "Include understandings that reference this one",
      ).hideHelp(),
    )
    .action((id, _options, actionCli) => getUnderstandingAction(id, actionCli));
}

export async function getUnderstandingAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as {
    format: "json" | "jsonl";
    yes: boolean;
    quiet: boolean;
    verbose: boolean;
    includeContexts?: boolean;
    includeRelations?: boolean;
    includeReferences?: boolean;
    includeReferencedBys?: boolean;
  };
  await runCommand(async () => {
    const services = await getServices();
    const understanding = await services.understandings.getUnderstanding(id, {
      includeContexts: options.includeContexts,
      includeRelations: options.includeRelations,
      includeReferences: options.includeReferences,
      includeReferencedBys: options.includeReferencedBys,
    });
    if (!understanding) {
      throw new CliError(ErrorCodes.NOT_FOUND, `Understanding "${id}" not found.`);
    }
    return understanding;
  }, options);
}
