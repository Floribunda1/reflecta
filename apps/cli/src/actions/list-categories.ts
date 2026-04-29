import { z } from "zod";
import { getServices } from "../services";
import { createActionHelp, objectSchema, type ActionDefinition } from "./shared";

const inputSchema = objectSchema({});

export const listCategoriesAction = {
  name: "list_categories",
  description: "List all Reflecta categories.",
  mutates: false,
  inputSchema,
  help: createActionHelp({
    name: "list_categories",
    description: "List all Reflecta categories.",
    mutates: false,
    inputSchema,
    inputExample: {},
    outputDescription: "CategoryDTO[]",
  }),
  schema: z.object({}).default({}),
  handler: async () => {
    const services = await getServices();
    return services.categories.listCategories();
  },
} satisfies ActionDefinition<Record<string, never>>;
