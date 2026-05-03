import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerGetCategoryAction(cli: Command): void {
  registerActionMeta("category", "get", {
    name: "get",
    description: "Get a category by ID",
    mutates: false,
    arguments: [{ name: "id", description: "Category ID", required: true }],
    returns: "CategorySummary — { id, name, parentId }",
  });
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
