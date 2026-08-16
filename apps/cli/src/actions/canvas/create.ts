import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerCreateCanvasAction(cli: Command): void {
  registerActionMeta("canvas", "create", {
    name: "create",
    description: "Create a canvas",
    mutates: true,
    arguments: [{ name: "title", description: "Canvas title", required: true }],
    returns: "CanvasDTO",
  });
  cli
    .command("create <title>")
    .description("Create a canvas")
    .action((title, _options, actionCli) => createCanvasAction(title, actionCli));
}

export async function createCanvasAction(title: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(
    async () => {
      const services = await getServices();
      return services.canvases.createCanvas({ title });
    },
    { ...options, mutates: true },
  );
}
