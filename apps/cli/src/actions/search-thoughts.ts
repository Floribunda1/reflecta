import { z } from "zod";
import { getServices } from "../services";
import {
  createActionHelp,
  numberProperty,
  objectSchema,
  paginationShape,
  stringProperty,
  type ActionDefinition,
} from "./shared";

const inputSchema = objectSchema(
  {
    query: stringProperty("Full-text search query."),
    limit: numberProperty("Max results to return. Defaults to 20, maximum 100.", 20),
    offset: numberProperty("Result offset for pagination. Defaults to 0.", 0),
  },
  ["query"],
);

export const searchThoughtsAction = {
  name: "search_thoughts",
  description:
    "Full-text search Reflecta thoughts. Returns matching thoughts with categories, contexts, and connections.",
  mutates: false,
  inputSchema,
  help: createActionHelp({
    name: "search_thoughts",
    description:
      "Full-text search Reflecta thoughts. Returns matching thoughts with categories, contexts, and connections.",
    mutates: false,
    inputSchema,
    inputExample: { query: "design", limit: 20, offset: 0 },
    outputDescription: "ThoughtSummaryDTO[]",
  }),
  schema: z.object({ query: z.string().min(1), ...paginationShape }),
  handler: async (args) => {
    const services = await getServices();
    return services.search.searchThoughts(args.query, { limit: args.limit, offset: args.offset });
  },
} satisfies ActionDefinition<{
  query: string;
  limit: number;
  offset: number;
}>;
