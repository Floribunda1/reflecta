import {
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Connection,
  type Node,
  type NodeChange,
} from "@xyflow/react";

export function reduceCanvasNodeChanges(
  nodes: Node[],
  changes: NodeChange[],
): { nodes: Node[]; documentChanged: boolean } {
  return {
    nodes: applyNodeChanges(changes, nodes),
    documentChanged: changes.some((change) => change.type !== "select"),
  };
}

export function reduceCanvasEdgeChanges(
  edges: Edge[],
  changes: EdgeChange[],
): { edges: Edge[]; documentChanged: boolean } {
  return {
    edges: applyEdgeChanges(changes, edges),
    documentChanged: changes.some((change) => change.type !== "select"),
  };
}

export function appendCanvasConnection(
  edges: Edge[],
  connection: Connection,
  createEdge: (connection: Connection) => Edge,
): Edge[] {
  if (!connection.source || !connection.target) return edges;
  return [...edges, createEdge(connection)];
}
