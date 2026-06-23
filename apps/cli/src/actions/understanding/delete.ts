import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerDeleteUnderstandingAction(cli: Command): void {
  registerActionMeta("understanding", "delete", {
    name: "delete",
    description: "Soft-delete a understanding",
    mutates: true,
    arguments: [{ name: "id", description: "Understanding ID", required: true }],
    returns: "void",
  });
  cli
    .command("delete <id>")
    .description("Soft-delete a understanding")
    .action((id, _options, actionCli) => deleteUnderstandingAction(id, actionCli));
}

export async function deleteUnderstandingAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(
    async () => {
      const services = await getServices();
      await services.understandings.deleteUnderstanding(id);
    },
    { ...options, mutates: true },
  );
}
