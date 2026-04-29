import { z } from "zod";
import { getServices } from "../services.js";
import {
  contextSearchOutputSchema,
  createActionHelp,
  numberProperty,
  objectSchema,
  paginationShape,
  stringProperty,
  type ActionDefinition,
} from "./shared.js";

const inputSchema = objectSchema(
  {
    query: stringProperty("Full-text search query."),
    limit: numberProperty("Max results to return. Defaults to 20, maximum 100.", 20),
    offset: numberProperty("Result offset for pagination. Defaults to 0.", 0),
  },
  ["query"],
);

export const searchContextsAction = {
  name: "search_contexts",
  description:
    "Full-text search Reflecta context source names and content. Returns matching contexts with snippets.",
  mutates: false,
  inputSchema,
  help: createActionHelp({
    name: "search_contexts",
    description:
      "Full-text search Reflecta context source names and content. Returns matching contexts with snippets.",
    mutates: false,
    inputSchema,
    inputExample: { query: "book", limit: 20, offset: 0 },
    outputDescription: "Success returns an array of FtsContextResult objects in data.",
    outputSchema: contextSearchOutputSchema,
  }),
  schema: z.object({ query: z.string().min(1), ...paginationShape }),
  handler: async (args) => {
    const services = await getServices();
    return services.search.searchContexts(args.query, { limit: args.limit, offset: args.offset });
  },
} satisfies ActionDefinition<{
  query: string;
  limit: number;
  offset: number;
}>;
