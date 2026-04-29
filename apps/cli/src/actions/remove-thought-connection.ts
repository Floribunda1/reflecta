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
  {
    sourceId: stringProperty("Source thought ID."),
    targetId: stringProperty("Target thought ID."),
    confirm: confirmProperty(),
  },
  ["sourceId", "targetId", "confirm"],
);

export const removeThoughtConnectionAction = {
  name: "remove_thought_connection",
  description: "Mutates Reflecta. Remove a directed thought connection. Requires confirm: true.",
  mutates: true,
  inputSchema,
  help: createActionHelp({
    name: "remove_thought_connection",
    description: "Mutates Reflecta. Remove a directed thought connection. Requires confirm: true.",
    mutates: true,
    inputSchema,
    inputExample: { sourceId: "source-thought-id", targetId: "target-thought-id", confirm: true },
    outputDescription: "-",
  }),
  schema: z.object({
    sourceId: z.string().min(1),
    targetId: z.string().min(1),
    ...confirmShape,
  }),
  handler: async ({ sourceId, targetId }) => {
    const services = await getServices();
    await services.thoughts.removeConnection(sourceId, targetId);
    return mutationResult();
  },
} satisfies ActionDefinition<{ sourceId: string; targetId: string; confirm: boolean }>;
