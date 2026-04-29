import { z } from "zod";
import { getServices } from "../services.js";
import {
  categoryOutputSchema,
  confirmProperty,
  confirmShape,
  createActionHelp,
  nullableStringProperty,
  objectSchema,
  stringProperty,
  type ActionDefinition,
} from "./shared.js";

const inputSchema = objectSchema(
  {
    name: stringProperty("Category name."),
    parentId: nullableStringProperty("Optional parent category ID."),
    confirm: confirmProperty(),
  },
  ["name", "confirm"],
);

export const createCategoryAction = {
  name: "create_category",
  description: "Mutates Reflecta. Create a category. Requires confirm: true.",
  mutates: true,
  inputSchema,
  help: createActionHelp({
    name: "create_category",
    description: "Mutates Reflecta. Create a category. Requires confirm: true.",
    mutates: true,
    inputSchema,
    inputExample: { name: "Reading", parentId: null, confirm: true },
    outputDescription: "Success returns the created Category DTO in data.",
    outputSchema: categoryOutputSchema,
  }),
  schema: z.object({
    name: z.string().min(1),
    parentId: z.string().nullable().optional(),
    ...confirmShape,
  }),
  handler: async ({ confirm: _confirm, ...input }) => {
    const services = await getServices();
    return services.categories.createCategory(input);
  },
} satisfies ActionDefinition<{ name: string; parentId?: string | null; confirm: boolean }>;
