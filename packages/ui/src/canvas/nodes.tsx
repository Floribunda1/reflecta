import { useSyncExternalStore, type ReactNode } from "react";
import { Selection, type Graph, type Node as X6Node } from "@antv/x6";
import { register } from "@antv/x6-react-shape";
import { FileText, LayoutGrid, Type, type LucideIcon } from "lucide-react";
import {
  CanvasGroupCard,
  CanvasRefCard,
  CanvasTextCard,
  CanvasUnderstandingCard,
} from "./canvas-cards";
import type { CanvasElementDTO, CanvasElementKind } from "@reflecta/shared";
import { useCanvasElementUpdate, useCanvasShapeData } from "./shape-context";

/**
 * X6 react-shape 卡片组件。
 *
 * 经 `register({ shape, component })` 注册；component 收到 `{ node, graph }`（react-shape
 * 注入）。卡片渲染在 portal provider 内，React context（shapeData / 回写通道）直接穿透。
 * Handle（磁吸点）由节点 metadata 的 `CANVAS_PORTS` 提供；resize 由 `Transform` 插件接管。
 *
 * 视觉由 `canvas-cards` 的 presentational 组件承担；这里只做 X6 node → props 的适配。
 */

type CardProps = { node: X6Node; graph?: Graph };
type RegisterArgs = CardProps;

function subscribeSelection(graph: Graph | undefined, onChange: () => void): () => void {
  if (!graph) return () => {};
  const selection = graph.getPlugin<Selection>("selection");
  if (!selection) return () => {};
  const handler = () => onChange();
  selection.on("selection:changed", handler);
  return () => selection.off("selection:changed", handler);
}

/** 选中态订阅 X6 Selection。react-shape Wrap 是 PureComponent，context 更新不会穿透。 */
function useCard(
  node: X6Node,
  graph: Graph | undefined,
): {
  element: CanvasElementDTO;
  selected: boolean;
  update: (element: CanvasElementDTO) => void;
} {
  const selected = useSyncExternalStore(
    (onChange) => subscribeSelection(graph, onChange),
    () => graph?.getPlugin<Selection>("selection")?.isSelected(node) ?? false,
  );
  const update = useCanvasElementUpdate();
  const element = (node.getData() as { element?: CanvasElementDTO } | null | undefined)?.element;
  return { element: element ?? ({} as CanvasElementDTO), selected, update };
}

function UnderstandingShape({ node, graph }: CardProps) {
  const { element, selected, update } = useCard(node, graph);
  const {
    understandingRefs,
    readonly,
    onElementEdit,
    multiSelected,
    onCellAction,
    resolveWikiLink,
    onWikiLinkOpen,
  } = useCanvasShapeData();
  if (element.kind !== "understanding") return null;
  const ref = element.understandingId ? understandingRefs.get(element.understandingId) : undefined;
  return (
    <CanvasUnderstandingCard
      id={element.id}
      understandingId={element.understandingId ?? ""}
      title={ref?.title ?? null}
      body={ref?.body ?? ""}
      // ponytail: 占位只在服务端明确标记 soft-delete 时显示；拖入新卡后 ref 尚未随刷新就位，
      // 用 !ref 兜底会把“未加载”误判成“已删除”。hard-delete 不存在（仅软删），不影响。
      deleted={ref?.deleted ?? false}
      loading={ref?.loading}
      resolveWikiLink={resolveWikiLink}
      onWikiLinkOpen={onWikiLinkOpen}
      color={element.props.color}
      selected={selected}
      readonly={readonly}
      multiSelected={multiSelected}
      onEdit={() => onElementEdit?.(element)}
      onRemove={() => onCellAction?.({ type: "delete-element", nodeId: element.id })}
      onColorChange={(color) => update({ ...element, props: { ...element.props, color } })}
      onOpenDetail={() => {
        if (!readonly && element.understandingId) onElementEdit?.(element);
      }}
    />
  );
}

function TextShape({ node, graph }: CardProps) {
  const { element, selected, update } = useCard(node, graph);
  const { readonly, multiSelected, onCellAction } = useCanvasShapeData();
  if (element.kind !== "text") return null;
  return (
    <CanvasTextCard
      id={element.id}
      text={element.props.text}
      color={element.props.color}
      selected={selected}
      readonly={readonly}
      multiSelected={multiSelected}
      onTextChange={(text) => update({ ...element, props: { ...element.props, text } })}
      onColorChange={(color) => update({ ...element, props: { ...element.props, color } })}
      onRemove={() => onCellAction?.({ type: "delete-element", nodeId: element.id })}
    />
  );
}

