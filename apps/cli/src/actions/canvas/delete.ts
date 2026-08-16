import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerDeleteCanvasAction(cli: Command): void {
  registerActionMeta("canvas", "delete", {
    name: "delete",
    description: "Hard-delete a canvas (cascades elements and edges)",
    mutates: true,
    arguments: [{ name: "canvasId", description: "Canvas ID", required: true }],
    returns: "void",
  });
  cli
    .command("delete <canvas-id>")
    .description("Hard-delete a canvas (cascades elements and edges)")
    .action((canvasId, _options, actionCli) => deleteCanvasAction(canvasId, actionCli));
}

export async function deleteCanvasAction(canvasId: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(
    async () => {
      const services = await getServices();
      await services.canvases.deleteCanvas(canvasId);
    },
    { ...options, mutates: true },
  );
}
