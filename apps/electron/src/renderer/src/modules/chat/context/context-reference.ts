import type { AgentContextRef } from "@shared/agent";

export type InspectableContextRef = AgentContextRef & {
  type: "understanding" | "context" | "canvas";
};

export type InspectorPanelRef = InspectableContextRef & {
  type: "understanding" | "context";
};

export function contextKey(ref: Pick<AgentContextRef, "type" | "id">) {
  return `${ref.type}:${ref.id}`;
}

/** Understanding / context 走右侧 inspector；canvas 走只读 dialog。 */
export function inspectorPanelRef(ref: InspectableContextRef | null): InspectorPanelRef | null {
  if (!ref || ref.type === "canvas") return null;
  return ref as InspectorPanelRef;
}
