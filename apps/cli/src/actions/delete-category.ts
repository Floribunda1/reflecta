import { z } from "zod";
import { getServices } from "../services";
import {
  confirmProperty,
  confirmShape,
  createActionHelp,
  mutationResult,
  objectSchema,
  stringProperty,
  type ActionDefinition,
} from "./shared";

const inputSchema = objectSchema(
  { id: stringProperty("Category ID."), confirm: confirmProperty() },
  ["id", "confirm"],
);

export const deleteCategoryAction = {
  name: "delete_category",
  description:
    "Mutates Reflecta. Delete a category without deleting associated thoughts. Requires confirm: true.",
  mutates: true,
  inputSchema,
  help: createActionHelp({
    name: "delete_category",
    description:
      "Mutates Reflecta. Delete a category without deleting associated thoughts. Requires confirm: true.",
    mutates: true,
    inputSchema,
    inputExample: { id: "category-id", confirm: true },
    outputDescription: "-",
  }),
  schema: z.object({ id: z.string().min(1), ...confirmShape }),
  handler: async ({ id }) => {
    const services = await getServices();
    await services.categories.deleteCategory(id, false);
    return mutationResult();
  },
} satisfies ActionDefinition<{ id: string; confirm: boolean }>;
