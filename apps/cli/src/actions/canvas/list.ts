import type { Command } from "commander";
import { getServices } from "../../services";
import {
  getCommandOptions,
  parseIntegerOption,
  runCommand,
  type GlobalOptions,
} from "../../runner";

import { registerActionMeta } from "../meta";

export function registerListCanvasesAction(cli: Command): void {
  registerActionMeta("canvas", "list", {
    name: "list",
    description: "List canvases",
    mutates: false,
    options: [
      {
        flags: "--title-keyword <kw>",
        description: "Filter by title keyword (case-insensitive)",
        required: false,
      },
      { flags: "--limit <n>", description: "Limit results", required: false, defaultValue: 20 },
    ],
    returns: "CanvasDTO[] — { id, title, description, viewport, createdAt, updatedAt }",
  });
  cli
    .command("list")
    .description("List canvases")
    .option("--title-keyword <kw>", "Filter by title keyword (case-insensitive)")
    .option("--limit <n>", "Limit results", parseIntegerOption, 20)
    .action((_options, actionCli) => listCanvasesAction(actionCli));
}

export async function listCanvasesAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    titleKeyword?: string;
    limit?: number;
  };
  await runCommand(async () => {
    const services = await getServices();
    return services.canvases.listCanvases({
      titleSearchKeyword: options.titleKeyword,
      limit: options.limit ?? 20,
    });
  }, options);
}
