import { expect, test } from "vitest";
import { agentCanvasDocument } from "./canvas-story-fixtures";
import { toX6Cells } from "./graph-document";

test("converts an agent-created document into positioned X6 cells", () => {
  const cells = toX6Cells(agentCanvasDocument);
  const grouped = cells.find((cell) => cell.id === "agent-risk");
  const edges = cells.filter((cell) => cell.shape === "edge");

  expect(cells).toHaveLength(
    agentCanvasDocument.elements.length + agentCanvasDocument.edges.length,
  );
  expect(grouped).toMatchObject({ parent: "agent-options", x: 384, y: 104 });
  expect(edges).toHaveLength(agentCanvasDocument.edges.length);
  expect(edges[0]).toMatchObject({
    source: { cell: "agent-question", port: "right" },
    target: { cell: "agent-risk", port: "left" },
  });
});
