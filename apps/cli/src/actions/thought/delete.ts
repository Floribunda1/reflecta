import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerDeleteThoughtAction(cli: Command): void {
  registerActionMeta("thought", "delete", {
    name: "delete",
    description: "Soft-delete a thought",
    mutates: true,
    arguments: [{ name: "id", description: "Thought ID", required: true }],
    returns: "void",
  });
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
