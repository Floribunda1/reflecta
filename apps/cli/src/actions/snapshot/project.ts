import type { Command } from "commander";
import { getServices } from "../../services";
import { getCommandOptions, runCommand } from "../../runner";

import { registerActionMeta } from "../meta";

export function registerProjectSnapshotAction(cli: Command): void {
  registerActionMeta(
    "snapshot",
    "project",
    {
      name: "project",
      description: "Get a snapshot of the project",
      mutates: false,
      returns:
        "ProjectSnapshotResult — { categories, recentThoughts, stats: { totalThoughts, totalContexts, totalCategories, totalReferences } }",
    },
    "Project snapshots",
  );
  cli
    .command("project")
    .description("Get a snapshot of the project")
    .action((_options, actionCli) => projectSnapshotAction(actionCli));
}

export async function projectSnapshotAction(cli: Command): Promise<void> {
  const options = getCommandOptions(cli);
  await runCommand(async () => {
    const services = await getServices();
    return services.snapshot.projectSnapshot();
  }, options);
}
