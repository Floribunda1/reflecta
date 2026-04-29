import { z } from "zod";
import { getServices } from "../services";
import {
  confirmProperty,
  confirmShape,
  contextOutputSchema,
  createActionHelp,
  enumProperty,
  objectSchema,
  optionalStringProperty,
  sourceTypeSchema,
  stringProperty,
  type ActionDefinition,
} from "./shared";

const inputSchema = objectSchema(
  {
    id: stringProperty("Context ID."),
    sourceType: enumProperty(
      ["experience", "video", "book", "article", "opinion", "ai"],
      "Optional context source type.",
    ),
    sourceName: optionalStringProperty("Optional source name."),
    content: optionalStringProperty("Optional context content."),
    confirm: confirmProperty(),
  },
  ["id", "confirm"],
);

export const updateContextAction = {
  name: "update_context",
  description: "Mutates Reflecta. Update a context. Requires confirm: true.",
  mutates: true,
  inputSchema,
  help: createActionHelp({
    name: "update_context",
    description: "Mutates Reflecta. Update a context. Requires confirm: true.",
    mutates: true,
    inputSchema,
    inputExample: { id: "context-id", content: "Updated context", confirm: true },
    outputDescription: "Success returns the updated ContextDTO in data.",
    outputSchema: contextOutputSchema,
  }),
  schema: z.object({
    id: z.string().min(1),
    sourceType: sourceTypeSchema.optional(),
    sourceName: z.string().optional(),
    content: z.string().optional(),
    ...confirmShape,
  }),
  handler: async ({ id, confirm: _confirm, ...input }) => {
    const services = await getServices();
    return services.contexts.updateContext(id, input);
  },
} satisfies ActionDefinition<{
  id: string;
  sourceType?: "experience" | "video" | "book" | "article" | "opinion" | "ai";
  sourceName?: string;
  content?: string;
  confirm: boolean;
}>;
