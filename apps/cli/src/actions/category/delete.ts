import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand, type GlobalOptions } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerDeleteCategoryAction(cli: Command): void {
  registerActionMeta("category", "delete", {
    name: "delete",
    description: "Delete a category",
    mutates: true,
    arguments: [{ name: "id", description: "Category ID", required: true }],
    options: [
      {
        flags: "--cascade",
        description: "Also permanently delete associated thoughts",
        required: false,
      },
    ],
    returns: "void",
  });
  cli
    .command("delete <id>")
    .description("Delete a category")
    .option("--cascade", "Also permanently delete associated thoughts")
    .action((id, _options, actionCli) => deleteCategoryAction(id, actionCli));
}

export async function deleteCategoryAction(id: string, cli: Command): Promise<void> {
  const options = getCommandOptions(cli) as GlobalOptions & { cascade?: boolean };
  await runCommand(
    async () => {
      const services = await getServices();
      await services.categories.deleteCategory(id, options.cascade ?? false);
    },
    { ...options, mutates: true },
  );
}
