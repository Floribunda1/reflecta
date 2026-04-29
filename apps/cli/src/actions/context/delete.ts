import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

export function registerDeleteContextAction(cli: Command): void {
  cli
    .command("delete <id>")
    .description("Soft-delete a context")
    .action((id, _options, actionCli) => deleteContextAction(id, actionCli));
}

export async function deleteContextAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(
    async () => {
      const services = await getServices();
      await services.contexts.deleteContext(id);
    },
    { ...options, mutates: true },
  );
}
