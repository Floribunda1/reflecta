import type { Command } from "commander";
import { getServices } from "../services";
import { getCommandOptions, parseIntegerOption, runCommand, type GlobalOptions } from "../runner";
import { registerActionMeta } from "./meta";

export function registerGraphAction(cli: Command): void {
  registerActionMeta(
    "graph",
    "graph",
    {
      name: "graph",
      description: "Get the understanding graph around one Understanding",
      mutates: false,
      arguments: [
        { name: "understandingId", description: "Seed understanding ID", required: true },
      ],
      options: [
        {
          flags: "--include-context",
          description: "Include Contexts for graph nodes",
          required: false,
        },
        {
          flags: "--depth <n>",
          description: "Graph traversal depth",
          required: false,
          defaultValue: 1,
        },
      ],
      returns: "GraphResult — { seed, nodes, edges, contexts? }",
    },
    "Get understanding graph neighborhoods",
  );
  cli
    .command("graph <understanding-id>")
    .description("Get the understanding graph around one Understanding")
    .option("--include-context", "Include Contexts for graph nodes")
    .option("--depth <n>", "Graph traversal depth", parseIntegerOption, 1)
    .action((understandingId, _options, actionCli) => graphAction(understandingId, actionCli));
}

export async function graphAction(understandingId: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    includeContext?: boolean;
    depth?: number;
  };
  await runCommand(async () => {
    const services = await getServices();
    return services.graph.graph(understandingId, {
      includeContext: options.includeContext,
      depth: options.depth ?? 1,
    });
  }, options);
}
