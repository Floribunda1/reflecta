import { inArray } from "drizzle-orm";
import { understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { CanvasDocument, CanvasElementDTO, CanvasElementKind } from "./types";

/**
 * 文档级写路径下的机械校验（§2.4）：
 * 服务端只做结构性 / 引用完整性校验，不做手势语义校验——级联删组、解组、多选删等
 * 联动由前端文档模型保证（目标文档即结果态），服务端按目标文档对账。
 */

export class CanvasValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasValidationError";
  }
}

export function assertValidDocument(document: CanvasDocument): void {
  const { elements, edges } = document;

  const elementIds = new Set<string>();
  for (const element of elements) {
    if (elementIds.has(element.id)) {
      throw new CanvasValidationError(`Duplicate element id in document: ${element.id}`);
    }
    elementIds.add(element.id);
    assertValidElement(element);
  }

  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) {
      throw new CanvasValidationError(`Duplicate edge id in document: ${edge.id}`);
    }
    edgeIds.add(edge.id);

    if (edge.sourceElementId === edge.targetElementId) {
      throw new CanvasValidationError(
        `Edge ${edge.id} is a self-loop (source === target): ${edge.sourceElementId}`,
      );
    }
    if (!elementIds.has(edge.sourceElementId)) {
      throw new CanvasValidationError(
        `Edge ${edge.id} source element not in document: ${edge.sourceElementId}`,
      );
    }
    if (!elementIds.has(edge.targetElementId)) {
      throw new CanvasValidationError(
        `Edge ${edge.id} target element not in document: ${edge.targetElementId}`,
      );
    }
    assertValidEdgeStyle(edge.style);
  }

  // 入组防环：父必须是 group、同一文档、不能是自己或自己的后代
  for (const element of elements) {
    if (element.parentId === null) continue;
    if (!elementIds.has(element.parentId)) {
      throw new CanvasValidationError(
        `Element ${element.id} parent not in document: ${element.parentId}`,
      );
    }
    const parent = elements.find((candidate) => candidate.id === element.parentId)!;
    if (parent.kind !== "group") {
      throw new CanvasValidationError(
        `Element ${element.id} parent is not a group: ${element.parentId}`,
      );
    }
    if (element.id === element.parentId) {
      throw new CanvasValidationError(`Element ${element.id} cannot be its own parent`);
    }
    if (isDescendant(elements, element.parentId, element.id)) {
      throw new CanvasValidationError(
        `Element ${element.id} parent cycle detected via ${element.parentId}`,
      );
    }
  }
}

function isDescendant(elements: CanvasElementDTO[], nodeId: string, targetId: string): boolean {
  // 从 nodeId 沿 parent 链向上走，若遇到 targetId 则有环
  const byId = new Map(elements.map((element) => [element.id, element]));
  let current = byId.get(nodeId);
  const visited = new Set<string>();
  while (current && current.parentId !== null) {
    if (visited.has(current.id)) return true;
    visited.add(current.id);
    if (current.parentId === targetId) return true;
    current = byId.get(current.parentId);
  }
  return false;
}

export function assertValidElement(element: CanvasElementDTO): void {
  switch (element.kind) {
    case "understanding":
      if (!element.understandingId) {
        throw new CanvasValidationError(
          `Understanding element ${element.id} must have understandingId`,
        );
      }
      break;
    case "text":
      if (typeof element.props.text !== "string") {
        throw new CanvasValidationError(`Text element ${element.id} must have props.text`);
      }
      break;
    case "shape":
      if (element.props.shapeType !== "rect" && element.props.shapeType !== "circle") {
        throw new CanvasValidationError(
          `Shape element ${element.id} must have props.shapeType "rect" | "circle"`,
        );
      }
      break;
    case "group":
      if (typeof element.props.label !== "string") {
        throw new CanvasValidationError(`Group element ${element.id} must have props.label`);
      }
      break;
    case "canvas_ref":
      if (!element.canvasRefId) {
        throw new CanvasValidationError(`Canvas ref element ${element.id} must have canvasRefId`);
      }
      break;
  }
}

const EDGE_STYLE_ENUMS = {
  routing: ["straight", "curve", "orthogonal"],
  lineStyle: ["solid", "dashed", "dotted"],
  width: ["thin", "medium", "thick"],
  arrowhead: ["arrow", "block", "none"],
} as const;

export function assertValidEdgeStyle(style: unknown): void {
  if (style === null || style === undefined) return;
  if (typeof style !== "object" || Array.isArray(style)) {
    throw new CanvasValidationError("Edge style must be an object");
  }
  for (const [key, allowed] of Object.entries(EDGE_STYLE_ENUMS)) {
    const value = (style as Record<string, unknown>)[key];
    if (value !== undefined && !(allowed as readonly string[]).includes(value as string)) {
      throw new CanvasValidationError(`Edge style ${key} invalid: ${String(value)}`);
    }
  }
}

/**
 * 校验引用理解存在（允许引用软删理解——占位语义由前端呈现）。
 * 返回文档中引用的 understanding ids（去重），供调用方决定是否取 refs。
 */
export async function assertUnderstandingRefsExist(
  db: ReflectaDb,
  understandingIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(understandingIds)];
  if (uniqueIds.length === 0) return;
  const rows = await db
    .select({ id: understandings.id })
    .from(understandings)
    .where(inArray(understandings.id, uniqueIds));
  const found = new Set(rows.map((row) => row.id));
  const missing = uniqueIds.find((id) => !found.has(id));
  if (missing !== undefined) {
    throw new CanvasValidationError(`Understanding not found: ${missing}`);
  }
}

export function canvasElementKindOf(element: CanvasElementDTO): CanvasElementKind {
  return element.kind;
}
