import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";
import { compactTrashedContext } from "../compact";

export function registerListTrashedContextsAction(cli: Command): void {
  cli
    .command("list-contexts")
    .description("List trashed contexts")
    .action((_options, actionCli) => listTrashedContextsAction(actionCli));
}

export async function listTrashedContextsAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(async () => {
    const services = await getServices();
    return (await services.contexts.listTrashedContexts()).map(compactTrashedContext);
  }, options);
}
