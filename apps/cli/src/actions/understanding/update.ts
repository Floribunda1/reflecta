import type { Command } from "commander";
import type { UpdateUnderstandingInput } from "@reflecta/server";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerUpdateUnderstandingAction(cli: Command): void {
  registerActionMeta("understanding", "update", {
    name: "update",
    description: "Update a understanding",
    mutates: true,
    arguments: [{ name: "id", description: "Understanding ID", required: true }],
    options: [
      { flags: "--title <title>", description: "Understanding title", required: false },
      {
        flags: "--body <body>",
        description: "Understanding body. Use [[title#understanding-id]] to create links",
        required: false,
      },
      {
        flags: "--domain-id <ids>",
        description: "Replace domain IDs, comma-separated",
        required: false,
      },
    ],
    returns:
      "UnderstandingDetail — UnderstandingSummary + contextCount, referenceCount, referencedByCount",
  });
  cli
    .command("update <id>")
    .description("Update a understanding")
    .option("--title <title>", "Understanding title")
    .option("--body <body>", "Understanding body. Use [[title#understanding-id]] to create links")
    .option("--domain-id <ids>", "Replace domain IDs, comma-separated")
    .action((id, _options, actionCli) => updateUnderstandingAction(id, actionCli));
}

export async function updateUnderstandingAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    title?: string;
    body?: string;
    domainId?: string;
  };
  await runCommand(
    async () => {
      const services = await getServices();
      const input: UpdateUnderstandingInput = {};
      if (options.title !== undefined) input.title = options.title;
      if (options.body !== undefined) input.body = options.body;
      if (options.domainId !== undefined) {
        input.domainIds = options.domainId
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return services.understandings.updateUnderstanding(id, input);
    },
    { ...options, mutates: true },
  );
}
