import type { CanvasDocument, CanvasSearchIndexItem } from "@reflecta/ui/canvas";

export { panelForSelection, type CanvasRightPanel } from "../session";

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
  return items.flatMap((item) => {
    const text = searchableMarkdownText(item.text);
    return text.trim() ? [{ ...item, text }] : [];
  });
}

/** 去掉 Markdown 反斜杠转义（`\_` → `_` 等），让搜索命中用户所见文本。 */
function searchableMarkdownText(markdown: string): string {
  return markdown.replace(/\\([\\`*_{}[\]()#+\-.!|>~^])/g, "$1");
}
