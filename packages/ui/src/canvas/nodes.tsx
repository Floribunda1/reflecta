import type { ReactNode } from "react";
import type { Node as X6Node } from "@antv/x6";
import { register } from "@antv/x6-react-shape";
import {
  CanvasGroupCard,
  CanvasRefCard,
  CanvasTextCard,
  CanvasUnderstandingCard,
} from "./canvas-cards";
import type { CanvasElementDTO } from "./document";
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

type CardProps = { node: X6Node };
type RegisterArgs = CardProps & { graph?: unknown };

/** 卡片重渲由 shapeData context（含 selectedIds）驱动；这里只保留元素内容读取。 */
function useCard(node: X6Node): {
  element: CanvasElementDTO;
  selected: boolean;
  update: (element: CanvasElementDTO) => void;
} {
  const { selectedIds } = useCanvasShapeData();
  const update = useCanvasElementUpdate();
  const element = (node.getData() as { element?: CanvasElementDTO } | null | undefined)?.element;
  const selected = selectedIds?.has(element?.id ?? "") ?? false;
  return { element: element ?? ({} as CanvasElementDTO), selected, update };
}

function UnderstandingShape({ node }: CardProps) {
  const { element, selected, update } = useCard(node);
  const { understandingRefs, readonly, onElementEdit, multiSelected, onCellAction } =
    useCanvasShapeData();
  if (element.kind !== "understanding") return null;
  const ref = element.understandingId ? understandingRefs.get(element.understandingId) : undefined;
  return (
    <CanvasUnderstandingCard
      id={element.id}
      understandingId={element.understandingId ?? ""}
      title={ref?.title ?? null}
      body={ref?.body ?? ""}
      deleted={!ref || ref.deleted}
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

function TextShape({ node }: CardProps) {
  const { element, selected, update } = useCard(node);
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

function GroupShape({ node }: CardProps) {
  const { element, selected, update } = useCard(node);
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

function CanvasRefShape({ node }: CardProps) {
  const { element, selected, update } = useCard(node);
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
  const deleted = !target || target.deleted;
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
  register({ shape: "group", component: guard(GroupShape) });
  register({ shape: "canvas_ref", component: guard(CanvasRefShape) });
}
