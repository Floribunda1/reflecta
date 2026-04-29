import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

export function registerDisconnectThoughtAction(cli: Command): void {
  cli
    .command("disconnect <source-id> <target-id>")
    .description("Remove a directed connection between two thoughts")
    .action((sourceId, targetId, _options, actionCli) =>
      disconnectThoughtAction(sourceId, targetId, actionCli),
    );
}

export async function disconnectThoughtAction(
  sourceId: string,
  targetId: string,
  cli: Command,
): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(
    async () => {
      const services = await getServices();
      await services.thoughts.removeConnection(sourceId, targetId);
    },
    { ...options, mutates: true },
  );
}
