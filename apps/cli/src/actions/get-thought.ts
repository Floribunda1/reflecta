import { z } from "zod";
import { getServices } from "../services.js";
import {
  createActionHelp,
  objectSchema,
  stringProperty,
  thoughtOutputSchema,
  type ActionDefinition,
} from "./shared.js";

const inputSchema = objectSchema({ id: stringProperty("Thought ID.") }, ["id"]);

export const getThoughtAction = {
  name: "get_thought",
  description:
    "Get a single Reflecta thought by ID, including categories, contexts, connections, and referenced-by thoughts.",
  mutates: false,
  inputSchema,
  help: createActionHelp({
    name: "get_thought",
    description:
      "Get a single Reflecta thought by ID, including categories, contexts, connections, and referenced-by thoughts.",
    mutates: false,
    inputSchema,
    inputExample: { id: "thought-id" },
    outputDescription:
      "Success returns a ThoughtDTO in data, or null when the thought is not found.",
    outputSchema: thoughtOutputSchema,
  }),
  schema: z.object({ id: z.string().min(1) }),
  handler: async (args) => {
    const services = await getServices();
    return services.thoughts.getThoughtById(args.id);
  },
} satisfies ActionDefinition<{ id: string }>;
