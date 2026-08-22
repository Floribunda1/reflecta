import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { StoryCase } from "../../.storybook/story-showcase";
import { Button } from "../components/button";
import { CanvasGraph, type CanvasGraphHandle } from "./CanvasGraph";
import { CanvasZoomControls } from "./CanvasZoomControls";
import { typicalShapeData } from "./canvas-story-fixtures";
import type { CanvasDocument } from "./document";
import type { CanvasShapeData } from "./shape-context";

/**
 * x6-react-shape 的 portal dispatch 是模块单例。同一页挂多个 CanvasGraph 时，
 * 后挂载的图会抢走前面图的卡片 React 树（dev 只有一张图所以正常）。
 * Story 里同一时间只挂载一个 case 的图。
 */
export function StoryCaseSwitch({
  cases,
}: {
  cases: ReadonlyArray<{ title: string; description?: string; content: ReactNode }>;
}) {
  const [active, setActive] = useState(0);
  const current = cases[active] ?? cases[0];
  if (!current) return null;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-1">
        {cases.map((item, index) => (
          <Button
            key={item.title}
            type="button"
            size="sm"
            variant={index === active ? "secondary" : "ghost"}
            onClick={() => setActive(index)}
          >
            {item.title}
          </Button>
        ))}
      </div>
      <StoryCase title={current.title} description={current.description}>
        {current.content}
      </StoryCase>
    </div>
  );
}

export function GraphFrame({
  height = "h-[420px]",
  children,
}: {
  height?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative w-full overflow-hidden rounded-lg border bg-background ${height}`}>
      {children}
    </div>
  );
}

export function InteractiveGraph({
  document,
  readonly = false,
  shapeData = typicalShapeData,
  height,
  hint,
}: {
  document: CanvasDocument;
  readonly?: boolean;
  shapeData?: CanvasShapeData;
  height?: string;
  hint?: string;
}) {
  const graphRef = useRef<CanvasGraphHandle>(null);
  const [selection, setSelection] = useState("尚未选中");
  const onSelectionChange = useCallback((ids: string[]) => {
    setSelection(ids.length ? `选中 ${ids.length} 项：${ids.join(", ")}` : "未选中");
  }, []);
  const liveShapeData = useMemo<CanvasShapeData>(
    () => ({
      ...shapeData,
      onCanvasRefClick: (canvasId) => setSelection(`打开引用画布：${canvasId}`),
      onElementEdit: (element) => setSelection(`编辑：${element.id}`),
    }),
    [shapeData],
  );

  return (
    <div className="grid gap-2">
      <GraphFrame height={height}>
        <CanvasGraph
          ref={graphRef}
          document={document}
          readonly={readonly}
          viewportReady
          shapeData={liveShapeData}
          onSelectionChange={onSelectionChange}
          className="absolute inset-0"
        />
        {readonly ? null : (
          <CanvasZoomControls
            className="absolute bottom-4 left-4 z-20"
            onZoomIn={() => graphRef.current?.zoomIn()}
            onZoomOut={() => graphRef.current?.zoomOut()}
            onFit={() => graphRef.current?.fitView()}
          />
        )}
      </GraphFrame>
      <p className="text-xs text-muted-foreground">
        {hint ??
          (readonly
            ? "只读：可平移缩放，不能编辑。"
            : `${selection}。单击选中卡片或连线；选中连线后底部出现样式工具条。`)}
      </p>
    </div>
  );
}
