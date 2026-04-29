import { z } from "zod";
import { getServices } from "../services";
import {
  confirmProperty,
  confirmShape,
  createActionHelp,
  enumProperty,
  nullableStringProperty,
  objectSchema,
  optionalStringProperty,
  stringArrayProperty,
  stringProperty,
  thoughtTypeSchema,
  type ActionDefinition,
} from "./shared";

const inputSchema = objectSchema(
  {
    id: stringProperty("Thought ID."),
    type: enumProperty(["idea", "insight"], "Optional thought type."),
    title: nullableStringProperty("Optional thought title, or null to clear."),
    body: optionalStringProperty("Optional thought body."),
    categoryIds: stringArrayProperty("Optional replacement category IDs."),
    confirm: confirmProperty(),
  },
  ["id", "confirm"],
);

export const updateThoughtAction = {
  name: "update_thought",
  description: "Mutates Reflecta. Update a thought. Requires confirm: true.",
  mutates: true,
  inputSchema,
  help: createActionHelp({
    name: "update_thought",
    description: "Mutates Reflecta. Update a thought. Requires confirm: true.",
    mutates: true,
    inputSchema,
    inputExample: { id: "thought-id", title: "Updated title", confirm: true },
    outputDescription: "ThoughtDTO",
  }),
  schema: z.object({
    id: z.string().min(1),
    type: thoughtTypeSchema.optional(),
    title: z.string().nullable().optional(),
    body: z.string().optional(),
    categoryIds: z.array(z.string()).optional(),
    ...confirmShape,
  }),
  handler: async ({ id, confirm: _confirm, ...input }) => {
    const services = await getServices();
    return services.thoughts.updateThought(id, input);
  },
} satisfies ActionDefinition<{
  id: string;
  type?: "idea" | "insight";
  title?: string | null;
  body?: string;
  categoryIds?: string[];
  confirm: boolean;
}>;
