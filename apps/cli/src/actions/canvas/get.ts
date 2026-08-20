import type { Command } from "commander";
import { Effect } from "effect";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerGetCanvasAction(cli: Command): void {
  registerActionMeta("canvas", "get", {
    name: "get",
    description: "Get canvas detail (structure skeleton by default; bodies opt-in)",
    mutates: false,
    arguments: [{ name: "canvasId", description: "Canvas ID", required: true }],
    options: [
      {
        flags: "--with-bodies",
        description: "Include referenced Understanding bodies (default: titles only)",
        required: false,
      },
    ],
    returns: "CanvasDetailDTO — canvas + elements + edges + understandingRefs + referencedCanvases",
  });
  cli
    .command("get <canvas-id>")
    .description("Get canvas detail (structure skeleton by default; bodies opt-in)")
    .option("--with-bodies", "Include referenced Understanding bodies")
    .action((canvasId, _options, actionCli) => getCanvasAction(canvasId, actionCli));
}

export async function getCanvasAction(canvasId: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & { withBodies?: boolean };
  await runCommand(async () => {
    const services = await getServices();
    const detail = await Effect.runPromise(
      services.canvases.getCanvasDetail(canvasId, {
        includeBodies: Boolean(options.withBodies),
      }),
    );
    if (!detail) {
      throw new CliError(ErrorCodes.NOT_FOUND, `Canvas "${canvasId}" not found.`);
    }
    return detail;
  }, options);
}
