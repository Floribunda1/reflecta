import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerDeleteDomainAction(cli: Command): void {
  registerActionMeta("domain", "delete", {
    name: "delete",
    description: "Delete a domain",
    mutates: true,
    arguments: [{ name: "id", description: "Domain ID", required: true }],
    options: [
      {
        flags: "--cascade",
        description: "Also permanently delete associated understandings",
        required: false,
      },
    ],
    returns: "void",
  });
  cli
    .command("delete <id>")
    .description("Delete a domain")
    .option("--cascade", "Also permanently delete associated understandings")
    .action((id, _options, actionCli) => deleteDomainAction(id, actionCli));
}

export async function deleteDomainAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & { cascade?: boolean };
  await runCommand(
    async () => {
      const services = await getServices();
      await services.domains.deleteDomain(id, options.cascade ?? false);
    },
    { ...options, mutates: true },
  );
}
