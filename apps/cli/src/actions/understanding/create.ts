import type { Command } from "commander";
import type { CreateUnderstandingInput } from "@reflecta/server";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerCreateUnderstandingAction(cli: Command): void {
  registerActionMeta("understanding", "create", {
    name: "create",
    description: "Create a understanding",
    mutates: true,
    options: [
      { flags: "--title <title>", description: "Understanding title", required: false },
      {
        flags: "--body <body>",
        description: "Understanding body. Use [[u:understanding-id]] to create links",
        required: false,
      },
      {
        flags: "--domain-id <ids>",
        description: "Domain IDs, comma-separated",
        required: false,
      },
    ],
    returns:
      "UnderstandingDetail — UnderstandingSummary + contextCount, referenceCount, referencedByCount",
  });
  cli
    .command("create")
    .description("Create a understanding")
    .option("--title <title>", "Understanding title")
    .option("--body <body>", "Understanding body. Use [[u:understanding-id]] to create links")
    .option("--domain-id <ids>", "Domain IDs, comma-separated")
    .action((_options, actionCli) => createUnderstandingAction(actionCli));
}

export async function createUnderstandingAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    title?: string;
    body?: string;
    domainId?: string;
  };
  await runCommand(
    async () => {
      const services = await getServices();
      const input: CreateUnderstandingInput = {
        title: options.title,
        body: options.body,
        domainIds: options.domainId
          ? options.domainId
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      };
      return services.understandings.createUnderstanding(input);
    },
    { ...options, mutates: true },
  );
}
