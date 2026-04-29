import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

export function registerRestoreThoughtAction(cli: Command): void {
  cli
    .command("restore <id>")
    .description("Restore a soft-deleted thought")
    .action((id, _options, actionCli) => restoreThoughtAction(id, actionCli));
}

export async function restoreThoughtAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(
    async () => {
      const services = await getServices();
      await services.thoughts.restoreThought(id);
    },
    { ...options, mutates: true },
  );
}
