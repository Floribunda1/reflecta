import { addThoughtConnectionAction } from "./actions/add-thought-connection.js";
import { createCategoryAction } from "./actions/create-category.js";
import { createContextAction } from "./actions/create-context.js";
import { createThoughtAction } from "./actions/create-thought.js";
import { deleteCategoryAction } from "./actions/delete-category.js";
import { deleteContextAction } from "./actions/delete-context.js";
import { deleteThoughtAction } from "./actions/delete-thought.js";
import { getThoughtAction } from "./actions/get-thought.js";
import { listCategoriesAction } from "./actions/list-categories.js";
import { listRecentThoughtsAction } from "./actions/list-recent-thoughts.js";
import { removeThoughtConnectionAction } from "./actions/remove-thought-connection.js";
import { reorderCategoriesAction } from "./actions/reorder-categories.js";
import { restoreContextAction } from "./actions/restore-context.js";
import { restoreThoughtAction } from "./actions/restore-thought.js";
import { searchContextsAction } from "./actions/search-contexts.js";
import { searchThoughtsAction } from "./actions/search-thoughts.js";
import { updateCategoryAction } from "./actions/update-category.js";
import { updateContextAction } from "./actions/update-context.js";
import { updateThoughtAction } from "./actions/update-thought.js";
import {
  failure,
  success,
  type ActionDefinition,
  type ActionHelp,
  type CliAction,
  type CliResult,
} from "./actions/shared.js";

const actions: Array<ActionDefinition<any>> = [
  searchThoughtsAction,
  getThoughtAction,
  listRecentThoughtsAction,
  listCategoriesAction,
  searchContextsAction,
  createThoughtAction,
  updateThoughtAction,
  deleteThoughtAction,
  restoreThoughtAction,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  createContextAction,
  updateContextAction,
  deleteContextAction,
  restoreContextAction,
  addThoughtConnectionAction,
  removeThoughtConnectionAction,
];

export type { CliAction, CliFailure, CliResult, CliSuccess } from "./actions/shared.js";
export { failure } from "./actions/shared.js";

export function listActions(): CliAction[] {
  return actions.map(({ name, description, mutates }) => ({ name, description, mutates }));
}

export function getActionHelp(name: string): ActionHelp | undefined {
  return actions.find((item) => item.name === name)?.help;
}

export async function callAction(name: string, args: unknown): Promise<CliResult> {
  const action = actions.find((item) => item.name === name);
  if (!action) {
    return failure("UNKNOWN_ACTION", `Unknown action: ${name}`);
  }

  const parsed = action.schema.safeParse(args ?? {});
  if (!parsed.success) {
    return failure("INVALID_ARGUMENTS", "Action arguments are invalid.", parsed.error.flatten());
  }

  if (action.mutates && (parsed.data as { confirm?: boolean }).confirm !== true) {
    return failure(
      "CONFIRMATION_REQUIRED",
      "This action mutates the Reflecta knowledge base. Pass confirm: true or --confirm to execute.",
    );
  }

  try {
    return success(await action.handler(parsed.data));
  } catch (err) {
    return failure("ACTION_EXECUTION_FAILED", err instanceof Error ? err.message : String(err));
  }
}
