import { z } from "zod";
import { getServices } from "../services";
import {
  confirmProperty,
  confirmShape,
  createActionHelp,
  mutationResult,
  mutationOutputSchema,
  objectSchema,
  stringProperty,
  type ActionDefinition,
} from "./shared";

const inputSchema = objectSchema(
  { id: stringProperty("Context ID."), confirm: confirmProperty() },
  ["id", "confirm"],
);

export const deleteContextAction = {
  name: "delete_context",
  description: "Mutates Reflecta. Soft-delete a context. Requires confirm: true.",
  mutates: true,
  inputSchema,
  help: createActionHelp({
    name: "delete_context",
    description: "Mutates Reflecta. Soft-delete a context. Requires confirm: true.",
    mutates: true,
    inputSchema,
    inputExample: { id: "context-id", confirm: true },
    outputDescription: "Success returns a mutation acknowledgement in data.",
    outputSchema: mutationOutputSchema,
  }),
  schema: z.object({ id: z.string().min(1), ...confirmShape }),
  handler: async ({ id }) => {
    const services = await getServices();
    await services.contexts.deleteContext(id);
    return mutationResult();
  },
} satisfies ActionDefinition<{ id: string; confirm: boolean }>;
