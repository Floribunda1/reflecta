import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerUpdateDomainAction(cli: Command): void {
  registerActionMeta("domain", "update", {
    name: "update",
    description: "Update a domain",
    mutates: true,
    arguments: [{ name: "id", description: "Domain ID", required: true }],
    options: [
      { flags: "--name <name>", description: "Domain name", required: false },
      { flags: "--parent-id <id>", description: "Parent domain ID", required: false },
    ],
    returns: "DomainSummary — { id, name, parentId }",
  });
  cli
    .command("update <id>")
    .description("Update a domain")
    .option("--name <name>", "Domain name")
    .option("--parent-id <id>", "Parent domain ID")
    .action((id, _options, actionCli) => updateDomainAction(id, actionCli));
}

export async function updateDomainAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & { name?: string; parentId?: string };
  await runCommand(
    async () => {
      const services = await getServices();
      return services.domains.updateDomainSummary(id, {
        name: options.name,
        parentId: options.parentId ?? null,
      });
    },
    { ...options, mutates: true },
  );
}
