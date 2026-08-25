import type { ChatEntityReference, MarkdownRenderer } from "../chat/entity";
import type { CanvasDocument, CanvasElementDTO } from "@reflecta/shared";

/**
 * 节点展示数据与编辑回写通道。
 *
 * React Flow 自定义节点渲染在当前 React 树内，context 直接穿透——卡片所需的派生
 * 展示数据（理解卡全文、引用标题、删除占位）和内容编辑回写都走这里，无需引擎级 hack。
 */

export type CanvasUnderstandingRefView = {
  id: string;
  title: string | null;
  body: string;
  deleted: boolean;
  /** 拖入新理解但正文尚未随 detail 拉回时，卡片正文区显示骨架占位 */
  loading?: boolean;
};

export type CanvasReferencedCanvasView = {
  id: string;
  title: string;
  deleted: boolean;
  /** 目标画布文档：引用卡内嵌实时小型预览用 */
  document?: CanvasDocument;
  /** 目标画布的展示数据：预览内嵌理解卡 / 嵌套引用卡渲染用 */
  shapeData?: CanvasShapeData;
};

export type CanvasShapeData = {
  /** 只读画布禁用节点自身的编辑与操作菜单 */
  readonly?: boolean;
  /** 多选状态：≥2 个元素被选中 → 用选区工具栏（group/delete），隐藏各节点的独立操作工具栏 */
  multiSelected?: boolean;
  /** 当前被选中的元素 id 集合（X6 Selection 不改 cell 的 selected 属性，需经 context 驱动卡片重渲） */
  selectedIds?: ReadonlySet<string>;
  /** 引用理解（画布上理解卡展示全文） */
  understandingRefs: ReadonlyMap<string, CanvasUnderstandingRefView>;
  /** 引用画布（画布引用卡展示目标标题；目标被删 → 占位） */
  referencedCanvases: ReadonlyMap<string, CanvasReferencedCanvasView>;
  /** 画布引用卡点击跳转（由 workspace 注入 navigateToCanvas） */
  onCanvasRefClick?: (canvasId: string) => void;
  onCellAction?: (action: CanvasCellAction) => void;
  onElementEdit?: (element: CanvasElementDTO) => void;
  /** 双击连线发起的标签编辑：React Flow onEdgeDoubleClick 落到对应边，开启内联编辑 */
  editingEdgeId?: string | null;
  /** 理解卡正文里的 [[u:id]] 双链：由调用方传入解析版 Markdown 组件（renderer 提供带请求逻辑的 wrapper） */
  renderMarkdown?: MarkdownRenderer;
  /** 点击理解卡正文里的 wiki link：跳到对应理解详情 */
  onWikiLinkOpen?: (reference: ChatEntityReference) => void;
  /** 标签编辑结束（提交 / 取消）时清空，保证同一连线可再次双击进入 */
  onEdgeEditEnd?: () => void;
};

export type CanvasCellAction =
  | { type: "delete-element"; nodeId: string }
  | { type: "delete-group"; nodeId: string }
  | { type: "ungroup"; nodeId: string }
  | { type: "delete-edge"; edgeId: string };

export const EMPTY_CANVAS_SHAPE_DATA: CanvasShapeData = {
  understandingRefs: new Map(),
  referencedCanvases: new Map(),
};
