import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerGetDomainAction(cli: Command): void {
  registerActionMeta("domain", "get", {
    name: "get",
    description: "Get a domain by ID",
    mutates: false,
    hidden: true,
    arguments: [{ name: "id", description: "Domain ID", required: true }],
    returns: "DomainSummary — { id, name, parentId }",
  });
  cli
    .command("get <id>")
    .description("Get a domain by ID")
    .action((id, _options, actionCli) => getDomainAction(id, actionCli));
}

export async function getDomainAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(async () => {
    const services = await getServices();
    return services.domains.getDomain(id);
  }, options);
}
