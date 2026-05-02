import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

export function registerGetContextAction(cli: Command): void {
  cli
    .command("get <id>")
    .description("Get a context by ID")
    .action((id, _options, actionCli) => getContextAction(id, actionCli));
}

export async function getContextAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(async () => {
    const services = await getServices();
    return services.contexts.getContext(id);
  }, options);
}
