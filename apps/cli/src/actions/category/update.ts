import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

export function registerUpdateCategoryAction(cli: Command): void {
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
