import { z } from "zod";
import { getServices } from "../services";
import {
  confirmProperty,
  confirmShape,
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
    thoughtId: stringProperty("Thought ID."),
    sourceType: enumProperty(
      ["experience", "video", "book", "article", "opinion", "ai"],
      "Context source type.",
    ),
    sourceName: optionalStringProperty("Optional source name."),
    content: stringProperty("Context content."),
    confirm: confirmProperty(),
  },
  ["thoughtId", "sourceType", "content", "confirm"],
);

export const createContextAction = {
  name: "create_context",
  description: "Mutates Reflecta. Create a context for a thought. Requires confirm: true.",
  mutates: true,
  inputSchema,
  help: createActionHelp({
    name: "create_context",
    description: "Mutates Reflecta. Create a context for a thought. Requires confirm: true.",
    mutates: true,
    inputSchema,
    inputExample: {
      thoughtId: "thought-id",
      sourceType: "book",
      sourceName: "Example book",
      content: "Relevant context",
      confirm: true,
    },
    outputDescription: "ContextDTO",
  }),
  schema: z.object({
    thoughtId: z.string().min(1),
    sourceType: sourceTypeSchema,
    sourceName: z.string().optional(),
    content: z.string(),
    ...confirmShape,
  }),
  handler: async ({ confirm: _confirm, ...input }) => {
    const services = await getServices();
    return services.contexts.createContext(input);
  },
} satisfies ActionDefinition<{
  thoughtId: string;
  sourceType: "experience" | "video" | "book" | "article" | "opinion" | "ai";
  sourceName?: string;
  content: string;
  confirm: boolean;
}>;
