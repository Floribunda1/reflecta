import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerDeleteContextAction(cli: Command): void {
  registerActionMeta("context", "delete", {
    name: "delete",
    description: "Soft-delete a context",
    mutates: true,
    arguments: [{ name: "id", description: "Context ID", required: true }],
    returns: "void",
  });
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
