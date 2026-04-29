import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

export function registerConnectThoughtAction(cli: Command): void {
  cli
    .command("connect <source-id> <target-id>")
    .description("Create a directed connection between two thoughts")
    .action((sourceId, targetId, _options, actionCli) =>
      connectThoughtAction(sourceId, targetId, actionCli),
    );
}

export async function connectThoughtAction(
  sourceId: string,
  targetId: string,
  cli: Command,
): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(
    async () => {
      const services = await getServices();
      await services.thoughts.addConnection(sourceId, targetId);
    },
    { ...options, mutates: true },
  );
}
