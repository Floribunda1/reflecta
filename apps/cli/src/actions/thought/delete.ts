import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

export function registerDeleteThoughtAction(cli: Command): void {
  cli
    .command("delete <id>")
    .description("Soft-delete a thought")
    .action((id, _options, actionCli) => deleteThoughtAction(id, actionCli));
}

export async function deleteThoughtAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(
    async () => {
      const services = await getServices();
      await services.thoughts.deleteThought(id);
    },
    { ...options, mutates: true },
  );
}
