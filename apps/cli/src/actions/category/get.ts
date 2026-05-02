import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

export function registerGetCategoryAction(cli: Command): void {
  cli
    .command("get <id>")
    .description("Get a category by ID")
    .action((id, _options, actionCli) => getCategoryAction(id, actionCli));
}

export async function getCategoryAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(async () => {
    const services = await getServices();
    return services.categories.getCategory(id);
  }, options);
}
