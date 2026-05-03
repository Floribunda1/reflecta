import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerUpdateCategoryAction(cli: Command): void {
  registerActionMeta("category", "update", {
    name: "update",
    description: "Update a category",
    mutates: true,
    arguments: [{ name: "id", description: "Category ID", required: true }],
    options: [
      { flags: "--name <name>", description: "Category name", required: false },
      { flags: "--parent-id <id>", description: "Parent category ID", required: false },
    ],
    returns: "CategorySummary — { id, name, parentId }",
  });
  cli
    .command("update <id>")
    .description("Update a category")
    .option("--name <name>", "Category name")
    .option("--parent-id <id>", "Parent category ID")
    .action((id, _options, actionCli) => updateCategoryAction(id, actionCli));
}

export async function updateCategoryAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & { name?: string; parentId?: string };
  await runCommand(
    async () => {
      const services = await getServices();
      return services.categories.updateCategorySummary(id, {
        name: options.name,
        parentId: options.parentId ?? null,
      });
    },
    { ...options, mutates: true },
  );
}
