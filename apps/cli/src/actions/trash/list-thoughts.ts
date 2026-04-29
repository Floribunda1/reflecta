import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";
import { compactTrashedThought } from "../compact";

export function registerListTrashedThoughtsAction(cli: Command): void {
  cli
    .command("list-thoughts")
    .description("List trashed thoughts")
    .action((_options, actionCli) => listTrashedThoughtsAction(actionCli));
}

export async function listTrashedThoughtsAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(async () => {
    const services = await getServices();
    return (await services.trash.listTrashedThoughts()).map(compactTrashedThought);
  }, options);
}
