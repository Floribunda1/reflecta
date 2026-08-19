import type { CanvasDocument } from "@reflecta/ui/canvas";
import type { CanvasSearchIndexItem } from "./CanvasSearchOverlay";

export type CanvasRightPanel =
  | { mode: "library" }
  | { mode: "detail"; understandingId: string }
  | null;

export function panelForSelection(
  cellIds: string[],
  document: CanvasDocument,
  current: CanvasRightPanel,
): CanvasRightPanel {
  if (cellIds.length === 1) {
    const id = cellIds[0];
    if (document.edges.some((edge) => edge.id === id))
      return current?.mode === "library" ? current : null;
  }
  return current?.mode === "library" ? current : null;
}

export function buildCanvasSearchIndex(
  document: CanvasDocument,
  understandingRefs: ReadonlyMap<string, { title: string | null; body: string }>,
  referencedCanvases: ReadonlyMap<string, { title: string }>,
): CanvasSearchIndexItem[] {
  const items: CanvasSearchIndexItem[] = document.elements.map((element) => {
    if (element.kind === "text")
      return { id: element.id, kind: element.kind, text: element.props.text };
    if (element.kind === "group")
      return { id: element.id, kind: element.kind, text: element.props.label };
    if (element.kind === "understanding") {
      const ref = element.understandingId
        ? understandingRefs.get(element.understandingId)
        : undefined;
      return {
        id: element.id,
        kind: element.kind,
        text: [ref?.title, ref?.body].filter(Boolean).join("\n"),
      };
    }
    const ref = element.canvasRefId ? referencedCanvases.get(element.canvasRefId) : undefined;
    return { id: element.id, kind: element.kind, text: ref?.title ?? "" };
  });
  for (const edge of document.edges)
    items.push({ id: edge.id, kind: "edge", text: edge.label ?? "" });
  return items.filter((item) => item.text.trim());
}
