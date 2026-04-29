import { z } from "zod";
import { getServices } from "../services.js";
import {
  confirmProperty,
  confirmShape,
  createActionHelp,
  enumProperty,
  objectSchema,
  optionalStringProperty,
  stringArrayProperty,
  thoughtOutputSchema,
  thoughtTypeSchema,
  type ActionDefinition,
} from "./shared.js";

const inputSchema = objectSchema(
  {
    type: enumProperty(["idea", "insight"], "Thought type."),
    title: optionalStringProperty("Optional thought title."),
    body: optionalStringProperty("Optional thought body."),
    categoryIds: stringArrayProperty("Optional category IDs."),
    confirm: confirmProperty(),
  },
  ["type", "confirm"],
);

export const createThoughtAction = {
  name: "create_thought",
  description: "Mutates Reflecta. Create a thought. Requires confirm: true.",
  mutates: true,
  inputSchema,
  help: createActionHelp({
    name: "create_thought",
    description: "Mutates Reflecta. Create a thought. Requires confirm: true.",
    mutates: true,
    inputSchema,
    inputExample: { type: "idea", title: "Inbox", body: "Capture this", confirm: true },
    outputDescription: "Success returns the created ThoughtDTO in data.",
    outputSchema: thoughtOutputSchema,
  }),
  schema: z.object({
    type: thoughtTypeSchema,
    title: z.string().optional(),
    body: z.string().optional(),
    categoryIds: z.array(z.string()).optional(),
    ...confirmShape,
  }),
  handler: async ({ confirm: _confirm, ...input }) => {
    const services = await getServices();
    return services.thoughts.createThought(input);
  },
} satisfies ActionDefinition<{
  type: "idea" | "insight";
  title?: string;
  body?: string;
  categoryIds?: string[];
  confirm: boolean;
}>;
