import type { AgentContextRef } from "@shared/agent";

export type InspectableContextRef = AgentContextRef & {
  type: "understanding" | "context";
};

export function contextKey(ref: Pick<AgentContextRef, "type" | "id">) {
  return `${ref.type}:${ref.id}`;
}
