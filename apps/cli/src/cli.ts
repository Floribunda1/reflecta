import { Command, CommanderError } from "commander";
import { ErrorCodes } from "./error";
import { writeError } from "./output";
import type { GlobalOptions } from "./runner";
import {
  getActionMeta,
  getResourceDescriptions,
  getActionsByResource,
  getGroupedActions,
} from "./actions/meta";
import { registerCreateCategoryAction } from "./actions/category/create";
import { registerDeleteCategoryAction } from "./actions/category/delete";
import { registerGetCategoryAction } from "./actions/category/get";
import { registerInspectCategoryAction } from "./actions/category/inspect";
import { registerListCategoriesAction } from "./actions/category/list";
import { registerUpdateCategoryAction } from "./actions/category/update";
import { registerCreateContextAction } from "./actions/context/create";
import { registerDeleteContextAction } from "./actions/context/delete";
import { registerGetContextAction } from "./actions/context/get";
import { registerListContextsAction } from "./actions/context/list";
import { registerUpdateContextAction } from "./actions/context/update";
import { registerGraphNeighborhoodAction } from "./actions/graph/neighborhood";
import { registerGraphPathAction } from "./actions/graph/path";
import { registerSearchAllAction } from "./actions/search/all";
import { registerSearchContextsAction } from "./actions/search/contexts";
import { registerSearchThoughtsAction } from "./actions/search/thoughts";
import { registerProjectSnapshotAction } from "./actions/snapshot/project";
import { registerCreateThoughtAction } from "./actions/thought/create";
import { registerDeleteThoughtAction } from "./actions/thought/delete";
import { registerGetThoughtAction } from "./actions/thought/get";
import { registerListThoughtsAction } from "./actions/thought/list";
import { registerUpdateThoughtAction } from "./actions/thought/update";

function formatRows(rows: Array<{ key: string; desc: string }>, indent = 2, width = 22): string[] {
  const pad = " ".repeat(indent);
  return rows.map(({ key, desc }) => {
    if (key.length > width) {
      return `${pad}${key}\n${pad}${" ".repeat(width + 1)}${desc}`;
    }
    return `${pad}${key.padEnd(width)} ${desc}`;
  });
}

function printGlobalOptions(): void {
  console.log("Global Options:");
  formatRows([
    { key: "--format <fmt>", desc: "Output format: json | jsonl (default: jsonl)" },
    { key: "--yes", desc: "Auto-confirm mutating actions" },
    { key: "--quiet", desc: "Suppress non-error stdout" },
    { key: "--verbose", desc: "Debug logs to stderr" },
  ]).forEach((line) => console.log(line));
}

