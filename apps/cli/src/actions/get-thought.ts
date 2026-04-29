import { z } from "zod";
import { getServices } from "../services";
import { createActionHelp, objectSchema, stringProperty, type ActionDefinition } from "./shared";

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
    outputDescription: "ThoughtDTO|null",
  }),
  schema: z.object({ id: z.string().min(1) }),
  handler: async (args) => {
    const services = await getServices();
    return services.thoughts.getThoughtById(args.id);
  },
} satisfies ActionDefinition<{ id: string }>;
