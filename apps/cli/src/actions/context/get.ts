import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerGetContextAction(cli: Command): void {
  registerActionMeta("context", "get", {
    name: "get",
    description: "Get a context by ID",
    mutates: false,
    arguments: [{ name: "id", description: "Context ID", required: true }],
    returns: "ContextDetail — { id, understandingId, medium, title, content }",
  });
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