function handleHelp(argv: string[]): number {
  const helpIdx = argv.indexOf("--help");
  const hIdx = argv.indexOf("-h");
  const idx = helpIdx !== -1 ? helpIdx : hIdx;
  const path = argv.slice(0, idx).filter((a) => !a.startsWith("-"));

  if (path.length === 0) {
    const resources = [];
    for (const [name, description] of getResourceDescriptions()) {
      resources.push({ key: name, desc: description });
    }
    console.log("Usage: reflecta <resource> <action> [args] [options]");
    console.log("");
    console.log("Resources:");
    formatRows(resources).forEach((line) => console.log(line));
    console.log("");
    console.log("Commands:");
    formatRows([{ key: "list-actions", desc: "List all available actions" }]).forEach((line) =>
      console.log(line),
    );
    console.log("");
    printGlobalOptions();
    return 0;
  }

  if (path[0] === "list-actions") {
    console.log("Usage: reflecta list-actions [options]");
    console.log("");
    console.log("Description: List all available actions");
    console.log("");
    printGlobalOptions();
    return 0;
  }

  if (path.length === 1) {
    const resource = path[0];
    const actions = getActionsByResource(resource);
    if (actions.size === 0) {
      writeError(ErrorCodes.VALIDATION_ERROR, "Unknown command.");
      return 2;
    }
    console.log(`Usage: reflecta ${resource} <action> [args] [options]`);
    console.log("");
    console.log("Actions:");
    const rows: Array<{ key: string; desc: string }> = [];
    for (const [name, meta] of actions) {
      const mutatesTag = meta.mutates ? "  [mutates]" : "";
      rows.push({ key: name, desc: meta.description + mutatesTag });
    }
    formatRows(rows).forEach((line) => console.log(line));
    console.log("");
    printGlobalOptions();
    return 0;
  }

  const meta = getActionMeta(path[0], path[1]);
  if (meta) {
    const resource = path[0];
    const action = path[1];
    const argsStr =
      meta.arguments?.map((a) => (a.required ? `<${a.name}>` : `[<${a.name}>]`)).join(" ") ?? "";
    const usageArgs = argsStr ? ` ${argsStr}` : "";
    console.log(`Usage: reflecta ${resource} ${action}${usageArgs} [options]`);
    console.log("");
    console.log(`Description: ${meta.description}`);
    if (meta.mutates) {
      console.log("Mutates: yes (use --yes to confirm)");
    }
    if (meta.returns) {
      console.log(`Returns: ${meta.returns}`);
    }
    console.log("");

    if (meta.arguments && meta.arguments.length > 0) {
      console.log("Arguments:");
      formatRows(
        meta.arguments.map((a) => ({
          key: a.name,
          desc: `${a.description}${a.required ? " (required)" : ""}`,
        })),
      ).forEach((line) => console.log(line));
      console.log("");
    }

    if (meta.options && meta.options.length > 0) {
      console.log("Options:");
      formatRows(
        meta.options.map((o) => ({
          key: o.flags,
          desc: `${o.description}${o.required ? " (required)" : o.defaultValue !== undefined ? ` (default: ${JSON.stringify(o.defaultValue)})` : ""}`,
        })),
      ).forEach((line) => console.log(line));
      console.log("");
    }

    printGlobalOptions();
    return 0;
  }

  writeError(ErrorCodes.VALIDATION_ERROR, "Unknown command.");
  return 2;
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  if (argv.length === 0) {
    writeError(ErrorCodes.VALIDATION_ERROR, "No command provided. Pass --help for usage.");
    return 2;
  }

  const cli = new Command("reflecta");

  cli.exitOverride();
  cli.configureOutput({
    writeErr: () => {},
    writeOut: () => {},
  });

  cli.option("--format <fmt>", "Output format: json | jsonl", "jsonl");
  cli.option("--yes", "Auto-confirm mutating actions");
  cli.option("--quiet", "Suppress non-error stdout");
  cli.option("--verbose", "Debug logs to stderr");

  const thought = cli.command("thought").description("Manage thoughts");
  registerListThoughtsAction(thought);
  registerGetThoughtAction(thought);
  registerCreateThoughtAction(thought);
  registerUpdateThoughtAction(thought);
  registerDeleteThoughtAction(thought);

  const context = cli.command("context").description("Manage contexts");
  registerListContextsAction(context);
  registerGetContextAction(context);
  registerCreateContextAction(context);
  registerUpdateContextAction(context);
  registerDeleteContextAction(context);

  const category = cli.command("category").description("Manage categories");
  registerListCategoriesAction(category);
  registerGetCategoryAction(category);
  registerInspectCategoryAction(category);
  registerCreateCategoryAction(category);
  registerUpdateCategoryAction(category);
  registerDeleteCategoryAction(category);

  const search = cli.command("search").description("Search thoughts and contexts");
  registerSearchThoughtsAction(search);
  registerSearchContextsAction(search);
  registerSearchAllAction(search);

  const graph = cli.command("graph").description("Explore thought graph");
  registerGraphNeighborhoodAction(graph);
  registerGraphPathAction(graph);

  const snapshot = cli.command("snapshot").description("Project snapshots");
  registerProjectSnapshotAction(snapshot);

  cli
    .command("list-actions")
    .description("List all available actions")
    .action((_options, actionCli: Command) => {
      const opts = actionCli.optsWithGlobals<GlobalOptions>();
      if (opts.quiet) return;
      const grouped = getGroupedActions();
      console.log("Actions:");
      for (const g of grouped) {
        console.log("");
        console.log(`${g.group} — ${g.description}`);
        for (const a of g.actions) {
          const mutatesTag = a.mutates ? "  [mutates]" : "";
          const shortName = a.name.replace(`${g.group} `, "");
          formatRows([{ key: shortName, desc: a.description + mutatesTag }], 2).forEach((line) =>
            console.log(line),
          );
        }
      }
    });

  if (argv.includes("--help") || argv.includes("-h")) {
    return handleHelp(argv);
  }

  try {
    await cli.parseAsync(argv, { from: "user" });
    return Number(process.exitCode ?? 0);
  } catch (err) {
    if (err instanceof CommanderError) {
      writeError(ErrorCodes.VALIDATION_ERROR, err.message);
      return 2;
    }
    const message = err instanceof Error ? err.message : String(err);
    writeError(ErrorCodes.VALIDATION_ERROR, message);
    return 2;
  }
}
