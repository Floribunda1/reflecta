import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

export function registerRestoreContextAction(cli: Command): void {
  cli
    .command("restore <id>")
    .description("Restore a soft-deleted context")
    .action((id, _options, actionCli) => restoreContextAction(id, actionCli));
}

export async function restoreContextAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(
    async () => {
      const services = await getServices();
      await services.contexts.restoreContext(id);
    },
    { ...options, mutates: true },
  );
}
