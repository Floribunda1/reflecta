import { z } from "zod";
import { getServices } from "../services";
import {
  confirmProperty,
  confirmShape,
  createActionHelp,
  mutationResult,
  objectSchema,
  stringProperty,
  type ActionDefinition,
} from "./shared";

const inputSchema = objectSchema(
  { id: stringProperty("Context ID."), confirm: confirmProperty() },
  ["id", "confirm"],
);

export const restoreContextAction = {
  name: "restore_context",
  description: "Mutates Reflecta. Restore a soft-deleted context. Requires confirm: true.",
  mutates: true,
  inputSchema,
  help: createActionHelp({
    name: "restore_context",
    description: "Mutates Reflecta. Restore a soft-deleted context. Requires confirm: true.",
    mutates: true,
    inputSchema,
    inputExample: { id: "context-id", confirm: true },
    outputDescription: "-",
  }),
  schema: z.object({ id: z.string().min(1), ...confirmShape }),
  handler: async ({ id }) => {
    const services = await getServices();
    await services.contexts.restoreContext(id);
    return mutationResult();
  },
} satisfies ActionDefinition<{ id: string; confirm: boolean }>;
