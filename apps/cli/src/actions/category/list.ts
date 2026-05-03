import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerListCategoriesAction(cli: Command): void {
  registerActionMeta(
    "category",
    "list",
    {
      name: "list",
      description: "List all categories",
      mutates: false,
      returns: "CategorySummary[] — { id, name, parentId }[]",
    },
    "Manage categories",
  );
  cli
    .command("list")
    .description("List all categories")
    .action((_options, actionCli) => listCategoriesAction(actionCli));
}

export async function listCategoriesAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(async () => {
    const services = await getServices();
    return services.categories.listCategories();
  }, options);
}
