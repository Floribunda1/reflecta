import { z } from "zod";
import { getServices } from "../services.js";
import {
  categoryOutputSchema,
  confirmProperty,
  confirmShape,
  createActionHelp,
  nullableStringProperty,
  objectSchema,
  optionalStringProperty,
  stringProperty,
  type ActionDefinition,
} from "./shared.js";

const inputSchema = objectSchema(
  {
    id: stringProperty("Category ID."),
    name: optionalStringProperty("Optional category name."),
    parentId: nullableStringProperty("Optional parent category ID, or null for root."),
    confirm: confirmProperty(),
  },
  ["id", "confirm"],
);

export const updateCategoryAction = {
  name: "update_category",
  description: "Mutates Reflecta. Update a category. Requires confirm: true.",
  mutates: true,
  inputSchema,
  help: createActionHelp({
    name: "update_category",
    description: "Mutates Reflecta. Update a category. Requires confirm: true.",
    mutates: true,
    inputSchema,
    inputExample: { id: "category-id", name: "Updated category", confirm: true },
    outputDescription: "Success returns the updated Category DTO in data.",
    outputSchema: categoryOutputSchema,
  }),
  schema: z.object({
    id: z.string().min(1),
    name: z.string().min(1).optional(),
    parentId: z.string().nullable().optional(),
    ...confirmShape,
  }),
  handler: async ({ id, confirm: _confirm, ...input }) => {
    const services = await getServices();
    return services.categories.updateCategory(id, input);
  },
} satisfies ActionDefinition<{
  id: string;
  name?: string;
  parentId?: string | null;
  confirm: boolean;
}>;
