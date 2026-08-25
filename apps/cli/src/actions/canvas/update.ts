import type { Command } from "commander";
import { Effect } from "effect";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";
import type { CanvasDocument } from "@reflecta/shared";

import { registerActionMeta } from "../meta";

export function registerUpdateCanvasAction(cli: Command): void {
  registerActionMeta("canvas", "update", {
    name: "update",
    description:
      "Update a canvas: rename via --title, or write the whole document via --document (JSON CanvasDocument, reconciled by id)",
    mutates: true,
    arguments: [{ name: "canvasId", description: "Canvas ID", required: true }],
    options: [
      { flags: "--title <title>", description: "New title (metadata only)", required: false },
      {
        flags: "--document <json>",
        description: "Whole target document JSON: { elements: [...], edges: [...] }",
        required: false,
      },
    ],
    returns: "CanvasDTO",
  });
  cli
    .command("update <canvas-id>")
    .description("Rename a canvas or write its whole document")
    .option("--title <title>", "New title")
    .option("--document <json>", "Whole target document JSON: { elements: [...], edges: [...] }")
    .action((canvasId, _options, actionCli) => updateCanvasAction(canvasId, actionCli));
}

export async function updateCanvasAction(canvasId: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & { title?: string; document?: string };
  await runCommand(
    async () => {
      const services = await getServices();

      if (options.document !== undefined) {
        let document: CanvasDocument;
        try {
          document = JSON.parse(options.document) as CanvasDocument;
        } catch {
          throw new CliError(ErrorCodes.VALIDATION_ERROR, "--document must be valid JSON.");
        }
        await Effect.runPromise(services.canvases.saveCanvas(canvasId, document));
      }

      if (options.title !== undefined) {
        const updated = await Effect.runPromise(
          services.canvases.updateCanvas(canvasId, { title: options.title }),
        );
        if (!updated) {
          throw new CliError(ErrorCodes.NOT_FOUND, `Canvas "${canvasId}" not found.`);
        }
        return updated;
      }

      const current = await Effect.runPromise(services.canvases.getCanvas(canvasId));
      if (!current) {
        throw new CliError(ErrorCodes.NOT_FOUND, `Canvas "${canvasId}" not found.`);
      }
      return current;
    },
    { ...options, mutates: true },
  );
}
