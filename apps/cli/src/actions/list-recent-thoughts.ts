import { z } from "zod";
import { getServices } from "../services.js";
import {
  MAX_LIMIT,
  createActionHelp,
  numberProperty,
  objectSchema,
  thoughtArrayOutputSchema,
  type ActionDefinition,
} from "./shared.js";

const inputSchema = objectSchema({
  limit: numberProperty("Max results to return. Defaults to 20, maximum 100.", 20),
});

export const listRecentThoughtsAction = {
  name: "list_recent_thoughts",
  description: "List recently updated Reflecta thoughts ordered by updatedAt descending.",
  mutates: false,
  inputSchema,
  help: createActionHelp({
    name: "list_recent_thoughts",
    description: "List recently updated Reflecta thoughts ordered by updatedAt descending.",
    mutates: false,
    inputSchema,
    inputExample: { limit: 20 },
    outputDescription: "Success returns an array of ThoughtSummaryDTO objects in data.",
    outputSchema: thoughtArrayOutputSchema,
  }),
  schema: z.object({ limit: z.number().int().min(1).max(MAX_LIMIT).default(20) }),
  handler: async (args) => {
    const services = await getServices();
    return services.thoughts.listRecentThoughts(args.limit);
  },
} satisfies ActionDefinition<{ limit: number }>;