function GroupShape({ node, graph }: CardProps) {
  const { element, selected, update } = useCard(node, graph);
  const { readonly, onCellAction, multiSelected } = useCanvasShapeData();
  if (element.kind !== "group") return null;
  return (
    <CanvasGroupCard
      id={element.id}
      label={element.props.label}
      color={element.props.color}
      selected={selected}
      readonly={readonly}
      multiSelected={multiSelected}
      onLabelChange={(label) => update({ ...element, props: { ...element.props, label } })}
      onColorChange={(color) => update({ ...element, props: { ...element.props, color } })}
      onUngroup={() => onCellAction?.({ type: "ungroup", nodeId: element.id })}
      onDelete={() => onCellAction?.({ type: "delete-group", nodeId: element.id })}
    />
  );
}

function CanvasRefShape({ node, graph }: CardProps) {
  const { element, selected, update } = useCard(node, graph);
  const {
    referencedCanvases,
    onCanvasRefClick,
    onElementEdit,
    readonly,
    multiSelected,
    onCellAction,
  } = useCanvasShapeData();
  if (element.kind !== "canvas_ref") return null;
  const target = element.canvasRefId ? referencedCanvases.get(element.canvasRefId) : undefined;
  // ponytail: 同上，未加载的引用不算“已删除”。
  const deleted = target?.deleted ?? false;
  return (
    <CanvasRefCard
      id={element.id}
      canvasRefId={element.canvasRefId ?? ""}
      title={target?.title ?? ""}
      deleted={deleted}
      color={element.props.color}
      selected={selected}
      readonly={readonly}
      multiSelected={multiSelected}
      document={target?.document}
      shapeData={target?.shapeData}
      onOpen={() => {
        if (!deleted && element.canvasRefId) onCanvasRefClick?.(element.canvasRefId);
      }}
      onEdit={() => onElementEdit?.(element)}
      onRemove={() => onCellAction?.({ type: "delete-element", nodeId: element.id })}
      onColorChange={(color) => update({ ...element, props: { ...element.props, color } })}
    />
  );
}

/** 拖拽泡影的实体语义图标：按元素 kind 匹配 chat 实体图标语义。 */
const PILL_ICONS: Partial<Record<CanvasElementKind, LucideIcon>> = {
  understanding: FileText,
  text: Type,
  canvas_ref: LayoutGrid,
};

/** 拖拽泡影：迷你主色胶囊 + 实体图标 + 标题（渲染在 X6 的 draggingGraph，不读画布 context）。 */
function PillShape({ node }: { node: X6Node; graph?: Graph }) {
  const data = (node.getData() ?? {}) as { label?: string; kind?: CanvasElementKind } | undefined;
  const Icon = data?.kind ? PILL_ICONS[data.kind] : undefined;
  return (
    <div
      data-testid="canvas-drag-pill"
      className="flex h-full w-full items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-primary-foreground shadow-md"
    >
      {Icon ? <Icon size={14} strokeWidth={2.5} aria-hidden /> : null}
      <span className="whitespace-nowrap text-[13px] font-medium leading-none">{data?.label}</span>
    </div>
  );
}

/** 注册四种 react-shape：键与元素 kind 一一对应（幂等；由 CanvasGraph 挂载前调用，防 tree-shaking 丢弃）。 */
let shapesRegistered = false;
export function ensureCanvasShapes(): void {
  if (shapesRegistered) return;
  shapesRegistered = true;
  // 组件需拿到 element 数据才渲染；连删等场景 react-shape 会为已移除 cell 补渲一帧
  // （此时 getData() 已清空），直接渲染会崩溃在 element.props 访问上。
  const guard =
    (Card: (args: RegisterArgs) => ReactNode) =>
    (args: RegisterArgs): ReactNode => {
      const data = args.node.getData() as { element?: CanvasElementDTO } | null | undefined;
      return data?.element ? Card(args) : null;
    };
  register({ shape: "understanding", component: guard(UnderstandingShape) });
  register({ shape: "text", component: guard(TextShape) });
  // 拖拽泡影不依赖 element 数据（draggingGraph 容器不在画布 React 树内），不走 guard
  register({ shape: "pill", component: PillShape });
  // 组名徽章在节点框外，foreignObject 必须溢出可见，否则会被裁掉。
  register({
    shape: "group",
    component: guard(GroupShape),
    attrs: {
      fo: { refWidth: "100%", refHeight: "100%", style: { overflow: "visible" } },
      foBody: { style: { overflow: "visible", height: "100%", width: "100%" } },
      foContent: { style: { overflow: "visible", height: "100%", width: "100%" } },
    },
  });
  register({ shape: "canvas_ref", component: guard(CanvasRefShape) });
}
