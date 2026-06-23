import type { Command } from "commander";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerCreateDomainAction(cli: Command): void {
  registerActionMeta("domain", "create", {
    name: "create",
    description: "Create a domain",
    mutates: true,
    options: [
      { flags: "--name <name>", description: "Domain name", required: true },
      { flags: "--parent-id <id>", description: "Parent domain ID", required: false },
    ],
    returns: "DomainSummary — { id, name, parentId }",
  });
  cli
    .command("create")
    .description("Create a domain")
    .option("--name <name>", "Domain name")
    .option("--parent-id <id>", "Parent domain ID")
    .action((_options, actionCli) => createDomainAction(actionCli));
}

export async function createDomainAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & { name?: string; parentId?: string };
  await runCommand(
    async () => {
      if (!options.name) {
        throw new CliError(ErrorCodes.VALIDATION_ERROR, "Missing required option --name.");
      }
      const services = await getServices();
      return services.domains.createDomainSummary({
        name: options.name,
        parentId: options.parentId ?? null,
      });
    },
    { ...options, mutates: true },
  );
}
