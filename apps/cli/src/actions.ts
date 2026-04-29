import { addThoughtConnectionAction } from "./actions/add-thought-connection";
import { createCategoryAction } from "./actions/create-category";
import { createContextAction } from "./actions/create-context";
import { createThoughtAction } from "./actions/create-thought";
import { deleteCategoryAction } from "./actions/delete-category";
import { deleteContextAction } from "./actions/delete-context";
import { deleteThoughtAction } from "./actions/delete-thought";
import { getThoughtAction } from "./actions/get-thought";
import { listCategoriesAction } from "./actions/list-categories";
import { listRecentThoughtsAction } from "./actions/list-recent-thoughts";
import { removeThoughtConnectionAction } from "./actions/remove-thought-connection";
import { reorderCategoriesAction } from "./actions/reorder-categories";
import { restoreContextAction } from "./actions/restore-context";
import { restoreThoughtAction } from "./actions/restore-thought";
import { searchContextsAction } from "./actions/search-contexts";
import { searchThoughtsAction } from "./actions/search-thoughts";
import { updateCategoryAction } from "./actions/update-category";
import { updateContextAction } from "./actions/update-context";
import { updateThoughtAction } from "./actions/update-thought";
import {
  failure,
  success,
  type ActionDefinition,
  type ActionHelp,
  type CliAction,
  type CliResult,
} from "./actions/shared";

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

export type { CliAction, CliFailure, CliResult, CliSuccess } from "./actions/shared";
export { failure } from "./actions/shared";

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
