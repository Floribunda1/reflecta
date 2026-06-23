import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerListDomainsAction(cli: Command): void {
  registerActionMeta(
    "domain",
    "list",
    {
      name: "list",
      description: "List all domains",
      mutates: false,
      returns: "DomainSummary[] — { id, name, parentId }[]",
    },
    "Manage domains",
  );
  cli
    .command("list")
    .description("List all domains")
    .action((_options, actionCli) => listDomainsAction(actionCli));
}

export async function listDomainsAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(async () => {
    const services = await getServices();
    return services.domains.listDomains();
  }, options);
}
