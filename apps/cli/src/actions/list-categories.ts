import { z } from "zod";
import { getServices } from "../services";
import {
  categoryArrayOutputSchema,
  createActionHelp,
  objectSchema,
  type ActionDefinition,
} from "./shared";

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
    outputDescription: "Success returns an array of Category DTO objects in data.",
    outputSchema: categoryArrayOutputSchema,
  }),
  schema: z.object({}).default({}),
  handler: async () => {
    const services = await getServices();
    return services.categories.listCategories();
  },
} satisfies ActionDefinition<Record<string, never>>;
