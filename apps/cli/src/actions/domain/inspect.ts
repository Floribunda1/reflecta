import type { Command } from "commander";
import { getServices } from "../../services";
import {
  getCommandOptions,
  parseIntegerOption,
  runCommand,
  type GlobalOptions,
} from "../../runner";

import { registerActionMeta } from "../meta";

export function registerInspectDomainAction(cli: Command): void {
  registerActionMeta("domain", "inspect", {
    name: "inspect",
    description: "Inspect a domain and its understandings",
    mutates: false,
    arguments: [{ name: "id", description: "Domain ID", required: true }],
    options: [
      {
        flags: "--include-contexts",
        description: "Include full context objects for understandings",
        required: false,
      },
      {
        flags: "--include-relations",
        description: "Include relations between understandings",
        required: false,
      },
      { flags: "--limit <n>", description: "Limit results", required: false, defaultValue: 200 },
      { flags: "--offset <n>", description: "Result offset", required: false, defaultValue: 0 },
    ],
    returns: "DomainInspectResult — { domain, domains, understandings, contexts?, edges?, page }",
  });
  cli
    .command("inspect <id>")
    .description("Inspect a domain and its understandings")
    .option("--include-contexts", "Include full context objects for understandings")
    .option("--include-relations", "Include relations between understandings")
    .option("--limit <n>", "Limit results", parseIntegerOption, 200)
    .option("--offset <n>", "Result offset", parseIntegerOption, 0)
    .action((id, _options, actionCli) => inspectDomainAction(id, actionCli));
}

export async function inspectDomainAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & {
    includeContexts?: boolean;
    includeRelations?: boolean;
    limit?: number;
    offset?: number;
  };
  await runCommand(async () => {
    const services = await getServices();
    return services.domains.inspectDomain(id, {
      includeContexts: options.includeContexts,
      includeEdges: options.includeRelations,
      limit: options.limit,
      offset: options.offset,
    });
  }, options);
}
