import { Command, CommanderError } from "commander";
import { ErrorCodes } from "./error";
import { writeError } from "./output";
import { registerCreateCategoryAction } from "./actions/category/create";
import { registerDeleteCategoryAction } from "./actions/category/delete";
import { registerListCategoriesAction } from "./actions/category/list";
import { registerUpdateCategoryAction } from "./actions/category/update";
import { registerCreateContextAction } from "./actions/context/create";
import { registerDeleteContextAction } from "./actions/context/delete";
import { registerListContextsAction } from "./actions/context/list";
import { registerRestoreContextAction } from "./actions/context/restore";
import { registerUpdateContextAction } from "./actions/context/update";
import { registerSearchAllAction } from "./actions/search/all";
import { registerSearchContextsAction } from "./actions/search/contexts";
import { registerSearchThoughtsAction } from "./actions/search/thoughts";
import { registerCreateThoughtAction } from "./actions/thought/create";
import { registerDeleteThoughtAction } from "./actions/thought/delete";
import { registerGetThoughtAction } from "./actions/thought/get";
import { registerListThoughtsAction } from "./actions/thought/list";
import { registerRestoreThoughtAction } from "./actions/thought/restore";
import { registerUpdateThoughtAction } from "./actions/thought/update";
import { registerListTrashedContextsAction } from "./actions/trash/list-contexts";
import { registerListTrashedThoughtsAction } from "./actions/trash/list-thoughts";

const helpData: Record<string, unknown> = {
  "": {
    commands: [
      { name: "thought", description: "Manage thoughts" },
      { name: "context", description: "Manage contexts" },
      { name: "category", description: "Manage categories" },
      { name: "search", description: "Search thoughts and contexts" },
      { name: "trash", description: "View trashed items" },
    ],
  },
  thought: {
    commands: [
      { name: "list", description: "List thoughts", mutates: false },
      { name: "get", description: "Get a thought by ID", mutates: false },
      { name: "create", description: "Create a thought", mutates: true },
      { name: "update", description: "Update a thought", mutates: true },
      { name: "delete", description: "Soft-delete a thought", mutates: true },
      { name: "restore", description: "Restore a soft-deleted thought", mutates: true },
    ],
  },
  context: {
    commands: [
      { name: "list", description: "List contexts for a thought", mutates: false },
      { name: "create", description: "Create a context", mutates: true },
      { name: "update", description: "Update a context", mutates: true },
      { name: "delete", description: "Soft-delete a context", mutates: true },
      { name: "restore", description: "Restore a soft-deleted context", mutates: true },
    ],
  },
  category: {
    commands: [
      { name: "list", description: "List all categories", mutates: false },
      { name: "create", description: "Create a category", mutates: true },
      { name: "update", description: "Update a category", mutates: true },
      { name: "delete", description: "Delete a category", mutates: true },
    ],
  },
  search: {
    commands: [
      { name: "thoughts", description: "Full-text search thoughts", mutates: false },
      { name: "contexts", description: "Full-text search contexts", mutates: false },
      { name: "all", description: "Search both thoughts and contexts", mutates: false },
    ],
  },
  trash: {
    commands: [
      { name: "list-thoughts", description: "List trashed thoughts", mutates: false },
      { name: "list-contexts", description: "List trashed contexts", mutates: false },
    ],
  },
};

function handleHelp(argv: string[]): number {
  const helpIdx = argv.indexOf("--help");
  const hIdx = argv.indexOf("-h");
  const idx = helpIdx !== -1 ? helpIdx : hIdx;
  const path = argv.slice(0, idx).filter((a) => !a.startsWith("-"));
  const key = path.join(".");

  const data = helpData[key];
  if (data) {
    console.log(JSON.stringify(data));
    return 0;
  }

  writeError(ErrorCodes.VALIDATION_ERROR, "Unknown command.");
  return 2;
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    return handleHelp(argv);
  }

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
  registerRestoreThoughtAction(thought);

  const context = cli.command("context").description("Manage contexts");
  registerListContextsAction(context);
  registerCreateContextAction(context);
  registerUpdateContextAction(context);
  registerDeleteContextAction(context);
  registerRestoreContextAction(context);

  const category = cli.command("category").description("Manage categories");
  registerListCategoriesAction(category);
  registerCreateCategoryAction(category);
  registerUpdateCategoryAction(category);
  registerDeleteCategoryAction(category);

  const search = cli.command("search").description("Search thoughts and contexts");
  registerSearchThoughtsAction(search);
  registerSearchContextsAction(search);
  registerSearchAllAction(search);

  const trash = cli.command("trash").description("View trashed items");
  registerListTrashedThoughtsAction(trash);
  registerListTrashedContextsAction(trash);

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
