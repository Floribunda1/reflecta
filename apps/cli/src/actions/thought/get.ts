import type { Command } from "commander";
import { CliError, ErrorCodes } from "../../error";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";
import { compactThought } from "../compact";

export function registerGetThoughtAction(cli: Command): void {
  cli
    .command("get <id>")
    .description("Get a thought by ID")
    .action((id, _options, actionCli) => getThoughtAction(id, actionCli));
}

export async function getThoughtAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(async () => {
    const services = await getServices();
    const thought = await services.thoughts.getThoughtById(id);
    if (!thought) {
      throw new CliError(ErrorCodes.NOT_FOUND, `Thought "${id}" not found.`);
    }
    return compactThought(thought);
  }, options);
}
